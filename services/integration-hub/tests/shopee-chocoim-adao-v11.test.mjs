import test from 'node:test';
import assert from 'node:assert/strict';
import { mappingPhysicalBlocker } from '../src/shopee-mapping-physical-guard.mjs';
import { buildShopeeMappingPreview } from '../src/shopee-mapping-preview.mjs';
import { buildShopeeOrderProjectionPreview } from '../src/shopee-order-projection-preview.mjs';

const ACCOUNT = 'b4027369-5abf-4ac1-ab24-862334fae892';
const PRODUCT = 'e01a87f3-615d-4330-87c6-d0f9878a7c3b';
const V = {
  MA: '3e67edc6-1cb7-463e-8c8e-a50bfb5092f7',
  BR: '66708945-22f3-43bf-b68e-127021448cd8',
  MS: '1a84c7f3-4130-45fc-920f-62aecafe4c91',
};
const cases = [
  ['58211753487','189196513020',8,'MA'], ['58211753487','189196513021',8,'BR'],
  ['58211753487','189196513022',8,'MS'],
  ['58211756648','169421459623',20,'MA'], ['58211756648','169421459624',20,'BR'],
  ['58211756648','169421459618',20,'MS'],
  ['58211756648','169421459619',40,'MA'], ['58211756648','169421459620',40,'BR'],
  ['58211756648','169421459621',40,'MS'],
  ['58211756648','169421459622',80,'MA'], ['58211756648','169421459616',80,'BR'],
  ['58211756648','169421459617',80,'MS'],
  ['23199886586','149558245644',40,'MA'], ['23199886586','149558245645',40,'BR'],
  ['23199886586','149558245646',40,'MS'],
];
const scope = {channelAccountId:ACCOUNT};
function item(id,model,quantity=1,sku='AF-CHIM-AT-040-MA') {
  return {itemId:id,modelId:model,quantity,itemName:'Chocoim 34g',modelName:'Cobertura',itemSku:null,modelSku:sku};
}
function mapping(id,model,count,coverage) {
  return {
    id:'map-'+model,marketplace:'shopee',channel_account_id:ACCOUNT,
    external_item_id:id,external_model_id:model,
    product_id:PRODUCT,variant_id:V[coverage],physical_multiplier:count,
    components:[{product_id:PRODUCT,variant_id:V[coverage],physical_multiplier:count,
      physical_identity:{active:true,unit:'un',presentation_factors:[1]}}],
  };
}
const mappings=cases.map(([id,model,count,coverage])=>mapping(id,model,count,coverage));
function payload(entry) {
  return {source:'test_fixture',environment:'test',channelAccountId:ACCOUNT,
    orders:[{orderSn:'TEST-CH-'+entry.modelId,createdAt:'2026-10-31T12:00:00Z',
      externalStatus:'PROCESSED',items:[entry]}]};
}
function previews(entry, knownMappings=mappings) {
  const p=payload(entry);
  const mp=buildShopeeMappingPreview(p,knownMappings,{...scope,requirePhysicalValidation:true});
  const projected=buildShopeeOrderProjectionPreview(p,mp,{marketplaceAccount:'SHOPEE ADÃO'});
  return {mp,projected};
}
test('Chocoim V11: all 15 exact official pairs select the correct finished variant and Q once',()=>{
  for (const [id,model,count,coverage] of cases) {
    for (const q of [1,2,5]) {
      const {mp,projected}=previews(item(id,model,q));
      const line=mp.orders[0].items[0];
      assert.equal(line.mappingStatus,'recognized',model);
      assert.equal(line.components.length,1,model);
      assert.equal(line.components[0].variantId,V[coverage],model);
      assert.equal(line.components[0].physicalMultiplier,count,model);
      assert.equal(line.components[0].physicalQuantity,count*q,model);
      assert.equal(projected.readyCount,1,model);
      assert.equal(projected.operationalWrites,false);
      assert.equal(projected.writeReady,false);
      assert.equal(projected.orders[0].candidate.stockEvent,null);
      assert.equal(projected.orders[0].candidate.items[0].quantity,count*q,model);
      assert.equal(projected.orders[0].candidate.items[0].variantId,V[coverage],model);
    }
  }
});
test('Chocoim V11: physical guard rejects changed variant, multiplier, product, and composition',()=>{
  for (const [id,model,count,coverage] of cases) {
    const original=mapping(id,model,count,coverage);
    assert.equal(mappingPhysicalBlocker(item(id,model),original,scope),null,model);
    const badFactor=mapping(id,model,count+1,coverage);
    assert.equal(mappingPhysicalBlocker(item(id,model),badFactor,scope),'chocoim_physical_identity_unverified',model);
    const wrongVariant=mapping(id,model,count,coverage);
    wrongVariant.components[0].variant_id=V[coverage==='MA'?'BR':'MA'];
    assert.equal(mappingPhysicalBlocker(item(id,model),wrongVariant,scope),'chocoim_physical_identity_unverified',model);
    const wrongProduct=mapping(id,model,count,coverage);
    wrongProduct.components[0].product_id='wrong';
    assert.equal(mappingPhysicalBlocker(item(id,model),wrongProduct,scope),'chocoim_physical_identity_unverified',model);
    const composition=mapping(id,model,count,coverage);
    composition.components.push({...composition.components[0]});
    assert.equal(mappingPhysicalBlocker(item(id,model),composition,scope),'chocoim_composition_invalid',model);
    assert.equal(mappingPhysicalBlocker(item(id,model),original,{channelAccountId:'another'}),'chocoim_account_unverified',model);
  }
});
test('Chocoim historical MA models and model_id=0 are never recoded as current coverage/quantity',()=>{
  const old = [
    ['58211753487','239444114277'],
    ['58211756648','219628938720'],['58211756648','219628938721'],
    ['58211756648','219628938719'],['23199886586','209196500514'],
    ['58211756648','169416812868'],['58211756648','0'],
  ];
  for (const [id,model] of old) {
    const {mp,projected}=previews(item(id,model));
    assert.equal(mp.orders[0].items[0].mappingStatus,'needs_mapping',model);
    assert.equal(projected.blockedCount,1,model);
  }
});
test('Inactive CH3 shares seller SKU but must not resolve to active CH3 or legacy SKU fallback',()=>{
  const inactive=item('58221938973','238816769245',1,'AF-CHIM-AT-040-MA');
  const legacy={...mapping('23199886586','149558245644',40,'MA'),
    id:'legacy-sku',external_item_id:null,external_model_id:null,
    external_item_key:'sku:af-chim-at-040-ma|variation:cobertura'};
  const {mp,projected}=previews(inactive,[...mappings,legacy]);
  assert.equal(mp.orders[0].items[0].mappingStatus,'needs_mapping');
  assert.equal(projected.blockedCount,1);
  // The wrong historical CH3 Item ID is not a current official identity either.
  assert.equal(previews(item('23999865685','149558245644')).mp.orders[0].items[0].mappingStatus,'needs_mapping');
});
test('Foreign account cannot inherit any Chocoim Adão official mapping',()=>{
  const p=payload(item('23199886586','149558245644'));
  p.channelAccountId='another-account';
  const mp=buildShopeeMappingPreview(p,mappings,{channelAccountId:'another-account',requirePhysicalValidation:true});
  assert.equal(mp.orders[0].items[0].mappingStatus,'needs_mapping');
});
