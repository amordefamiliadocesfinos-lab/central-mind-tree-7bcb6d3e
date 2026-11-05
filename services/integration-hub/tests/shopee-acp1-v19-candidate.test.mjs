import test from 'node:test';
import assert from 'node:assert/strict';
import {
 ACP1_ACCOUNT,ACP1_ITEM,ACP1_PRODUCT,ACP1_VARIANTS,ACP1_MODELS,
 ACP1_HISTORICAL_MODEL,acp1Candidate
} from '../src/shopee-acp1-v19-candidate-contract.mjs';
import {buildShopeeMappingPreview} from '../src/shopee-mapping-preview.mjs';
import {buildShopeeOrderProjectionPreview} from '../src/shopee-order-projection-preview.mjs';

function recognizedCandidate({modelId,components},q=2){
 const normalized={source:'synthetic_test_only',environment:'test',channelAccountId:ACP1_ACCOUNT,
  orders:[{orderSn:'ACP1-SYNTHETIC-'+modelId,createdAt:'2026-11-05T16:00:00.000Z',
   items:[{itemId:ACP1_ITEM,modelId,quantity:q,discountedUnitPrice:29.99,
     itemName:'Caixa Presente 8 Alfajores',modelName:ACP1_MODELS[modelId].label}]}]};
 const mapping={id:'candidate-'+modelId,marketplace:'shopee',
  marketplace_account:'SHOPEE ADÃO',channel_account_id:ACP1_ACCOUNT,
  external_item_id:ACP1_ITEM,external_model_id:modelId,external_item_key:'official:item:'+ACP1_ITEM+'|model:'+modelId,
  product_id:ACP1_PRODUCT,variant_id:null,physical_multiplier:8,
  components:components.map(c=>({...c,physical_identity:{active:true,unit:'un',presentation_factors:[1]}}))};
 const recognized=buildShopeeMappingPreview(normalized,[mapping],{channelAccountId:ACP1_ACCOUNT,
  marketplaceAccount:'SHOPEE ADÃO',requirePhysicalValidation:true});
 const projected=buildShopeeOrderProjectionPreview(normalized,recognized,{marketplaceAccount:'SHOPEE ADÃO'});
 return {normalized,recognized,projected};
}
test('ACP1 exact three current models: eight finished alfajores each, colors exact, no accidental gross-weight mapping',()=>{
 for (const [modelId,expected] of Object.entries(ACP1_MODELS)){
   const q=2;
   const contract=acp1Candidate({itemId:ACP1_ITEM,modelId,quantity:q},ACP1_ACCOUNT);
   assert.equal(contract.blocker,'acp1_v19_packaging_identity_not_homologated');
   assert.equal(contract.operationalMappingReady,false);
   assert.equal(contract.foodGrams,960);
   assert.equal(contract.grossShippingGrams,1600);
   assert.equal(contract.components.reduce((sum,c)=>sum+c.physical_multiplier,0),8);
   assert.deepEqual(contract.components.map(c=>c.variant_id),
      [expected.white?ACP1_VARIANTS.branco:null,expected.dark?ACP1_VARIANTS.meioAmargo:null].filter(Boolean));
   const {recognized,projected}=recognizedCandidate({modelId,components:contract.components},q);
   assert.equal(recognized.orders[0].items[0].mappingStatus,'recognized');
   assert.equal(projected.orders[0].projectionStatus,'ready');
   assert.equal(projected.operationalWrites,false);
   const lines=projected.orders[0].candidate.items;
   assert.deepEqual(lines.map(l=>l.quantity),contract.components.map(c=>c.physical_multiplier*q));
   assert.equal(lines.reduce((sum,l)=>sum+l.quantity,0),16);
   assert.equal(lines.filter(l=>l.productId!==ACP1_PRODUCT).length,0);
   assert.ok(Math.abs(lines.reduce((sum,l)=>sum+l.commercialQuantity*l.unitPrice,0)-59.98)<1e-9);
 }
});
test('unknown or historical model cannot inherit V19 and another shop cannot reuse Adão identities',()=>{
 for(const modelId of [ACP1_HISTORICAL_MODEL,'0','999999999999']){
  assert.equal(acp1Candidate({itemId:ACP1_ITEM,modelId,quantity:1},ACP1_ACCOUNT)?.blocked,
    'acp1_v19_unknown_or_historical_model');
 }
 assert.equal(acp1Candidate({itemId:ACP1_ITEM,modelId:'189196728216',quantity:1},'other'),null);
 assert.equal(acp1Candidate({itemId:'999999',modelId:'189196728216',quantity:1},ACP1_ACCOUNT),null);
});
test('invalid quantity never turns into physical units; candidate never authorizes writes before packaging decision',()=>{
 for(const quantity of [0,-1,1.5,Infinity,100001]) {
   assert.equal(acp1Candidate({itemId:ACP1_ITEM,modelId:'189196728218',quantity},ACP1_ACCOUNT)?.blocked,
    'acp1_v19_invalid_offer_quantity');
 }
 for(const modelId of Object.keys(ACP1_MODELS)){
  assert.equal(acp1Candidate({itemId:ACP1_ITEM,modelId,quantity:1},ACP1_ACCOUNT).operationalMappingReady,false);
 }
});
