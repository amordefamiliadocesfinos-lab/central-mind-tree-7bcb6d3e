import test from 'node:test';
import assert from 'node:assert/strict';
import {createD11OfficialObservation,prepareD11Observation} from '../src/shopee-d11-official-observation.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',L='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',I='cccccccc-cccc-4ccc-8ccc-cccccccccccc',S='SYNTHETIC001';
const N=Date.parse('2026-11-27T22:00:00Z'),iso=x=>new Date(x).toISOString();
const args={accountId:A,leaseId:L,revision:1};
function fixture(){
 const f={calls:[],scope:{ok:true,...args,partnerId:2047685,shopId:123,orderSn:S,historyCutoff:N/1000-3600,
 leaseStartedAt:iso(N-10000),expiresAt:iso(N+60000)},detail:{response:{ok:true},payload:{request_id:'req_1',response:{order_list:[
 {order_sn:S,order_status:'READY_TO_SHIP',create_time:N/1000-120,split_up:false,total_amount:20,
 recipient_address:{name:'private'},invoice_data:{private:true},item_list:[{item_id:1,model_id:2,model_quantity_purchased:2,model_discounted_price:10,buyer_private:'private'}],
 package_list:[{package_number:'PKG1',logistics_status:'LOGISTICS_READY',private:'private'}]}]}}},
 conn:{ok:true,payload:{shop_id:123,partner_id:2047685,access_token_expires_at:iso(N+120000),access_token_ciphertext:'fixture'}},
 raw:{ok:true},receipt:{status:'observation_recorded',observation_id:I,raw_id:L}};
 f.run=createD11OfficialObservation({now:()=>N,readScope:async()=>f.scope,
 getEnv:()=> 'fixture',readConnection:async()=>f.conn,decryptToken:async()=> 'fixture',
 detailOrders:async input=>{f.calls.push('detail');assert.deepEqual(input.orderSnList,[S]);assert.equal(input.shopId,123);return f.detail;},
 persistSnapshot:async input=>{f.calls.push('raw');f.rawInput=input;return f.raw;},
 recordObservation:async input=>{f.calls.push('receipt');f.receiptInput=input;return f.receipt;}});
 return f;
}
test('D11 official adapter observes exact Core candidate and records only redacted content and receipt',async()=>{
 const f=fixture(),r=await f.run({...args,orderSn:'OTHERORDER1',shopId:999});
 assert.equal(r.ok,true);assert.equal(r.ordersWritten,0);assert.deepEqual(f.calls,['detail','raw','receipt']);
 assert.equal(f.rawInput.payload_hash,f.receiptInput.p_hash);
 assert.deepEqual(f.rawInput.payload,f.receiptInput.p_payload);
 assert.equal(f.receiptInput.p_request,'req_1');
 const o=f.rawInput.payload.response.order_list[0];
 assert.equal(o.total_amount,20);assert.equal(o.item_list[0].model_discounted_price,10);
 assert.equal(o.recipient_address,undefined);assert.equal(o.invoice_data,undefined);
 assert.equal(o.item_list[0].buyer_private,undefined);assert.equal(o.package_list[0].private,undefined);
 assert.equal(f.rawInput.payload.request_id,undefined);
});
test('D11 identical official content with distinct response IDs has same content hash',()=>{
 const f=fixture(),a=prepareD11Observation(f.detail,f.scope,N);
 f.detail.payload.request_id='req_2';const b=prepareD11Observation(f.detail,f.scope,N);
 assert.equal(a.hash,b.hash);assert.notEqual(a.requestId,b.requestId);
});
test('D11 refuses unauthorized lease or invalid OAuth before official call',async()=>{
 for(const change of [f=>f.scope.ok=false,f=>f.scope.revision=2,f=>f.conn.payload.shop_id=999,
 f=>f.conn.payload.access_token_expires_at=iso(N)]){
 const f=fixture();change(f);assert.equal((await f.run(args)).ok,false);assert.deepEqual(f.calls,[]);
 }
});
test('D11 refuses invalid response and never records on missing Raw acknowledgement',async()=>{
 for(const change of [f=>f.detail.payload.error='business_error',f=>delete f.detail.payload.request_id,
 f=>f.detail.payload.response.order_list[0].order_sn='OTHERORDER1',f=>delete f.detail.payload.response.order_list[0].split_up]){
 const f=fixture();change(f);assert.equal((await f.run(args)).ok,false);assert.deepEqual(f.calls,['detail']);
 }
 const f=fixture();f.raw.ok=false;assert.equal((await f.run(args)).ok,false);assert.deepEqual(f.calls,['detail','raw']);
});
test('D11 receipt failure remains blocked with no retry or writer fallback',async()=>{
 const f=fixture();f.receipt={status:'observation_replay_or_out_of_order'};
 assert.equal((await f.run(args)).code,'observation_receipt_unconfirmed');
 assert.deepEqual(f.calls,['detail','raw','receipt']);
});
