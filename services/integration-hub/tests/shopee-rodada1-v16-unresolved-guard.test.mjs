import test from 'node:test';
import assert from 'node:assert/strict';
import { r1V16UnresolvedBlocker,R1_V16_UNRESOLVED_PAIRS } from '../src/shopee-rodada1-v16-unresolved-guard.mjs';
import { mappingPhysicalBlocker } from '../src/shopee-mapping-physical-guard.mjs';
import { buildShopeeMappingPreview } from '../src/shopee-mapping-preview.mjs';
const ACCOUNT='b4027369-5abf-4ac1-ab24-862334fae892';
const cases=[
  ['22694563769','229443539818','r1_emb2_leite_physical_print_unverified'],
  ['58222235000','219629112211','r1_emb1_six_distinct_prints_unverified'],
  ['21599903629','238794159646','r1_dl1_original_sealed_bucket_unverified'],
];
test('only three specific official pairs are quarantined',()=>{
 assert.equal(Object.keys(R1_V16_UNRESOLVED_PAIRS).length,3);
 for(const[itemId,modelId,reason]of cases){
   assert.equal(r1V16UnresolvedBlocker({itemId,modelId},{channelAccountId:ACCOUNT}),reason);
   assert.equal(r1V16UnresolvedBlocker({itemId,modelId},{channelAccountId:'another-account'}),null);
 }
});
test('even a syntactically valid or incorrectly generic mapping fails closed',()=>{
 for(const[itemId,modelId,reason]of cases){
   const physical= itemId==='21599903629'
     ?{product_id:'d913f0f2-4893-4985-9976-fcd9119a57b1',variant_id:null,physical_multiplier:9800,physical_identity:{active:true,unit:'g',presentation_factors:[9800]}}
     :{product_id:'af7fe3c4-863c-4d1f-9fcd-b4ecb92e5322',variant_id:'ec201054-48db-4230-b3a4-92444c1128ab',physical_multiplier:itemId==='58222235000'?600:1000,physical_identity:{active:true,unit:'un',presentation_factors:[100]}};
   const item={itemId,modelId,quantity:1,itemName:'Produto Shopee',modelName:'9.8 kg'};
   assert.equal(mappingPhysicalBlocker(item,{...physical,components:[physical]},{channelAccountId:ACCOUNT}),reason);
 }
});
test('one unresolved item cannot become recognized through existing official mapping',()=>{
 for(const[itemId,modelId,reason]of cases){
  const mapping={id:'hypothetical',marketplace:'shopee',marketplace_account:'SHOPEE ADÃO',channel_account_id:ACCOUNT,
   external_item_id:itemId,external_model_id:modelId,external_item_key:'official:item:'+itemId+'|model:'+modelId,
   product_id:'af7fe3c4-863c-4d1f-9fcd-b4ecb92e5322',variant_id:null,physical_multiplier:600,
   physical_identity:{active:true,unit:'un',presentation_factors:[100]}};
  const payload={source:'fixture',environment:'test',channelAccountId:ACCOUNT,orders:[{orderSn:'test',createdAt:'2026-11-04T12:00:00Z',items:[{itemId,modelId,quantity:1,itemName:'Product',modelName:'Variation'}]}]};
  const preview=buildShopeeMappingPreview(payload,[mapping],{channelAccountId:ACCOUNT,marketplaceAccount:'SHOPEE ADÃO',requirePhysicalValidation:true});
  assert.equal(preview.orders[0].items[0].mappingStatus,reason);
 }
});
