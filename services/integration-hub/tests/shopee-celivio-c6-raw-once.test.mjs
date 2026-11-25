import test from 'node:test';
import assert from 'node:assert/strict';
import { createCelivioC4ERawOnce, CELIVIO_C6_TARGET_ORDER_SN } from '../src/shopee-celivio-c4e-raw-once.mjs';
import { handleRequest } from '../src/app.mjs';

const NOW=Date.parse('2026-11-25T17:00:00Z');
const TARGET='2611258Y00VM5U';
const ACCOUNT='d26c7a30-aa4a-4441-8012-600d70453689';
const env=name=>({
  SHOPEE_LIVE_PARTNER_KEY:'MOCK_PARTNER',
  SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY:'MOCK_ENCRYPTION'
})[name];
const connection={ok:true,payload:{shop_id:1357031949,partner_id:2047685,
  access_token_ciphertext:'mock_ciphertext',
  access_token_expires_at:new Date(NOW+3600000).toISOString()}};
const detail=({status='READY_TO_SHIP',sn=TARGET}={})=>({
  response:{ok:true},payload:{response:{order_list:[{
    order_sn:sn,order_status:status,create_time:1795626000,
    buyer_username:'PRIVATE CUSTOMER',recipient_address:{phone:'PRIVATE'},
    item_list:[{item_id:'23899104846',model_id:'109872347445',
      model_quantity_purchased:1,item_name:'Biscoito para Alfajor',
      model_name:'3 PACOTE 66 UNI,BISCOITO TRADICIONAL',
      model_sku:'PRIVATE SKU'}]
  }]}}
});
function makeRun(overrides={}){
  let upserts=0,details=0;
  const run=createCelivioC4ERawOnce({
    now:()=>NOW,getEnv:env,targetOrderSn:TARGET,
    readConnection:async({channel_account_id})=>{
      assert.equal(channel_account_id,ACCOUNT);return connection;},
    decryptToken:async()=> 'mock_token',
    listOrders:async()=>{throw Error('must not list orders');},
    detailOrders:async(args)=>{details++;assert.deepEqual(args.orderSnList,[TARGET]);
      return detail(overrides);},
    persistSnapshot:async(args)=>{upserts++;
      assert.equal(args.channel_account_id,ACCOUNT);
      assert.equal(args.external_entity_id,TARGET);
      assert.match(args.payload_hash,/^[a-f0-9]{64}$/);
      assert.equal(JSON.stringify(args.payload).includes('PRIVATE'),false);
      assert.equal(args.payload.response.order_list[0].item_list[0].model_id,'109872347445');
      return {ok:true};}
  });
  return {run,getCounts:()=>({upserts,details})};
}

test('C6 scoped source captures only one specific redacted Raw and no operational write',async()=>{
  assert.equal(CELIVIO_C6_TARGET_ORDER_SN,TARGET);
  const {run,getCounts}=makeRun();
  const result=await run();
  assert.equal(result.ok,true);
  assert.equal(result.order_sn,TARGET);
  assert.deepEqual(getCounts(),{upserts:1,details:1});
  assert.equal(result.orders_written,0);
  assert.equal(result.items_written,0);
  assert.equal(result.separation_written,0);
  assert.equal(result.stock_written,0);
  assert.equal(result.raw_insert_count_unverified,true);
});
test('C6 status drift blocks Raw',async()=>{
  const {run,getCounts}=makeRun({status:'UNPAID'});
  assert.equal((await run()).code,'order_detail_not_eligible');
  assert.deepEqual(getCounts(),{upserts:0,details:1});
});
test('C6 refuses any caller or injected arbitrary target',async()=>{
  const run=createCelivioC4ERawOnce({
    targetOrderSn:'UNREVIEWED123',now:()=>NOW,getEnv:env,
    readConnection:async()=>connection,
    decryptToken:async()=> 'mock_token',
    detailOrders:async()=>{throw Error('unexpected call');},
    persistSnapshot:async()=>{throw Error('unexpected Raw');},
  });
  assert.equal((await run()).code,'target_not_allowlisted');
});
test('C6 route is default OFF, has no caller-selected inputs and is independently gated',async()=>{
  const route={path:'/internal/shopee/celivio/c6/raw-once',method:'POST',headers:{}};
  let calls=0;
  const deps={handleShopeeLive:async()=>null,
    getEnv:()=>undefined,
    captureCelivioC6:async()=>{calls++;return {ok:true,raw_persist_attempted:1};}};
  assert.equal(JSON.parse((await handleRequest(route,deps)).body).code,'c6_not_enabled');
  assert.equal((await handleRequest({...route,body:'{}'},deps)).status,400);
  assert.equal((await handleRequest({...route,query:{order:TARGET}},deps)).status,400);
  assert.equal((await handleRequest({...route,method:'GET'},deps)).status,405);
  assert.equal(calls,0);
  const allowed={...deps,getEnv:n=>n==='SHOPEE_CELIVIO_C6_RAW_ONCE_ENABLED'?'true':undefined};
  assert.equal((await handleRequest(route,allowed)).status,200);
  assert.equal(calls,1);
});
