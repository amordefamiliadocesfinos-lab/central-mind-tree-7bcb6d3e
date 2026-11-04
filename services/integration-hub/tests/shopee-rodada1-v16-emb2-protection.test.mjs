import test from 'node:test';
import assert from 'node:assert/strict';
import {EMB2_MODELS,EMB2_ACCOUNT_ID,EMB2_PRODUCT_ID,emb2PhysicalBlocker} from '../src/shopee-rodada1-v16-emb2-guard.mjs';
import {mappingPhysicalBlocker} from '../src/shopee-mapping-physical-guard.mjs';
import {buildShopeeMappingPreview} from '../src/shopee-mapping-preview.mjs';
import {buildShopeeOrderProjectionPreview} from '../src/shopee-order-projection-preview.mjs';
const cases=Object.entries(EMB2_MODELS);
function item(key,q=1){const[itemId,modelId]=key.split('|');return {itemId,modelId,quantity:q,itemName:'Embalagens para trufa',modelName:'1000 unidades',modelSku:null,itemSku:null};}
function mapping(key,variant){const [external_item_id,external_model_id]=key.split('|');
return {id:'emb2-'+external_model_id,marketplace:'shopee',marketplace_account:'SHOPEE ADÃO',channel_account_id:EMB2_ACCOUNT_ID,external_item_id,external_model_id,product_id:EMB2_PRODUCT_ID,variant_id:variant,physical_multiplier:1000,components:[{product_id:EMB2_PRODUCT_ID,variant_id:variant,physical_multiplier:1000,physical_identity:{active:true,unit:'un',presentation_factors:[100]}}]};}
const mappings=cases.map(([key,variant])=>mapping(key,variant));
function preview(i,m=mappings,account=EMB2_ACCOUNT_ID){const norm={source:'fixture',environment:'test',channelAccountId:account,orders:[{orderSn:'R1-EMB2-'+i.modelId,createdAt:'2026-11-04T12:00:00Z',externalStatus:'READY_TO_SHIP',items:[i]}]};
const mp=buildShopeeMappingPreview(norm,m,{channelAccountId:account,marketplaceAccount:'SHOPEE ADÃO',requirePhysicalValidation:true});
const pp=buildShopeeOrderProjectionPreview(norm,mp,{marketplaceAccount:'SHOPEE ADÃO'});
return {mp,pp};}
test('only 14 official EMB2 print models; Leite excluded',()=>{assert.equal(cases.length,14);assert.equal(cases.some(([key])=>key.endsWith('|229443539818')),false);assert.equal(new Set(Object.values(EMB2_MODELS)).size,14);});
test('each verified print projects 1000 units for one commercial unit without writes',()=>{for(const[key,v]of cases)for(const q of [1,2,5]){const {mp,pp}=preview(item(key,q));
 assert.equal(mp.orders[0].items[0].mappingStatus,'recognized',key);
 assert.equal(pp.readyCount,1,key);
 assert.equal(pp.operationalWrites,false);
 assert.equal(pp.writeReady,false);
 assert.equal(pp.orders[0].candidate.stockEvent,null);
 const line=pp.orders[0].candidate.items[0];
 assert.equal(line.productId,EMB2_PRODUCT_ID);
 assert.equal(line.variantId,v);
 assert.equal(line.physicalMultiplier,1000);
 assert.equal(line.commercialQuantity,q);
 assert.equal(line.quantity,1000*q);
}});
test('physical identity, 100-unit packaging, safe quantity, account all enforced',()=>{
 for(const[key,v]of cases){const i=item(key),m=mapping(key,v);
 assert.equal(mappingPhysicalBlocker(i,m,{channelAccountId:EMB2_ACCOUNT_ID}),null);
 assert.equal(mappingPhysicalBlocker(i,m,{channelAccountId:'wrong'}),'emb2_account_unverified');
 for(const change of [c=>{c.product_id='wrong'},c=>{c.variant_id='wrong'},c=>{c.physical_multiplier=100},c=>{c.physical_identity.unit='g'},c=>{c.physical_identity.active=false}]){
 const k=mapping(key,v);change(k.components[0]);
 assert.equal(mappingPhysicalBlocker(i,k,{channelAccountId:EMB2_ACCOUNT_ID}),'emb2_physical_identity_unverified');
 }
 const noPack=mapping(key,v);noPack.components[0].physical_identity.presentation_factors=[25];
 assert.equal(mappingPhysicalBlocker(i,noPack,{channelAccountId:EMB2_ACCOUNT_ID}),'emb2_pack100_unverified');
 for(const q of [0,-1,1.5,2147484])assert.equal(emb2PhysicalBlocker(item(key,q),m.components,{channelAccountId:EMB2_ACCOUNT_ID},v),'physical_quantity_invalid');
 const multiple=mapping(key,v);multiple.components.push({...multiple.components[0]});
 assert.equal(mappingPhysicalBlocker(i,multiple,{channelAccountId:EMB2_ACCOUNT_ID}),'emb2_composition_invalid');
 }
});
test('Leite EMB2, EMB1 mixed pack, DL1 bucket do not silently resolve by SKU fallback',()=>{
 for(const [key,sku] of [['22694563769|229443539818','AF-EMB-1000-LEI'],['58222235000|219629112211','AF-EMB-MX-600'],['21599903629|238794159646','AF-IVOTI-09800G']]){
 const i=item(key);i.modelSku=sku;
 const {mp,pp}=preview(i);
 assert.equal(mp.orders[0].items[0].mappingStatus,'needs_mapping',key);
 assert.equal(pp.blockedCount,1,key);
 }
});
test('other accounts do not inherit any of these prints',()=>{const {mp}=preview(item(cases[0][0]),mappings,'other-account');assert.equal(mp.orders[0].items[0].mappingStatus,'needs_mapping');});
