import test from 'node:test';
import assert from 'node:assert/strict';
import { createCelivioC4ERawOnce, selectCelivioEligibleOrder,
  prepareCelivioRedactedDetail, CELIVIO_C4E_ACCOUNT, CELIVIO_C4E_TARGET_ORDER_SN }
  from '../src/shopee-celivio-c4e-raw-once.mjs';
import {handleRequest} from '../src/app.mjs';

const NOW=Date.parse('2026-11-24T13:40:00Z');
const SN='2611245JCGC011';
const TARGET='261121TBS6BHE6';
const c=(changes={})=>({ok:true,payload:{shop_id:1357031949,
  partner_id:2047685,access_token_ciphertext:'cipher',
  access_token_expires_at:new Date(NOW+3600000).toISOString(),...changes}});
const env=(name)=>({
  SHOPEE_LIVE_PARTNER_KEY:'MOCK_PARTNER_KEY',
  SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY:'MOCK_CRYPTO_KEY',
})[name];
const list=(status='READY_TO_SHIP')=>({response:{ok:true},payload:{response:{
  order_list:[{order_sn:SN,order_status:'UNPAID'},{order_sn:TARGET,order_status:status}],
}}});
const detail=(status='READY_TO_SHIP')=>({response:{ok:true},payload:{response:{order_list:[{
  order_sn:TARGET,order_status:status,create_time:1795527600,
  buyer_username:'PRIVATE NAME',recipient_address:{phone:'PRIVATE PHONE'},
  item_list:[{item_id:'23499115129',model_id:'239430912885',
    model_quantity_purchased:1,item_name:'Chocolate Cobertura Diehl',
    model_name:'5 KG, COBERTURA MEIO AMARGO', model_sku:'PRIVATE SKU'}],
}]}}});

test('selects only first eligible order in bounded page, never UNPAID',()=>{
  assert.equal(selectCelivioEligibleOrder(list().payload).orderSn,TARGET);
  assert.equal(selectCelivioEligibleOrder(list('UNPAID').payload).code,'no_eligible_order_in_first_page');
  assert.equal(selectCelivioEligibleOrder({response:{order_list:Array(6).fill({})}}).code,'order_list_invalid');
});

test('redacted Raw strips buyer, address, sku and payment fields',()=>{
  const value=prepareCelivioRedactedDetail(detail().payload.response.order_list[0],TARGET);
  assert.equal(value.ok,true);
  const body=JSON.stringify(value.payload);
  assert.equal(body.includes('PRIVATE'),false);
  assert.equal(body.includes('buyer_username'),false);
  assert.equal(body.includes('recipient_address'),false);
  assert.equal(body.includes('model_sku'),false);
  assert.equal(value.payload.response.order_list[0].item_list[0].model_quantity_purchased,1);
  assert.equal(prepareCelivioRedactedDetail(detail('UNPAID').payload.response.order_list[0],TARGET).ok,false);
});

test('successful isolated route makes at most one order-detail call and one idempotent Core Raw upsert',async()=>{
  const calls=[];let rawArgs;
  const run=createCelivioC4ERawOnce({now:()=>NOW,getEnv:env,
    readConnection:async({channel_account_id})=>{assert.equal(channel_account_id,CELIVIO_C4E_ACCOUNT);return c();},
    decryptToken:async()=> 'mock',
    listOrders:async()=>{throw Error('exact target must not list unrelated orders');},
    detailOrders:async(args)=>{calls.push('detail');assert.deepEqual(args.orderSnList,[TARGET]);return detail();},
    persistSnapshot:async(args)=>{calls.push('raw');rawArgs=args;return {ok:true};},
  });
  const result=await run();
  assert.equal(result.ok,true);
  assert.equal(result.raw_persist_attempted,1);
  assert.equal(result.raw_insert_count_unverified,true);
  assert.equal(result.orders_written,0);
  assert.equal(result.stock_written,0);
  assert.deepEqual(calls,['detail','raw']);
  assert.equal(rawArgs.channel_account_id,CELIVIO_C4E_ACCOUNT);
  assert.equal(rawArgs.external_entity_id,TARGET);
  assert.match(rawArgs.payload_hash,/^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(rawArgs).includes('PRIVATE'),false);
  assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
});

test('refuses expired access without refresh, cross-account identity and UNPAID detail without Raw',async()=>{
  for(const override of [
    {connection:c({access_token_expires_at:new Date(NOW-1000).toISOString()}),expected:'access_token_expired_no_refresh'},
    {connection:c({shop_id:1156446003}),expected:'identity_mismatch'},
  ]){
    const run=createCelivioC4ERawOnce({now:()=>NOW,getEnv:env,
      readConnection:async()=>override.connection,
      decryptToken:async()=>{throw Error('unexpected');},
      listOrders:async()=>{throw Error('unexpected');},
      persistSnapshot:async()=>{throw Error('unexpected');}});
    assert.equal((await run()).code,override.expected);
  }
  const run=createCelivioC4ERawOnce({now:()=>NOW,getEnv:env,
    readConnection:async()=>c(),decryptToken:async()=> 'mock',
    listOrders:async()=>{throw Error('unexpected list');},
    detailOrders:async()=>detail('UNPAID'),
    persistSnapshot:async()=>{throw Error('unexpected write');},
  });
  assert.equal((await run()).code,'order_detail_not_eligible');
});

test('status regression between list and detail cannot write Raw',async()=>{
  const run=createCelivioC4ERawOnce({now:()=>NOW,getEnv:env,
    readConnection:async()=>c(),decryptToken:async()=> 'mock',
    listOrders:async()=>{throw Error('unexpected list');},
    detailOrders:async()=>detail('UNPAID'),
    persistSnapshot:async()=>{throw Error('unexpected persistence');},
  });
  assert.equal((await run()).code,'order_detail_not_eligible');
});

test('route is default OFF, rejects body/query and performs no Raw unless enabled',async()=>{
  const route={path:'/internal/shopee/celivio/c4e/raw-once',method:'POST',headers:{}};
  const disabled={handleShopeeLive:async()=>null,getEnv:()=>undefined,
    captureCelivioC4E:async()=>{throw Error('unexpected');}};
  assert.equal(JSON.parse((await handleRequest(route,disabled)).body).code,'c4e_not_enabled');
  assert.equal((await handleRequest({...route,body:'{}'},disabled)).status,400);
  assert.equal((await handleRequest({...route,query:{order:SN}},disabled)).status,400);
  assert.equal((await handleRequest({...route,method:'GET'},disabled)).status,405);
  let calls=0;
  const enabled={...disabled,getEnv:name=>name==='SHOPEE_CELIVIO_C4E_RAW_ONCE_ENABLED'?'true':undefined,
    captureCelivioC4E:async()=>{calls++;return {ok:true,raw_persist_attempted:1,orders_written:0};}};
  const x=await handleRequest(route,enabled);
  assert.equal(x.status,200);
  assert.equal(calls,1);
});

test('target is the exact owner-confirmed Shopee pilot and is not selected by page rank',async()=>{
 assert.equal(CELIVIO_C4E_TARGET_ORDER_SN,'261121TBS6BHE6');
 let details=0;
 const run=createCelivioC4ERawOnce({now:()=>NOW,getEnv:env,
  readConnection:async()=>c(),decryptToken:async()=> 'mock',
  listOrders:async()=>{throw Error('must not enumerate');},
  detailOrders:async(args)=>{details++;assert.deepEqual(args.orderSnList,[TARGET]);return detail();},
  persistSnapshot:async()=>({ok:true}),
 });
 const result=await run();
 assert.equal(details,1);
 assert.equal(result.order_sn,TARGET);
 assert.equal(result.orders_written,0);
});
