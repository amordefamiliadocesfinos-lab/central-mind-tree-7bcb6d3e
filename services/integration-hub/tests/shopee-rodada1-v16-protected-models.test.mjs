import test from 'node:test';
import assert from 'node:assert/strict';
import { mappingPhysicalBlocker } from '../src/shopee-mapping-physical-guard.mjs';
import { buildShopeeMappingPreview } from '../src/shopee-mapping-preview.mjs';
import { buildShopeeOrderProjectionPreview } from '../src/shopee-order-projection-preview.mjs';
import { applyShopeeInternalOrderContract } from '../src/shopee-internal-order-contract.mjs';
import { R1_V16_PROTECTED_MODELS, R1_ADAO_ACCOUNT_ID as ACCOUNT,
  R1_CP_PRESENTATIONS } from '../src/shopee-rodada1-v16-physical-guard.mjs';

const cases=Object.entries(R1_V16_PROTECTED_MODELS);
function item(key,quantity=1){const[itemId,modelId]=key.split('|');
 return {itemId,modelId,quantity,itemName:'Rodada 1 V16',modelName:'Estampa ou tamanho',
   itemSku:null,modelSku:null};}
function mapping(key,contract){const[itemId,modelId]=key.split('|');
 return {id:'r1-'+modelId,marketplace:'shopee',marketplace_account:'SHOPEE ADÃO',
 channel_account_id:ACCOUNT,external_item_id:itemId,external_model_id:modelId,
 product_id:contract.product,variant_id:contract.variant,physical_multiplier:contract.multiplier,
 components:[{product_id:contract.product,variant_id:contract.variant,
 physical_multiplier:contract.multiplier,physical_identity:{active:true,unit:'un',presentation_factors:[25]}}]};}
const mappings=cases.map(([k,c])=>mapping(k,c));
function preview(entry,ms=mappings,account=ACCOUNT){
 const p={source:'fixture',environment:'test',channelAccountId:account,
 orders:[{orderSn:'TEST-R1-'+entry.modelId,createdAt:'2026-11-04T12:00:00Z',externalStatus:'READY_TO_SHIP',items:[entry]}]};
 const mp=buildShopeeMappingPreview(p,ms,{channelAccountId:account,marketplaceAccount:'SHOPEE ADÃO',requirePhysicalValidation:true});
 const pp=buildShopeeOrderProjectionPreview(p,mp,{marketplaceAccount:'SHOPEE ADÃO'});
 return {mp,pp};
}
test('only ten proven BL1 CS1 FR1 CP1 identities are in P2 scope',()=>{
 assert.equal(cases.length,10);
 for(const[kind,n] of [['blister',1],['sextavada',1],['flor',5],['papelao',3]])
 assert.equal(cases.filter(([,c])=>c.kind===kind).length,n);
});
test('all ten identities multiply Q once; order preview has zero operational effects',()=>{
 for(const[key,c] of cases)for(const q of [1,2,5]){
  const {mp,pp}=preview(item(key,q));
  assert.equal(mp.orders[0].items[0].mappingStatus,'recognized',key);
  assert.equal(pp.readyCount,1,key);
  assert.equal(pp.operationalWrites,false);
  assert.equal(pp.writeReady,false);
  const line=pp.orders[0].candidate.items[0];
  assert.equal(line.productId,c.product);
  assert.equal(line.variantId,c.variant);
  assert.equal(line.quantity,c.multiplier*q);
  assert.equal(line.physicalMultiplier,c.multiplier);
  assert.equal(line.commercialQuantity,q);
  assert.equal(pp.orders[0].candidate.stockEvent,null);
  assert.equal(line.commercialPresentationId,c.kind==='papelao'?R1_CP_PRESENTATIONS[c.variant]:null);
  const internal=applyShopeeInternalOrderContract(pp.orders[0],
   {channelAccountId:ACCOUNT,marketplaceAccount:'SHOPEE ADÃO'});
  assert.equal(internal.items[0].quantity,c.multiplier*q);
  assert.equal(internal.items[0].commercialQuantity,q);
  assert.equal(internal.items[0].commercialPresentationId ?? null,
    c.kind==='papelao'?R1_CP_PRESENTATIONS[c.variant]:null);
  assert.equal(internal.effects.stockAction,null);
  assert.equal(internal.effects.productionOrderAction,null);
 }
});
test('CP1 includes 100/100/75 boxes and historical model is never recognized',()=>{
 assert.equal(R1_V16_PROTECTED_MODELS['22299532770|239453506473'].multiplier,100);
 assert.equal(R1_V16_PROTECTED_MODELS['22299532770|239453506474'].multiplier,100);
 assert.equal(R1_V16_PROTECTED_MODELS['22299532770|239453506475'].multiplier,75);
 assert.equal(cases.some(([k])=>k==='22299532770|179728941455'),false);
 const old=item('22299532770|179728941455');old.modelSku='AF-CP-100-24168';
 const {mp,pp}=preview(old);
 assert.equal(mp.orders[0].items[0].mappingStatus,'needs_mapping');
 assert.equal(pp.blockedCount,1);
});
test('all ten reject wrong account/product/variant/unit/multiplier, extra components and invalid quantities',()=>{
 for(const[key,c] of cases){
  const e=item(key);
  assert.equal(mappingPhysicalBlocker(e,mapping(key,c),{channelAccountId:ACCOUNT}),null);
  assert.equal(mappingPhysicalBlocker(e,mapping(key,c),{channelAccountId:'foreign'}),'r1_account_unverified');
  for(const change of [x=>{x.product_id='wrong';},x=>{x.variant_id='wrong';},
    x=>{x.physical_multiplier+=1;},x=>{x.physical_identity.active=false;},
    x=>{x.physical_identity.unit='g';}]){
   const m=mapping(key,c);change(m.components[0]);
   assert.equal(mappingPhysicalBlocker(e,m,{channelAccountId:ACCOUNT}),'r1_physical_identity_unverified',key);
  }
  const extra=mapping(key,c);extra.components.push({...extra.components[0]});
  assert.equal(mappingPhysicalBlocker(e,extra,{channelAccountId:ACCOUNT}),'r1_composition_invalid');
  for(const q of [0,-1,1.5])assert.equal(
   mappingPhysicalBlocker(item(key,q),mapping(key,c),{channelAccountId:ACCOUNT}),
   'physical_quantity_invalid',key);
 }
});
test('CP1 only permits confirmed 25-unit catalog presentations',()=>{
 for(const[key,c] of cases.filter(([,v])=>v.kind==='papelao')){
  const m=mapping(key,c);m.components[0].physical_identity.presentation_factors=[10];
  assert.equal(mappingPhysicalBlocker(item(key),m,{channelAccountId:ACCOUNT}),
   'r1_cp_presentation_unverified');
 }
});
test('unknown official model and SKU fallback stay blocked, foreign account isolated',()=>{
 for(const id of ['22795004937','58212319829','22099402766','22299532770']){
  const unknown={...item(id+'|0'),modelSku:'AF-CP-100-24168'};
  const {mp,pp}=preview(unknown);
  assert.equal(mp.orders[0].items[0].mappingStatus,'needs_mapping',id);
  assert.equal(pp.blockedCount,1);
 }
 const [key]=cases[0];
 const {mp}=preview(item(key),mappings,'some-other-account');
 assert.equal(mp.orders[0].items[0].mappingStatus,'needs_mapping');
});
