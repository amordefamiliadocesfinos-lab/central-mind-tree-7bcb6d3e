import test from 'node:test';
import assert from 'node:assert/strict';
import { mappingPhysicalBlocker } from '../src/shopee-mapping-physical-guard.mjs';
import { buildShopeeMappingPreview } from '../src/shopee-mapping-preview.mjs';
import { buildShopeeOrderProjectionPreview } from '../src/shopee-order-projection-preview.mjs';

const ACCOUNT_ID = 'b4027369-5abf-4ac1-ab24-862334fae892';
const PRODUCT_ID = 'c177f332-a1c7-4276-9cef-7b81af920174';
const E24 = 'a3400000-0000-4000-8000-000000002400';
const cases = [
  ['22894540357','159549469456',350],
  ['22894540357','159549469457',1000],
  ['22894540357','159549469458',2000],
  ['22894540357','239443947635',3000],
  ['23899023961','149554596204',1000],
  ['58211774121','199622620371',1],
];
const scope = {channelAccountId: ACCOUNT_ID};
function item(itemId,modelId,quantity=1) {
  return {itemId,modelId,quantity,itemName:'Amendoim Torrado',modelName:'Embalagem',itemSku:null,modelSku:null};
}
function mapping(itemId,modelId,multiplier) {
  return {
    id:'map-'+modelId,marketplace:'shopee',channel_account_id:ACCOUNT_ID,
    external_item_id:itemId,external_model_id:modelId,product_id:PRODUCT_ID,
    variant_id:null,physical_multiplier:multiplier,
    components:[{product_id:PRODUCT_ID,variant_id:null,physical_multiplier:multiplier,
      physical_identity:{active:true,unit:'g',presentation_factors:[350,1000,2000,3000,1]}}],
  };
}
function payload(entry) {
  return {source:'test_fixture',environment:'test',channelAccountId:ACCOUNT_ID,
    orders:[{orderSn:'TEST-AM-'+entry.modelId,createdAt:'2026-10-31T12:00:00Z',externalStatus:'PROCESSED',
      items:[entry]}]};
}
const mappings=cases.map(([i,m,mul])=>mapping(i,m,mul));

test('AM1 and AM2 six official identities pass physical guard only for exact product and factors',()=>{
  for(const [i,m,mul] of cases){
    assert.equal(mappingPhysicalBlocker(item(i,m),mapping(i,m,mul),scope),null,m);
    assert.equal(mappingPhysicalBlocker(item(i,m),mapping(i,m,mul+1),scope),'amendoim_physical_identity_unverified',m);
    assert.equal(mappingPhysicalBlocker(item(i,m),mapping(i,m,mul),{channelAccountId:'other'}),'amendoim_account_unverified',m);
    const wrong=mapping(i,m,mul);wrong.components[0].product_id='wrong';
    assert.equal(mappingPhysicalBlocker(item(i,m),wrong,scope),'amendoim_physical_identity_unverified',m);
  }
});

test('AM1 and AM2 correct multipliers, Q is applied exactly once, never writes',()=>{
  for(const [i,m,mul] of cases.slice(0,5)){
    for(const Q of [1,2,5]){
      const p=payload(item(i,m,Q));
      const mp=buildShopeeMappingPreview(p,mappings,{channelAccountId:ACCOUNT_ID,requirePhysicalValidation:true});
      const got=mp.orders[0].items[0];
      assert.equal(got.mappingStatus,'recognized',m);
      assert.equal(got.components[0].physicalMultiplier,mul);
      assert.equal(got.components[0].physicalQuantity,Q*mul);
      const projected=buildShopeeOrderProjectionPreview(p,mp,{marketplaceAccount:'SHOPEE ADÃO'});
      assert.equal(projected.readyCount,1,m);
      assert.equal(projected.operationalWrites,false);
      assert.equal(projected.writeReady,false);
      assert.equal(projected.orders[0].candidate.stockEvent,null);
      assert.equal(projected.orders[0].candidate.items[0].quantity,Q*mul);
    }
  }
});

test('AM3 projects sealed E24 as whole sacks, not 24000g or EG',()=>{
  for(const Q of [1,2]){
    const p=payload(item('58211774121','199622620371',Q));
    const mp=buildShopeeMappingPreview(p,mappings,{channelAccountId:ACCOUNT_ID,requirePhysicalValidation:true});
    const out=buildShopeeOrderProjectionPreview(p,mp,{marketplaceAccount:'SHOPEE ADÃO'});
    assert.equal(out.readyCount,1);
    const line=out.orders[0].candidate.items[0];
    assert.equal(line.commercialPresentationId,E24);
    assert.equal(line.physicalQuantity,Q);
    assert.equal(line.commercialQuantity,Q);
    assert.equal(line.variantId,null);
  }
});

test('unknown official model including zero does not fall back to title or SKU',()=>{
  for(const modelId of ['0','999999']){
    const p=payload(item('22894540357',modelId));
    const mp=buildShopeeMappingPreview(p,mappings,{channelAccountId:ACCOUNT_ID,requirePhysicalValidation:true});
    assert.equal(mp.orders[0].items[0].mappingStatus,'needs_mapping');
    assert.equal(buildShopeeOrderProjectionPreview(p,mp,{marketplaceAccount:'SHOPEE ADÃO'}).blockedCount,1);
  }
});

test('foreign Shopee account cannot recognize Adão mappings',()=>{
  const p=payload(item('58211774121','199622620371'));
  p.channelAccountId='another-account';
  const mp=buildShopeeMappingPreview(p,mappings,{channelAccountId:'another-account',requirePhysicalValidation:true});
  assert.equal(mp.orders[0].items[0].mappingStatus,'needs_mapping');
});
