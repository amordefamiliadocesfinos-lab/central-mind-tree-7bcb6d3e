import test from 'node:test';
import assert from 'node:assert/strict';
import {R2_ADAO_ACCOUNT_ID,R2_ORIGINAL_MODELS,r2OriginalContract} from '../src/shopee-r2-original-p4-contract.mjs';
import {buildShopeeMappingPreview} from '../src/shopee-mapping-preview.mjs';
import {buildShopeeOrderProjectionPreview} from '../src/shopee-order-projection-preview.mjs';
import {applyShopeeInternalOrderContract} from '../src/shopee-internal-order-contract.mjs';
import {buildShopeeOrderCreateRequest} from '../src/shopee-order-writer.mjs';

const ACCOUNT='SHOPEE ADÃO';
const K=Object.entries(R2_ORIGINAL_MODELS);
function mk(key,contract,q=2) {
  const [itemId,modelId]=key.split('|');
  return {
    orderSn:'SAFE-'+modelId,
    normalized:{orderSn:'SAFE-'+modelId,externalStatus:'PROCESSED',createdAt:'2026-11-05T12:00:00.000Z',
      totalAmount:30,paymentMethod:'Pix',items:[{itemId,modelId,itemName:'Original published offer',modelName:'',itemSku:'',modelSku:'',quantity:q,
        originalUnitPrice:15,discountedUnitPrice:15}]},
    mapping:{id:'mapping-'+modelId,marketplace:'shopee',marketplace_account:ACCOUNT,channel_account_id:R2_ADAO_ACCOUNT_ID,
      external_item_id:itemId,external_model_id:modelId,
      product_id:contract.productId,variant_id:null,physical_multiplier:contract.modelGrams,
      components:[{product_id:contract.productId,variant_id:null,physical_multiplier:contract.modelGrams,
        physical_identity:{active:true,unit:'g',presentation_factors:[contract.presentationFactor]}}]},
  };
}
function preview(record,account=R2_ADAO_ACCOUNT_ID) {
  const n={source:'shopee_open_platform',environment:'live',channelAccountId:account,orders:[record.normalized]};
  const m=buildShopeeMappingPreview(n,[record.mapping],{channelAccountId:account,marketplaceAccount:ACCOUNT,requirePhysicalValidation:true});
  const proj=buildShopeeOrderProjectionPreview(n,m,{marketplaceAccount:ACCOUNT});
  return {n,m,proj};
}
test('all seven official Adão models resolve exact original unit/box/package without any writer',()=>{
  for(const [key,c] of K){
    const record=mk(key,c,2),{m,proj}=preview(record);
    assert.equal(m.orders[0].items[0].mappingStatus,'recognized',key);
    assert.equal(proj.orders[0].projectionStatus,'ready',key);
    assert.equal(proj.operationalWrites,false);
    assert.equal(proj.writeReady,false);
    const line=proj.orders[0].candidate.items[0];
    assert.equal(line.commercialPresentationId,c.presentationId,key);
    assert.equal(line.quantity,2*c.modelGrams,key);
    assert.equal(line.commercialQuantity,2*c.unitsPerOffer,key);
    assert.equal(line.physicalMultiplier,c.presentationFactor,key);
    assert.equal(line.commercialQuantity*line.physicalMultiplier,line.quantity,key);
    assert.ok(Math.abs(line.commercialQuantity*line.unitPrice - 30)<0.000001,key);
    const request=buildShopeeOrderCreateRequest(applyShopeeInternalOrderContract(proj.orders[0],{
      channelAccountId:R2_ADAO_ACCOUNT_ID,marketplaceAccount:ACCOUNT}));
    assert.equal(request.items[0].commercial_presentation_id,c.presentationId);
    assert.equal(request.items[0].quantity,line.quantity);
    assert.equal(request.items[0].commercial_quantity,line.commercialQuantity);
    assert.equal(request.items[0].physical_multiplier,line.physicalMultiplier);
  }
});
test('unknown/historical and cross-account identities do not silently reuse seven original contracts',()=>{
  const [key,c]=K[0];
  const wrong=mk(key,c);wrong.normalized.items[0].modelId='999999999999';
  assert.equal(preview(wrong).m.orders[0].items[0].mappingStatus,'needs_mapping');
  assert.equal(preview(mk(key,c),'OTHER-ACCOUNT').m.orders[0].items[0].mappingStatus,'needs_mapping');
  assert.equal(r2OriginalContract({itemId:'58211483673',modelId:'999'},R2_ADAO_ACCOUNT_ID),null);
  assert.equal(r2OriginalContract({itemId:'none',modelId:'none'},R2_ADAO_ACCOUNT_ID),null);
});
test('wrong physical identity, forged multiplier or missing active presentation fail closed',()=>{
  const [key,c]=K[0];
  for(const mutate of [
    x=>x.mapping.components[0].physical_multiplier=1,
    x=>x.mapping.components[0].product_id='other',
    x=>x.mapping.components[0].physical_identity.active=false,
    x=>x.mapping.components[0].physical_identity.presentation_factors=[],
    x=>x.mapping.components.push({...x.mapping.components[0]}),
  ]){
    const record=mk(key,c);mutate(record);
    const {m,proj}=preview(record);
    assert.notEqual(m.orders[0].items[0].mappingStatus,'recognized');
    assert.equal(proj.orders[0].projectionStatus,'blocked');
    assert.equal(proj.orders[0].candidate.items.length,0);
  }
});
test('invalid external quantities are not projected as original packages',()=>{
  const [key,c]=K[0];
  for(const q of [0,-1,0.5,Infinity,1e12]) {
    const record=mk(key,c,q);const {proj}=preview(record);
    assert.equal(proj.orders[0].projectionStatus,'blocked',String(q));
  }
});
