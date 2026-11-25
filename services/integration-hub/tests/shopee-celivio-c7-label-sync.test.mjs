import test from 'node:test';
import assert from 'node:assert/strict';
import {createCelivioC7LabelSync,CELIVIO_C7_ORDER_SN} from '../src/shopee-celivio-c7-label-sync.mjs';
import {handleRequest} from '../src/app.mjs';

const ACCOUNT='d26c7a30-aa4a-4441-8012-600d70453689';
const ORDER='2611258Y00VM5U';
const PACKAGE='PKG-TEST-123';
const env=k=>({
 SHOPEE_CELIVIO_C7_LABEL_SYNC_ENABLED:'true',
 SHOPEE_LIVE_CHANNEL_ACCOUNT_ID:ACCOUNT,
 SHOPEE_LIVE_PARTNER_ID:'2047685',
})[k];
const live=()=>({
 ok:true,shop_id:1357031949,
 order:{order_sn:ORDER,order_status:'PROCESSED',package_count:1,
   package_number:PACKAGE,package_logistics_status:'LOGISTICS_REQUEST_CREATED',
   invoice_status:'valid'},
 shipping_document_parameter:{ok:true,results:[{
   order_sn:ORDER,package_number:PACKAGE,
   selectable_shipping_document_type:['NORMAL_AIR_WAYBILL'],
 }]},
});
const deps=(mutate=x=>x, callback=()=>({ok:true,code:'label_attached',document_id:'doc-1'}))=>{
 let writes=0;
 const run=createCelivioC7LabelSync({
  getEnv:env,
  readTombstones:async(data,options)=>{
    assert.deepEqual(data,{channel_account_id:ACCOUNT,order_sns:[ORDER]});
    assert.deepEqual(options,{timeoutMs:12_000});
    return {ok:true,payload:{deleted_order_sns:[]}};
  },
  makeInspector:()=>async({orderSn})=>{
    assert.equal(orderSn,ORDER);return mutate(live());},
  makeSync:options=>{
    writes++;
    assert.equal(options.prepareMissingDocument,true);
    assert.equal(options.getEnv('SHOPEE_LIVE_CHANNEL_ACCOUNT_ID'),ACCOUNT);
    assert.equal(options.getEnv('SHOPEE_LIVE_LABEL_ORDER_SN'),ORDER);
    assert.equal(options.getEnv('SHOPEE_LIVE_LABEL_PACKAGE_NUMBER'),PACKAGE);
    return async()=>callback();
  }
 });
 return {run,writes:()=>writes};
};
test('C7 is exact current Celivio order and reuses existing durable label synchronizer',async()=>{
 assert.equal(CELIVIO_C7_ORDER_SN,ORDER);
 const x=deps();assert.deepEqual(await x.run(),{
  ok:true,code:'label_attached',document_id:'doc-1',
 });assert.equal(x.writes(),1);
});
test('C7 prevents document task for unorganized shipment, wrong package, wrong shop or invoice pending',async()=>{
 for(const mutate of [
  x=>{x.order.order_status='READY_TO_SHIP';return x;},
  x=>{x.order.package_logistics_status='LOGISTICS_READY';return x;},
  x=>{x.order.package_count=2;return x;},
  x=>{x.shop_id=1156446003;return x;},
  x=>{x.order.invoice_status='pending';return x;},
  x=>{x.order.invoice_status=null;return x;},
  x=>{x.shipping_document_parameter.results[0].package_number='OTHER';return x;},
  x=>{x.shipping_document_parameter.results[0].selectable_shipping_document_type=[];return x;},
 ]){
  const x=deps(mutate);
  const result=await x.run();
  assert.equal(result.ok,false);
  assert.equal(x.writes(),0);
 }
});
test('C7 rejects disabled flag and wrong account before reading Shopee',async()=>{
 for(const changes of [
  {SHOPEE_CELIVIO_C7_LABEL_SYNC_ENABLED:'false'},
  {SHOPEE_LIVE_CHANNEL_ACCOUNT_ID:'wrong'},
 ]){
  const run=createCelivioC7LabelSync({
   getEnv:k=>changes[k]??env(k),
   readTombstones:async()=>{throw Error('unexpected');},
  });
  assert.equal((await run()).ok,false);
 }
});
test('C7 route default OFF and forbids external order/body/query',async()=>{
 const req={path:'/internal/shopee/celivio/c7/label/sync-once',
 method:'POST',headers:{'content-length':'0'},query:{}};
 let hits=0;
 const options={
  handleShopeeLive:async()=>null,
  getEnv:k=>({
   SHOPEE_CELIVIO_C7_LABEL_SYNC_ENABLED:'false',
   SHOPEE_LIVE_CHANNEL_ACCOUNT_ID:ACCOUNT,
  })[k],
  syncCelivioC7Label:async()=>{hits++;return {ok:true,code:'label_attached',document_id:'doc-1'};},
 };
 assert.equal((await handleRequest(req,options)).status,503);
 assert.equal((await handleRequest({...req,method:'GET'},options)).status,405);
 assert.equal((await handleRequest({...req,body:'{}'},options)).status,400);
 assert.equal((await handleRequest({...req,query:{order_sn:ORDER}},options)).status,400);
 assert.equal(hits,0);
 const yes={...options,getEnv:k=>k==='SHOPEE_CELIVIO_C7_LABEL_SYNC_ENABLED'?'true':options.getEnv(k)};
 assert.equal((await handleRequest(req,yes)).status,200);
 assert.equal(hits,1);
});
