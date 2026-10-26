import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/app.mjs';

const path='/internal/shopee/live/logistics/adao/read-only';
const SN='261027N7HVNRKQ';
const req={method:'POST',path,query:{},headers:{'content-length':'0'}};
const testRoute=(request=req, env={}, read=async()=>({ok:true,selected:[]}))=>handleRequest(request,{
  handleShopeeLive:async()=>null,
  getEnv:key=>env[key],
  readAdaoLogistics:read,
});
test('off by default without reading any orders',async()=>{
  let called=0;
  const r=await testRoute(req,{},async()=>{called++;return {ok:true,selected:[]}});
  assert.equal(r.status,503);assert.equal(called,0);
});
test('requires fixed validated scoped order numbers',async()=>{
  for(const value of ['',SN+','+SN,'bad number',new Array(22).fill(SN).join(',')]){
    const r=await testRoute(req,{SHOPEE_ADAO_LOGISTICS_READ_ENABLED:'true',SHOPEE_ADAO_LOGISTICS_ORDER_SNS:value});
    assert.equal(r.status,503);
  }
});
test('rejects request payload, query and incorrect method',async()=>{
  const env={SHOPEE_ADAO_LOGISTICS_READ_ENABLED:'true',SHOPEE_ADAO_LOGISTICS_ORDER_SNS:SN};
  for(const altered of [{...req,method:'GET'},{...req,query:{sn:SN}},{...req,headers:{'content-length':'20'}}]){
    const r=await testRoute(altered,env);
    assert.notEqual(r.status,200);
  }
});
test('returns only classified and non-authorizing state',async()=>{
  const env={SHOPEE_ADAO_LOGISTICS_READ_ENABLED:'true',SHOPEE_ADAO_LOGISTICS_ORDER_SNS:SN};
  const r=await testRoute(req,env,async sns=>{
    assert.deepEqual(sns,[SN]);
    return {ok:true,selected:[{order_sn:SN,state:'ENVIO_JA_ORGANIZADO',reason:'request_created',
      package_count:1,auto_arrangement_authorized:false}]};
  });
  assert.equal(r.status,200);
  const data=JSON.parse(r.body);
  assert.equal(data.selected[0].auto_arrangement_authorized,false);
  assert.equal(data.selected[0].create_shipping_document_authorized,false);
  assert.equal(data.selected[0].inventory_mutation_authorized,false);
});
