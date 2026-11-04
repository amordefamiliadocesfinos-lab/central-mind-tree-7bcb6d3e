import test from 'node:test';
import assert from 'node:assert/strict';
import {ITALAC_ADAO_ACCOUNT,ITALAC_R2_V17_MODELS,ITALAC_R2_V17_BLOCK,ITALAC_R2_V17_BOX_BLOCK,italacR2V17PhysicalBlocker,italacR2V17ReservedIdentity} from '../src/shopee-rodada2-v17-italac-guard.mjs';
import {mappingPhysicalBlocker} from '../src/shopee-mapping-physical-guard.mjs';
import {buildShopeeMappingPreview} from '../src/shopee-mapping-preview.mjs';
const PAIRS=[['22494563568','229430754376',3],['22494563568','229430754377',6],['22494563568','229430754374',9],['22494563568','229430754375',12],['23695375744','169421574726',27]];
const PROD='0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b';
function preview(item,mappings=[]){
 const payload={source:'fixture',environment:'test',channelAccountId:ITALAC_ADAO_ACCOUNT,orders:[{orderSn:'R2-IT',items:[item]}]};
 return buildShopeeMappingPreview(payload,mappings,{channelAccountId:ITALAC_ADAO_ACCOUNT,marketplaceAccount:'SHOPEE ADÃO',requirePhysicalValidation:true}).orders[0].items[0];
}
test('five exact contracts and quantities',()=>{
 assert.equal(Object.keys(ITALAC_R2_V17_MODELS).length,5);
 for(const [itemId,modelId,n] of PAIRS){
  const c=ITALAC_R2_V17_MODELS[itemId+'|'+modelId];
  assert.equal(c.units395g,n);
  assert.equal(c.grams,n*395);
 }
});
test('unopened packages cannot be inferred from stock in grams',()=>{
 for(const [itemId,modelId,n] of PAIRS){
  const item={itemId,modelId,quantity:1,itemName:'Italac',modelName:n+' x 395g'};
  const reason=n===27?ITALAC_R2_V17_BOX_BLOCK:ITALAC_R2_V17_BLOCK;
  const mapping={id:'fake',marketplace:'shopee',marketplace_account:'SHOPEE ADÃO',channel_account_id:ITALAC_ADAO_ACCOUNT,external_item_id:itemId,external_model_id:modelId,product_id:PROD,physical_multiplier:n*395,physical_identity:{active:true,unit:'g',presentation_factors:[395,10665]}};
  assert.equal(italacR2V17PhysicalBlocker(item,{channelAccountId:ITALAC_ADAO_ACCOUNT}),reason);
  assert.equal(mappingPhysicalBlocker(item,mapping,{channelAccountId:ITALAC_ADAO_ACCOUNT}),reason);
  assert.equal(preview(item,[mapping]).mappingStatus,reason);
 }
});
test('unknown model and legacy aliases are not recognized',()=>{
 for(const [itemId,modelId] of PAIRS){
  const item={itemId,modelId,quantity:1,itemName:'Italac',modelName:'395g'};
  assert.equal(preview(item).mappingStatus,'needs_mapping');
  assert.equal(preview({...item,modelId:'unpublished'}).mappingStatus,'needs_mapping');
  assert.equal(italacR2V17ReservedIdentity(item,{channelAccountId:ITALAC_ADAO_ACCOUNT}),true);
 }
 assert.equal(italacR2V17ReservedIdentity({modelSku:'AF-MLIT-027CX'},{channelAccountId:ITALAC_ADAO_ACCOUNT}),true);
 assert.equal(italacR2V17ReservedIdentity({modelSku:'AF-OTHER'},{channelAccountId:ITALAC_ADAO_ACCOUNT}),false);
 assert.equal(italacR2V17ReservedIdentity({itemId:'22494563568'},{channelAccountId:'other'}),false);
});
