import test from 'node:test';
import assert from 'node:assert/strict';
import {createCelivioNewPilotRawOnce} from '../src/shopee-celivio-c4e-raw-once.mjs';
import {createCelivioPilotCommitOne} from '../src/shopee-celivio-commit-one.mjs';
import {createCelivioC7LabelSync} from '../src/shopee-celivio-c7-label-sync.mjs';
import {handleRequest} from '../src/app.mjs';
const A='d26c7a30-aa4a-4441-8012-600d70453689', O='261126AB2EH6V0', P='OFG249355491866091';
const base={SHOPEE_LIVE_CHANNEL_ACCOUNT_ID:A,SHOPEE_LIVE_LOGISTICS_PROBE_ORDER_SN:O,SHOPEE_LIVE_COMMIT_ORDER_SN:O,SHOPEE_LIVE_PARTNER_ID:'2047685'};
const env=(extra={})=>k=>({...base,...extra})[k];
const unexpected=async()=>{throw Error('unexpected I/O')};
test('new Raw defaults off and rejects foreign account or target before I/O',async()=>{
 for(const extra of [{},{SHOPEE_CELIVIO_NEW_PILOT_RAW_ENABLED:'true',SHOPEE_LIVE_CHANNEL_ACCOUNT_ID:'foreign'},{SHOPEE_CELIVIO_NEW_PILOT_RAW_ENABLED:'true',SHOPEE_LIVE_LOGISTICS_PROBE_ORDER_SN:'OTHER'}]){
 const run=createCelivioNewPilotRawOnce({getEnv:env(extra),readConnection:unexpected});
 assert.equal((await run()).ok,false);}
});
test('new Raw captures only exact order using existing redaction and one upsert',async()=>{
 const now=Date.parse('2026-11-26T16:00:00Z');let writes=0;
 const run=createCelivioNewPilotRawOnce({now:()=>now,getEnv:env({SHOPEE_CELIVIO_NEW_PILOT_RAW_ENABLED:'true',SHOPEE_LIVE_PARTNER_KEY:'mock',SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY:'mock'}),
 readConnection:async x=>{assert.equal(x.channel_account_id,A);return {ok:true,payload:{shop_id:1357031949,partner_id:2047685,access_token_expires_at:new Date(now+3600000).toISOString(),access_token_ciphertext:'mock'}}},
 decryptToken:async()=> 'mock',listOrders:unexpected,
 detailOrders:async x=>{assert.deepEqual(x.orderSnList,[O]);return {response:{ok:true},payload:{response:{order_list:[{order_sn:O,order_status:'READY_TO_SHIP',create_time:1795700000,buyer_username:'PRIVATE',item_list:[{item_id:'123',model_id:'456',model_quantity_purchased:1}]}]}}}},
 persistSnapshot:async x=>{writes++;assert.equal(x.channel_account_id,A);assert.equal(x.external_entity_id,O);assert.ok(!JSON.stringify(x).includes('PRIVATE'));return {ok:true}}});
 assert.equal((await run()).ok,true);assert.equal(writes,1);
});
test('new commit requires exact server scope and never writes on Core read failure',async()=>{
 let reads=0;const call={channelAccountId:A,expectedOrderSn:O,mode:'commit',limit:5};
 const make=extra=>createCelivioPilotCommitOne({getEnv:env(extra),readBatch:async(x,opt)=>{reads++;assert.equal(x.order_sn,O);assert.equal(x.channel_account_id,A);assert.equal(opt.timeoutMs,12000);return {ok:false,status:503}},persistOrder:unexpected});
 assert.equal((await make({})(call)).written,0);assert.equal(reads,0);
 const run=make({SHOPEE_CELIVIO_NEW_PILOT_COMMIT_ENABLED:'true'});
 assert.equal((await run({...call,channelAccountId:'foreign'})).written,0);assert.equal(reads,0);
 assert.equal((await run(call)).written,0);assert.equal(reads,1);
});
test('new label only reaches existing synchronizer after exact organized package proof',async()=>{
 for(const wrong of [true,false]){
 let writes=0;
 const run=createCelivioC7LabelSync({newPilot:true,getEnv:env({SHOPEE_CELIVIO_NEW_PILOT_LABEL_ENABLED:'true'}),
 readTombstones:async x=>{assert.deepEqual(x.order_sns,[O]);return {ok:true,payload:{deleted_order_sns:[]}}},
 makeInspector:()=>async()=>({ok:true,shop_id:1357031949,order:{order_sn:O,order_status:'PROCESSED',package_count:1,package_number:wrong?'OTHER':P,package_logistics_status:'LOGISTICS_REQUEST_CREATED',invoice_status:'valid'},shipping_document_parameter:{ok:true,results:[{order_sn:O,package_number:P,selectable_shipping_document_type:['NORMAL_AIR_WAYBILL']}]}}),
 makeSync:x=>{writes++;assert.equal(x.getEnv('SHOPEE_LIVE_LABEL_ORDER_SN'),O);assert.equal(x.getEnv('SHOPEE_LIVE_LABEL_PACKAGE_NUMBER'),P);return async()=>({ok:true,code:'already_available'})}});
 assert.equal((await run()).ok,!wrong);assert.equal(writes,wrong?0:1);}
});
test('new routes default off and reject caller-supplied body and query',async()=>{
 for(const suffix of ['raw-once','label/sync-once']){
 const req={path:'/internal/shopee/celivio/new-pilot/'+suffix,method:'POST',headers:{'content-length':'0'},query:{}};
 const opts={handleShopeeLive:async()=>null,getEnv:env(),captureCelivioNewPilot:unexpected,syncCelivioNewPilotLabel:unexpected};
 assert.equal((await handleRequest(req,opts)).status,503);
 assert.equal((await handleRequest({...req,method:'GET'},opts)).status,405);
 assert.equal((await handleRequest({...req,body:'{}'},opts)).status,400);
 assert.equal((await handleRequest({...req,query:{order:O}},opts)).status,400);}
});
