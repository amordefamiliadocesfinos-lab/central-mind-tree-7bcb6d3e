import test from 'node:test';
import assert from 'node:assert/strict';
import { mappingPhysicalBlocker } from '../src/shopee-mapping-physical-guard.mjs';
import { buildShopeeMappingPreview } from '../src/shopee-mapping-preview.mjs';
import { buildShopeeOrderProjectionPreview } from '../src/shopee-order-projection-preview.mjs';
import { applyShopeeInternalOrderContract } from '../src/shopee-internal-order-contract.mjs';
import {
  GLUCODRY_ADAO_ACCOUNT_ID as ACCOUNT, GLUCODRY_PRODUCT_ID as PRODUCT,
  GLUCODRY_GD1_PRESENTATION_ID as GD1, GLUCODRY_GD2_PRESENTATION_ID as GD2,
  GLUCODRY_ADAO_MODELS,
} from '../src/shopee-glucodry-adao-v13-guard.mjs';

const cases = Object.entries(GLUCODRY_ADAO_MODELS);
function item(key,quantity=1) {
  const [itemId,modelId]=key.split('|');
  return {itemId,modelId,quantity,itemName:'Glucodry',modelName:'Embalagem',
    itemSku:null,modelSku:'AF-GLDR-001KG'};
}
function mapping(key,expected) {
  const [itemId,modelId]=key.split('|');
  return {id:'m-'+modelId,marketplace:'shopee',channel_account_id:ACCOUNT,
    external_item_id:itemId,external_model_id:modelId,
    product_id:PRODUCT,variant_id:null,physical_multiplier:expected.multiplier,
    components:[{product_id:PRODUCT,variant_id:null,physical_multiplier:expected.multiplier,
      physical_identity:{active:true,unit:'g',presentation_factors:[1000]}}]};
}
const mappings=cases.map(([key,contract])=>mapping(key,contract));
function payload(entry,account=ACCOUNT) {
  return {source:'test_fixture',environment:'test',channelAccountId:account,
    orders:[{orderSn:'TEST-'+entry.modelId,createdAt:'2026-11-03T16:00:00Z',
      externalStatus:'READY_TO_SHIP',items:[entry]}]};
}
function preview(entry,ms=mappings,account=ACCOUNT) {
  const p=payload(entry,account);
  const mp=buildShopeeMappingPreview(p,ms,
    {channelAccountId:account,marketplaceAccount:'SHOPEE ADÃO',requirePhysicalValidation:true});
  const projected=buildShopeeOrderProjectionPreview(p,mp,{marketplaceAccount:'SHOPEE ADÃO'});
  return {mp,projected};
}
test('GD1/GD2 are exactly four fractioned models and one original sealed 25kg model',()=>{
  assert.equal(cases.length,5);
  assert.equal(cases.filter(([,v])=>v.kind==='fractioned_g').length,4);
  assert.equal(cases.filter(([,v])=>v.kind==='sealed_sack').length,1);
});
test('GD1 uses grams from opened stock and one KG presentation, Q once, no stock writes',()=>{
  for (const [key,contract] of cases.filter(([,v])=>v.kind==='fractioned_g')) {
    for (const q of [1,2,5]) {
      const {mp,projected}=preview(item(key,q));
      assert.equal(mp.orders[0].items[0].mappingStatus,'recognized',key);
      assert.equal(projected.readyCount,1,key);
      assert.equal(projected.operationalWrites,false);
      assert.equal(projected.writeReady,false);
      const line=projected.orders[0].candidate.items[0];
      assert.equal(line.quantity,contract.multiplier*q);
      assert.equal(line.physicalMultiplier,contract.multiplier);
      assert.equal(line.commercialQuantity,q);
      assert.equal(line.commercialPresentationId,GD1);
      assert.equal(line.variantId,null);
      assert.equal(projected.orders[0].candidate.stockEvent,null);
      const internal=applyShopeeInternalOrderContract(projected.orders[0],{
        channelAccountId:ACCOUNT,marketplaceAccount:'SHOPEE ADÃO'});
      assert.equal(internal.items[0].commercialPresentationId,GD1);
      assert.equal(internal.effects.stockAction,null);
      assert.equal(internal.effects.productionOrderAction,null);
    }
  }
});
test('GD2 one sealed sack is Q=1, never 25,000 loose grams',()=>{
  const [key,contract]=cases.find(([,v])=>v.kind==='sealed_sack');
  const {mp,projected}=preview(item(key,1));
  assert.equal(mp.orders[0].items[0].mappingStatus,'recognized');
  assert.equal(contract.multiplier,1);
  assert.equal(projected.readyCount,1);
  const line=projected.orders[0].candidate.items[0];
  assert.equal(line.commercialPresentationId,GD2);
  assert.equal(line.quantity,1);
  assert.equal(line.physicalQuantity,1);
  assert.equal(line.commercialQuantity,1);
  assert.equal(line.variantId,null);
  assert.equal(projected.orders[0].candidate.stockEvent,null);
  const internal=applyShopeeInternalOrderContract(projected.orders[0],{
    channelAccountId:ACCOUNT,marketplaceAccount:'SHOPEE ADÃO'});
  assert.equal(internal.items[0].commercialPresentationId,GD2);
  assert.equal(internal.items[0].quantity,1);
});
test('GD2 Q>1 fails closed before any ready projection or write',()=>{
  const [key]=cases.find(([,v])=>v.kind==='sealed_sack');
  for(const q of [2,5]) {
    const {mp,projected}=preview(item(key,q));
    assert.equal(mp.orders[0].items[0].mappingStatus,'glucodry_gd2_multiple_sacks_unsupported');
    assert.equal(projected.readyCount,0);
    assert.equal(projected.blockedCount,1);
    assert.equal(projected.operationalWrites,false);
    assert.equal(projected.writeReady,false);
    assert.equal(projected.orders[0].candidate.stockEvent,null);
  }
});
test('five models reject wrong product, variant, unit, multiplier, inactive catalog and foreign scope',()=>{
  for(const [key,contract] of cases) {
    const entry=item(key,1);
    const expected=mapping(key,contract);
    assert.equal(mappingPhysicalBlocker(entry,expected,{channelAccountId:ACCOUNT}),null);
    assert.equal(mappingPhysicalBlocker(entry,expected,{channelAccountId:'other'}),'glucodry_account_unverified');
    for(const change of [
      c=>{c.product_id='wrong';},
      c=>{c.variant_id='wrong';},
      c=>{c.physical_multiplier+=1;},
      c=>{c.physical_identity.unit='un';},
      c=>{c.physical_identity.active=false;},
    ]) {
      const x=mapping(key,contract);
      change(x.components[0]);
      assert.equal(mappingPhysicalBlocker(entry,x,{channelAccountId:ACCOUNT}),'glucodry_physical_identity_unverified',key);
    }
    const extra=mapping(key,contract);extra.components.push({...extra.components[0]});
    assert.equal(mappingPhysicalBlocker(entry,extra,{channelAccountId:ACCOUNT}),'glucodry_composition_invalid');
    const invalid=item(key,0);
    assert.equal(mappingPhysicalBlocker(invalid,expected,{channelAccountId:ACCOUNT}),'physical_quantity_invalid');
  }
});
test('GD1 requires gram-to-kg presentation, not an inferred or different package',()=>{
  const [key,contract]=cases.find(([,v])=>v.kind==='fractioned_g');
  const m=mapping(key,contract);
  m.components[0].physical_identity.presentation_factors=[25000];
  assert.equal(mappingPhysicalBlocker(item(key),m,{channelAccountId:ACCOUNT}),
    'glucodry_fractioned_presentation_unverified');
});
test('unknown old Model or SKU must not fall back and other accounts stay isolated',()=>{
  const baseKey=cases[0][0];
  const unknown=item('23194995930|0');
  const legacy={...mapping(baseKey,cases[0][1]),
    id:'legacy',external_item_id:null,external_model_id:null,
    external_item_key:'sku:af-gldr-001kg|variation:embalagem'};
  for (const itemId of ['23194995930','58272221478']) {
    const {mp,projected}=preview({...unknown,itemId},[...mappings,legacy]);
    assert.equal(mp.orders[0].items[0].mappingStatus,'needs_mapping');
    assert.equal(projected.blockedCount,1);
  }
  const p=payload(item(baseKey),'foreign');
  const mp=buildShopeeMappingPreview(p,mappings,{
    channelAccountId:'foreign',marketplaceAccount:'SHOPEE VIVIANE',requirePhysicalValidation:true});
  assert.equal(mp.orders[0].items[0].mappingStatus,'needs_mapping');
});
