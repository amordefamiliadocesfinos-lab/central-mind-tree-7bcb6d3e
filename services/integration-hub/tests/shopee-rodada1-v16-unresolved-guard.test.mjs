import test from 'node:test';
import assert from 'node:assert/strict';
import {r1V16UnresolvedBlocker,R1_V16_UNRESOLVED_PAIRS} from '../src/shopee-rodada1-v16-unresolved-guard.mjs';
import {mappingPhysicalBlocker} from '../src/shopee-mapping-physical-guard.mjs';
import {buildShopeeMappingPreview} from '../src/shopee-mapping-preview.mjs';
const ACCOUNT='b4027369-5abf-4ac1-ab24-862334fae892';
const itemId='21599903629',modelId='238794159646';
const reason='r1_dl1_original_sealed_bucket_unverified';
test('original sealed Ivoti bucket remains the sole quarantined R1 V16 pair',()=>{
 assert.deepEqual(Object.keys(R1_V16_UNRESOLVED_PAIRS),[itemId+'|'+modelId]);
 assert.equal(r1V16UnresolvedBlocker({itemId,modelId},{channelAccountId:ACCOUNT}),reason);
 assert.equal(r1V16UnresolvedBlocker({itemId,modelId},{channelAccountId:'other'}),null);
});
test('even 9800 loose grams do not authorize an original sealed bucket',()=>{
 const comp={product_id:'d913f0f2-4893-4985-9976-fcd9119a57b1',variant_id:null,physical_multiplier:9800,physical_identity:{active:true,unit:'g',presentation_factors:[9800]}};
 assert.equal(mappingPhysicalBlocker({itemId,modelId,quantity:1}, {...comp,components:[comp]}, {channelAccountId:ACCOUNT}),reason);
 const mapping={id:'fake',marketplace:'shopee',marketplace_account:'SHOPEE ADÃO',channel_account_id:ACCOUNT,external_item_id:itemId,external_model_id:modelId,product_id:comp.product_id,variant_id:null,physical_multiplier:9800,physical_identity:comp.physical_identity};
 const norm={source:'fixture',environment:'test',channelAccountId:ACCOUNT,orders:[{orderSn:'test',createdAt:'2026-11-04T12:00:00Z',items:[{itemId,modelId,quantity:1,itemName:'Ivoti',modelName:'9.8kg'}]}]};
 assert.equal(buildShopeeMappingPreview(norm,[mapping],{channelAccountId:ACCOUNT,marketplaceAccount:'SHOPEE ADÃO',requirePhysicalValidation:true}).orders[0].items[0].mappingStatus,reason);
});
