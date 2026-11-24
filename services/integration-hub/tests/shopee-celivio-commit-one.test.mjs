import test from 'node:test';
import assert from 'node:assert/strict';
import { createCelivioPilotCommitOne, CELIVIO_C4G_PILOT_ORDER_SN } from '../src/shopee-celivio-commit-one.mjs';
import {CELIVIO_C4C_ACCOUNT_ID} from '../src/shopee-celivio-c4c-preflight.mjs';
import {handleRequest} from '../src/app.mjs';

const foreign='b4027369-5abf-4ac1-ab24-862334fae892';
const call={channelAccountId:CELIVIO_C4C_ACCOUNT_ID,expectedOrderSn:CELIVIO_C4G_PILOT_ORDER_SN,mode:'commit',limit:5};

test('C4-G rejects other accounts, orders, mode and batch size before reading or writing',async()=>{
 const seen=[];
 const run=createCelivioPilotCommitOne({
   readBatch:async()=>{seen.push('read');return {ok:false,status:503};},
   persistOrder:async()=>{seen.push('write');return {ok:false};},
 });
 for(const mutation of [
   {channelAccountId:foreign},
   {expectedOrderSn:'ANOTHER'},
   {mode:'preview'},
   {limit:20},
 ]){
   const result=await run({...call,...mutation});
   assert.equal(result.ok,false);
   assert.equal(result.written,0);
   assert.equal(result.code,'celivio_c4g_scope_invalid');
 }
 assert.deepEqual(seen,[]);
});

test('C4-G uses existing 12s batch reader with exact order filter, never inventing a writer on Core failure',async()=>{
 const requests=[]; let writes=0;
 const run=createCelivioPilotCommitOne({
   readBatch:async(data,options)=>{
     requests.push({data,options});
     return {ok:false,status:503};
   },
   persistOrder:async()=>{writes++;return {ok:true};},
 });
 const result=await run(call);
 assert.equal(result.ok,false);
 assert.equal(result.written,0);
 assert.equal(writes,0);
 assert.deepEqual(requests,[{
   data:{channel_account_id:CELIVIO_C4C_ACCOUNT_ID,limit:5,order_sn:CELIVIO_C4G_PILOT_ORDER_SN},
   options:{timeoutMs:12_000},
 }]);
});

test('existing commit-one route refuses operations unless exact commit flag and target are configured',async()=>{
 let attempts=0;
 const req={method:'POST',path:'/internal/shopee/live/orders/intake/commit-one',query:{}};
 const make=env=>handleRequest(req,{
   handleShopeeLive:async()=>null,
   getEnv:key=>env[key],
   runCelivioCommitOne:async()=>{attempts++;throw Error('should not run');},
   runShopeeCommit:async()=>{attempts++;throw Error('should not run');},
 });
 for(const env of [
   {SHOPEE_LIVE_CHANNEL_ACCOUNT_ID:CELIVIO_C4C_ACCOUNT_ID,SHOPEE_LIVE_COMMIT_ORDER_SN:CELIVIO_C4G_PILOT_ORDER_SN,SHOPEE_LIVE_COMMIT_ENABLED:'false'},
   {SHOPEE_LIVE_CHANNEL_ACCOUNT_ID:CELIVIO_C4C_ACCOUNT_ID,SHOPEE_LIVE_COMMIT_ORDER_SN:'',SHOPEE_LIVE_COMMIT_ENABLED:'true'},
 ]){
   const result=await make(env);
   assert.equal(result.status,503);
   assert.equal(JSON.parse(result.body).error,'commit_not_enabled');
 }
 assert.equal(attempts,0);
});

test('commit-one routes Celivio through scoped runner, leaves another account on shared runner',async()=>{
 const uses=[];
 const req={method:'POST',path:'/internal/shopee/live/orders/intake/commit-one',query:{}};
 const common={
   handleShopeeLive:async()=>null,
   runCelivioCommitOne:async args=>{uses.push(['celivio',args]);return {ok:false,selected:0,ready:0,blocked:0,written:0,results:[]};},
   runShopeeCommit:async args=>{uses.push(['shared',args]);return {ok:false,selected:0,ready:0,blocked:0,written:0,results:[]};},
 };
 for(const account of [CELIVIO_C4C_ACCOUNT_ID,foreign]){
   const result=await handleRequest(req,{
     ...common,
     getEnv:key=>({
       SHOPEE_LIVE_CHANNEL_ACCOUNT_ID:account,
       SHOPEE_LIVE_COMMIT_ORDER_SN:CELIVIO_C4G_PILOT_ORDER_SN,
       SHOPEE_LIVE_COMMIT_ENABLED:'true',
     })[key],
   });
   assert.equal(result.status,409);
 }
 assert.equal(uses.length,2);
 assert.equal(uses[0][0],'celivio');
 assert.equal(uses[1][0],'shared');
 assert.deepEqual(uses[0][1],call);
});
