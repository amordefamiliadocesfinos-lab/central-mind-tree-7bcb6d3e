import test from 'node:test';
import assert from 'node:assert/strict';
import {mappingPhysicalBlocker} from '../src/shopee-mapping-physical-guard.mjs';
import {buildShopeeMappingPreview} from '../src/shopee-mapping-preview.mjs';
import {buildShopeeOrderProjectionPreview} from '../src/shopee-order-projection-preview.mjs';
import {R1_EMB_ACCOUNT as ACCOUNT,R1_EMB_PRODUCT as PRODUCT,R1_EMB_SIX,R1_EMB_LEITE_VARIANT,R1_EMB2_LEITE_KEY,R1_EMB1_MIX_KEY} from '../src/shopee-rodada1-v16-leite-mix-guard.mjs';
const comp=(variant,qty)=>({product_id:PRODUCT,variant_id:variant,physical_multiplier:qty,physical_identity:{active:true,unit:'un',presentation_factors:[100]}});
const mapping=(key,components)=>{const[itemId,modelId]=key.split('|');return {id:'test-'+modelId,marketplace:'shopee',marketplace_account:'SHOPEE ADÃO',channel_account_id:ACCOUNT,external_item_id:itemId,external_model_id:modelId,product_id:PRODUCT,variant_id:null,physical_multiplier:1,components};};
const leite=mapping(R1_EMB2_LEITE_KEY,[comp(R1_EMB_LEITE_VARIANT,1000)]);
const mix=mapping(R1_EMB1_MIX_KEY,R1_EMB_SIX.map(v=>comp(v.variant,100)));
function preview(key,quantity,mappings=[leite,mix],account=ACCOUNT){
 const [itemId,modelId]=key.split('|');
 const item={itemId,modelId,quantity,itemName:'Embalagem Trufa',modelName:'Pacote comercial'};
 const norm={source:'fixture',environment:'test',channelAccountId:account,orders:[{orderSn:'TEST-'+modelId,createdAt:'2026-11-04T12:00:00Z',externalStatus:'READY_TO_SHIP',items:[item]}]};
 const mp=buildShopeeMappingPreview(norm,mappings,{channelAccountId:account,marketplaceAccount:'SHOPEE ADÃO',requirePhysicalValidation:true});
 const pp=buildShopeeOrderProjectionPreview(norm,mp,{marketplaceAccount:'SHOPEE ADÃO'});
 return{item,mp,pp};
}
test('exact physical variants: Leite is Leite em Po, not Leite Condensado',()=>{
 assert.equal(R1_EMB_LEITE_VARIANT,'5c73cec6-7e40-4cea-934f-7b22d234a405');
 assert.equal(R1_EMB_SIX.length,6);
 assert.equal(new Set(R1_EMB_SIX.map(v=>v.variant)).size,6);
});
test('Leite 1x1000 and Mix 6x100, Q=1/2/5, preview no operational writes',()=>{
 for(const [key,total,count] of [[R1_EMB2_LEITE_KEY,1000,1],[R1_EMB1_MIX_KEY,600,6]])for(const q of [1,2,5]){
  const {mp,pp}=preview(key,q);
  assert.equal(mp.orders[0].items[0].mappingStatus,'recognized',key);
  assert.equal(pp.readyCount,1,key);
  assert.equal(pp.operationalWrites,false);
  assert.equal(pp.writeReady,false);
  assert.equal(pp.orders[0].candidate.stockEvent,null);
  const lines=pp.orders[0].candidate.items;
  assert.equal(lines.length,count);
  assert.equal(lines.reduce((s,l)=>s+l.quantity,0),total*q);
  for(const line of lines){
   assert.equal(line.productId,PRODUCT);
   assert.equal(line.commercialQuantity,q);
   assert.equal(line.quantity,q*(count===1?1000:100));
  }
 }
});
test('Leite cannot map to Leite Condensado or duplicate/other prints',()=>{
 for(const invalid of [comp('ec201054-48db-4230-b3a4-92444c1128ab',1000),comp(R1_EMB_LEITE_VARIANT,100),comp(R1_EMB_LEITE_VARIANT,600)]){
  const m=mapping(R1_EMB2_LEITE_KEY,[invalid]);const r=preview(R1_EMB2_LEITE_KEY,1,[m]);
  assert.equal(r.mp.orders[0].items[0].mappingStatus,'r1_emb_leite_identity_unverified');
 }
});
test('Mix rejects generic one-line 600, missing print, repeated print, inaccurate multipliers',()=>{
 const different=[
 [comp(R1_EMB_LEITE_VARIANT,600)],
 R1_EMB_SIX.slice(0,5).map(v=>comp(v.variant,100)),
 R1_EMB_SIX.map((v,i)=>comp(i===5?R1_EMB_SIX[0].variant:v.variant,100)),
 R1_EMB_SIX.map((v,i)=>comp(v.variant,i===3?200:100)),
 ];
 const codes=['r1_emb_composition_invalid','r1_emb_composition_invalid','r1_emb_mix_identity_unverified','r1_emb_mix_identity_unverified'];
 different.forEach((arr,i)=>{const r=preview(R1_EMB1_MIX_KEY,1,[mapping(R1_EMB1_MIX_KEY,arr)]);
 assert.equal(r.mp.orders[0].items[0].mappingStatus,codes[i]);});
});
test('isolation, identity validation, quantities and unit/pack proofs',()=>{
 for(const [key,record]of [[R1_EMB2_LEITE_KEY,leite],[R1_EMB1_MIX_KEY,mix]]){
  assert.equal(mappingPhysicalBlocker({itemId:key.split('|')[0],modelId:key.split('|')[1],quantity:1},record,{channelAccountId:'foreign'}),'r1_emb_account_unverified');
  for(const q of [0,-1,1.5,3579140]){
   const r=preview(key,q);
   assert.equal(r.mp.orders[0].items[0].mappingStatus,'physical_quantity_invalid');
  }
  const m=mapping(key,record.components.map(c=>({...c,physical_identity:{...c.physical_identity,unit:'g'}})));
  assert.match(preview(key,1,[m]).mp.orders[0].items[0].mappingStatus,/identity_unverified/);
  const n=mapping(key,record.components.map(c=>({...c,physical_identity:{...c.physical_identity,presentation_factors:[25]}})));
  assert.match(preview(key,1,[n]).mp.orders[0].items[0].mappingStatus,/identity_unverified/);
 }
});
test('DL1 original sealed bucket remains protected independently',()=>{
 assert.equal(preview('21599903629|238794159646',1).mp.orders[0].items[0].mappingStatus,'needs_mapping');
});
