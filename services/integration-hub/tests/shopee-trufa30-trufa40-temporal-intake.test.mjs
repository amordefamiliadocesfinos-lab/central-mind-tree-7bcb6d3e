import test from 'node:test';
import assert from 'node:assert/strict';
import { createShopeeControlledAutoIntake } from '../src/shopee-order-auto-intake.mjs';

const ACCOUNT='b4027369-5abf-4ac1-ab24-862334fae892';
const CASES=[
  ...['229425631222','229425631223','229425631224','229425631225','229425631226'].map(modelId=>['22898142109',modelId,'trufa30_reused_model_temporal_identity_unverified']),
  ['19598189256','159546591760','trufa40_historical_model_identity_unverified'],
  ...['238789009560','238789009561','238789009562'].map(modelId=>['21999552311',modelId,'trufa40_historical_model_identity_unverified']),
  ['22193668881','238778628464','trufa40_historical_model_identity_unverified'],
  ...['109869648890','109869648891'].map(modelId=>['22393654582',modelId,'trufa40_historical_model_identity_unverified']),
];
function snapshot(itemId,modelId) {
  const orderSn='historic-sample';
  return {source:'shopee_open_platform',environment:'live',external_entity_type:'order',
    endpoint:'/api/v2/order/get_order_detail',external_entity_id:orderSn,
    channel_account_id:ACCOUNT,observed_at:'2026-10-29T15:00:00Z',
    payload:{response:{order_list:[{order_sn:orderSn,create_time:1793260800,
      item_list:[{item_id:Number(itemId),model_id:Number(modelId),
        model_quantity_purchased:1,model_name:'untrusted current name'}]}]}}};
}
test('controlled intake fails closed for all 12 historical T30/T40 pairs even in commit mode',async()=>{
  for(const [itemId,modelId,expected] of CASES){
    let writes=0;
    const run=createShopeeControlledAutoIntake({
      readBatch:async()=>({ok:true,status:200,payload:{
        marketplace_account:'SHOPEE ADÃO',snapshots:[snapshot(itemId,modelId)],mappings:[]}}),
      persistOrder:async()=>{writes++;throw Error('must not write');},
    });
    const result=await run({channelAccountId:ACCOUNT,mode:'commit'});
    assert.equal(result.blocked,1,modelId);
    assert.equal(result.written,0,modelId);
    assert.equal(writes,0,modelId);
    assert.deepEqual(result.results[0].blockers,[expected],modelId);
  }
});
