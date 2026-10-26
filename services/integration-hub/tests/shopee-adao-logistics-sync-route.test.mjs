import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/app.mjs';
const path = '/internal/shopee/live/logistics/adao/sync-once';
const sn = '261027N7HVNRKQ';
const req={path,method:'POST',headers:{'content-length':'0'},query:{}};
const env={SHOPEE_ADAO_LOGISTICS_SYNC_ENABLED:'true',SHOPEE_ADAO_LOGISTICS_ORDER_SNS:sn};
const run=(request=req,overrides={},extra={})=>handleRequest(request,{
  handleShopeeLive:async()=>null,getEnv:key=>({...env,...overrides})[key],
  readAdaoLogistics:async()=>({ok:true,account:'adao',selected:[{
    order_sn:sn,state:'EXPEDIDO',reason:'logistics_pickup_done',
    auto_arrangement_authorized:false,create_shipping_document_authorized:false,
    inventory_mutation_authorized:false,
  }]}),
  syncCore:async()=>({ok:true,payload:{status:'ok'}}),...extra,
});
test('sync is disabled by default',async()=>{
  let called=false;
  const r=await run(req,{SHOPEE_ADAO_LOGISTICS_SYNC_ENABLED:'false'},{
    readAdaoLogistics:async()=>{called=true;return {};}});
  assert.equal(r.status,503);assert.equal(called,false);
});
test('no caller supplied scope or data accepted',async()=>{
  for(const request of [{...req,method:'GET'},{...req,query:{sn}},{...req,headers:{'content-length':'12'}}]){
    const r=await run(request);
    assert.notEqual(r.status,200);
  }
});
test('only complete read-only classified selection syncs with HMAC Core',async()=>{
  let payload=null;
  const r=await run(req,{},{
    syncCore:async x=>{payload=x;return {ok:true,payload:{status:'ok'}};}
  });
  assert.equal(r.status,200);
  assert.equal(payload.action,'shopee.logistics_classification.sync');
  assert.equal(payload.data.entries[0].state,'EXPEDIDO');
  assert.deepEqual(JSON.parse(r.body),{status:'ok',count:1});
});
test('rejects response that authorizes any action',async()=>{
  const r=await run(req,{},{
    readAdaoLogistics:async()=>({ok:true,account:'adao',selected:[{
      order_sn:sn,state:'EXPEDIDO',auto_arrangement_authorized:true,
      create_shipping_document_authorized:false,inventory_mutation_authorized:false,
    }]})
  });
  assert.equal(r.status,503);
});
