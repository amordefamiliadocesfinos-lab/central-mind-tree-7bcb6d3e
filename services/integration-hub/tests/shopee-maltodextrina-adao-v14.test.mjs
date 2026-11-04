import test from 'node:test';
import assert from 'node:assert/strict';
import { mappingPhysicalBlocker } from '../src/shopee-mapping-physical-guard.mjs';
import { buildShopeeMappingPreview } from '../src/shopee-mapping-preview.mjs';
import { buildShopeeOrderProjectionPreview } from '../src/shopee-order-projection-preview.mjs';
import { applyShopeeInternalOrderContract } from '../src/shopee-internal-order-contract.mjs';
import {
  MALTO_ADAO_ACCOUNT_ID as ACCOUNT, MALTO_PRODUCT_ID as PRODUCT,
  MALTO_MD1_PRESENTATION_ID as MD1, MALTO_MD2_PRESENTATION_ID as MD2,
  MALTO_ADAO_MODELS,
} from '../src/shopee-maltodextrina-adao-v14-guard.mjs';

const cases=Object.entries(MALTO_ADAO_MODELS);
function item(key,quantity=1) {
 const [itemId,modelId]=key.split('|');
 return {itemId,modelId,quantity,itemName:'Maltodextrina SH-001-007',
   modelName:'Embalagem',itemSku:null,modelSku:'AF-MALT-001KG'};
}
function mapping(key,contract) {
 const [itemId,modelId]=key.split('|');
 return {id:'malto-'+modelId,marketplace:'shopee',marketplace_account:'SHOPEE ADÃO',
 channel_account_id:ACCOUNT,external_item_id:itemId,external_model_id:modelId,
 product_id:PRODUCT,variant_id:null,physical_multiplier:contract.multiplier,
 components:[{product_id:PRODUCT,variant_id:null,physical_multiplier:contract.multiplier,
 physical_identity:{active:true,unit:'g',presentation_factors:[1000]}}]};
}
const mappings=cases.map(([key,c])=>mapping(key,c));
function fixture(entry,account=ACCOUNT) {
 return {source:'fixture',environment:'test',channelAccountId:account,orders:[{
 orderSn:'TEST-MD-'+entry.modelId,createdAt:'2026-11-04T10:00:00Z',
 externalStatus:'READY_TO_SHIP',items:[entry]}]};
}
function preview(entry,ms=mappings,account=ACCOUNT) {
 const p=fixture(entry,account);
 const mp=buildShopeeMappingPreview(p,ms,{channelAccountId:account,
 marketplaceAccount:'SHOPEE ADÃO',requirePhysicalValidation:true});
 const pp=buildShopeeOrderProjectionPreview(p,mp,{marketplaceAccount:'SHOPEE ADÃO'});
 return {mp,pp};
}
test('V14 exactly four MD1 and one MD2 official identities',()=>{
 assert.equal(cases.length,5);
 assert.equal(cases.filter(([,v])=>v.kind==='fractioned_g').length,4);
 assert.equal(cases.filter(([,v])=>v.kind==='sealed_sack').length,1);
});
test('MD1 Q=1/2/5 converts sold quantity into opened grams once',()=>{
 for(const [key,contract] of cases.filter(([,v])=>v.kind==='fractioned_g')) {
  for(const q of [1,2,5]) {
   const {mp,pp}=preview(item(key,q));
   assert.equal(mp.orders[0].items[0].mappingStatus,'recognized',key);
   assert.equal(pp.readyCount,1,key);
   assert.equal(pp.operationalWrites,false);
   const line=pp.orders[0].candidate.items[0];
   assert.equal(line.quantity,q*contract.multiplier);
   assert.equal(line.commercialQuantity,q);
   assert.equal(line.physicalMultiplier,contract.multiplier);
   assert.equal(line.commercialPresentationId,MD1);
   assert.equal(line.variantId,null);
   assert.equal(pp.orders[0].candidate.stockEvent,null);
   const internal=applyShopeeInternalOrderContract(pp.orders[0],{
     channelAccountId:ACCOUNT,marketplaceAccount:'SHOPEE ADÃO'});
   assert.equal(internal.items[0].commercialPresentationId,MD1);
   assert.equal(internal.effects.stockAction,null);
   assert.equal(internal.effects.productionOrderAction,null);
  }
 }
});
test('MD2 Q=1/2/5 is a whole ORIGINAL sealed 25kg sack per quantity',()=>{
 const [key]=cases.find(([,v])=>v.kind==='sealed_sack');
 for(const q of [1,2,5]) {
  const {mp,pp}=preview(item(key,q));
  assert.equal(mp.orders[0].items[0].mappingStatus,'recognized');
  assert.equal(pp.readyCount,1);
  assert.equal(pp.operationalWrites,false);
  assert.equal(pp.writeReady,false);
  const line=pp.orders[0].candidate.items[0];
  assert.equal(line.commercialPresentationId,MD2);
  assert.equal(line.quantity,q);
  assert.equal(line.physicalQuantity,q);
  assert.equal(line.physicalMultiplier,1);
  assert.equal(line.commercialQuantity,q);
  assert.equal(line.variantId,null);
  assert.equal(pp.orders[0].candidate.stockEvent,null);
  const internal=applyShopeeInternalOrderContract(pp.orders[0],{
   channelAccountId:ACCOUNT,marketplaceAccount:'SHOPEE ADÃO'});
  assert.equal(internal.items[0].commercialPresentationId,MD2);
  assert.equal(internal.items[0].quantity,q);
  assert.equal(internal.effects.stockAction,null);
 }
});
test('reject foreign account, incompatible physical identity, extra composition and invalid Q',()=>{
 for(const [key,c] of cases) {
  const e=item(key);
  assert.equal(mappingPhysicalBlocker(e,mapping(key,c),{channelAccountId:ACCOUNT}),null);
  assert.equal(mappingPhysicalBlocker(e,mapping(key,c),{channelAccountId:'foreign'}),'malto_account_unverified');
  for(const change of [
   x=>{x.product_id='wrong';},x=>{x.variant_id='wrong';},
   x=>{x.physical_multiplier+=1;},x=>{x.physical_identity.unit='un';},
   x=>{x.physical_identity.active=false;}
  ]) {
   const m=mapping(key,c);change(m.components[0]);
   assert.equal(mappingPhysicalBlocker(e,m,{channelAccountId:ACCOUNT}),
    'malto_physical_identity_unverified');
  }
  const m=mapping(key,c);m.components.push({...m.components[0]});
  assert.equal(mappingPhysicalBlocker(e,m,{channelAccountId:ACCOUNT}),'malto_composition_invalid');
  for(const q of [0,-1,1.5]) assert.equal(
   mappingPhysicalBlocker(item(key,q),mapping(key,c),{channelAccountId:ACCOUNT}),
   'physical_quantity_invalid');
 }
});
test('MD1 requires verified 1kg commercial presentation',()=>{
 const [key,c]=cases.find(([,v])=>v.kind==='fractioned_g');
 const m=mapping(key,c);
 m.components[0].physical_identity.presentation_factors=[25000];
 assert.equal(mappingPhysicalBlocker(item(key),m,{channelAccountId:ACCOUNT}),
  'malto_fractioned_presentation_unverified');
});
test('unrecognized official Model, wrong item and commercial SKU cannot rewrite history',()=>{
 const [key,c]=cases[0];
 const legacy={...mapping(key,c),id:'historical',external_item_id:null,external_model_id:null,
 external_item_key:'sku:af-malt-001kg|variation:embalagem'};
 for(const itemId of ['58211513468','22295380075']){
  const {mp,pp}=preview({...item(key),itemId,modelId:'0'},[...mappings,legacy]);
  assert.equal(mp.orders[0].items[0].mappingStatus,'needs_mapping');
  assert.equal(pp.blockedCount,1);
 }
 const foreign=fixture(item(key),'other-account');
 const mp=buildShopeeMappingPreview(foreign,mappings,{
 channelAccountId:'other-account',marketplaceAccount:'SHOPEE VIVIANE',requirePhysicalValidation:true});
 assert.equal(mp.orders[0].items[0].mappingStatus,'needs_mapping');
});
