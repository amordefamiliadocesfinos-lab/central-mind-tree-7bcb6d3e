import test from 'node:test';
import assert from 'node:assert/strict';
import {createD11DiscoveryPage,createD11DiscoveryRound} from '../src/shopee-d11-discovery-page.mjs';
import {sha256Hex} from '../src/core-bridge.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',L='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',S='D11NEW0001';
const N=Date.parse('2026-11-27T22:00:00Z'), sec=N/1000,iso=t=>new Date(t).toISOString(), args={accountId:A,leaseId:L,revision:1};
function fixture(){
 const f={calls:[],time:N,scope:{status:'discovery_scope',channel_account_id:A,lease_id:L,revision:1,shop_id:123,partner_id:2047685,history_cutoff:sec-3600,
 page_size:5,work_budget_ms:48000,time_from:sec-600,time_to:sec-30,cursor:null,candidate_order_sn:null,lease_started_at:iso(N-10000),expires_at:iso(N+120000)},
 list:{request_id:'req_list',response:{order_list:[{order_sn:S}],more:false,next_cursor:null}},detail:{request_id:'req_detail',response:{order_list:[{order_sn:S,create_time:sec-120,order_status:'READY_TO_SHIP',recipient_address:{name:'private'}}]}}};
 f.run=createD11DiscoveryPage({enabled:true,now:()=>f.time,adapters:{readDiscoveryScope:async()=>f.scope,
 finishDiscovery:async(p,h,d)=>{f.calls.push('checkpoint');assert.deepEqual(p,args);assert.equal(h,f.listHash);assert.equal(d[S],f.detailHash);
 return f.unconfirmed?null:{status:'finished',listed:1,eligible:1}}},
 readerFactory:o=>async p=>{
 assert.equal(o.allowRefresh,false);assert.equal(o.expectedShopId,123);assert.equal(o.getEnv('SHOPEE_LIVE_CHANNEL_ACCOUNT_ID'),A);
 assert.deepEqual([p.timeFrom,p.timeTo,p.pageSize,p.cursor,p.timeRangeField],[sec-600,sec-30,5,null,'update_time']);
 const a=await o.persistOrderListSnapshot({channel_account_id:A,external_entity_id:'update_time:'+(sec-600)+'-'+(sec-30)+':cursor:root',payload:f.list,observed_at:iso(N)});
 if(!a.ok)return {ok:false};
 if(f.pause)f.scope={...f.scope,revision:2};
 if(f.late)f.time=N+48001;
 if(!f.skipDetail){const b=await o.persistOrderSnapshot({channel_account_id:A,external_entity_id:S,payload:f.detail,observed_at:iso(N)});if(!b.ok)return {ok:false};}
 return {ok:true,shop_id:123,listed_count:1,detailed_count:1,more:false,next_cursor:null};
 },
 persistList:async r=>{f.calls.push('list');f.listHash=r.payload_hash;assert.equal(r.payload_hash,sha256Hex(JSON.stringify(r.payload)));return {ok:true}},
 persistDetail:async r=>{f.calls.push('detail');f.detailHash=r.payload_hash;assert.equal(r.payload.response.order_list[0].recipient_address,undefined);return {ok:!f.detailFailed}}});
 return f;
}
test('D11 one acknowledged page checkpoints exact hashes and never executes effects',async()=>{
 const f=fixture(),r=await f.run(args);assert.equal(r.ok,true);assert.equal(r.leaseReleased,true);assert.equal(r.effects,0);assert.deepEqual(f.calls,['list','detail','checkpoint']);
});
test('D11 incomplete detail, failed persistence, pause or budget expiry never advance cursor',async()=>{
 for(const k of ['skipDetail','detailFailed','pause','late']){const f=fixture();f[k]=true;assert.equal((await f.run(args)).ok,false);assert.ok(!f.calls.includes('checkpoint'));}
});
test('D11 malformed page, repeated cursor or duplicate order cannot checkpoint',async()=>{
 for(const mutate of [f=>delete f.list.response.more,f=>f.list.response.order_list.push({order_sn:S}),f=>{f.list.response.more=true;f.list.response.next_cursor='';}]){
 const f=fixture();mutate(f);assert.equal((await f.run(args)).ok,false);assert.deepEqual(f.calls,[]);}
});
test('D11 missing checkpoint acknowledgement is uncertain and never retried',async()=>{
 const f=fixture();f.unconfirmed=true;const r=await f.run(args);assert.equal(r.checkpointAttempted,true);assert.equal(r.ok,false);assert.deepEqual(f.calls,['list','detail','checkpoint']);
});
test('D11 disabled and legacy accounts cannot reach discovery',async()=>{
 assert.equal((await createD11DiscoveryPage()(args)).code,'d11_discovery_disabled');
 const f=fixture();assert.equal((await f.run({...args,accountId:'b4027369-5abf-4ac1-ab24-862334fae892'})).ok,false);assert.deepEqual(f.calls,[]);
});

test('D11 discovery round shares acquisition and never releases again after checkpoint uncertainty',async()=>{
 for(const mode of ['ok','invalid','uncertain']){
 const calls=[],round=createD11DiscoveryRound({enabled:true,now:()=>N,
 adapters:{acquirePreflight:async a=>{assert.equal(a,A);calls.push('acquire');return {status:'acquired',channel_account_id:A,lease_id:L,policy_revision:1,candidate_order_sn:null,expires_at:iso(N+120000),work_budget_ms:48000}},
 finishPreflight:async(p,c)=>{calls.push('release');assert.equal(c,'d11_preflight_no_candidate');return {status:'finished'}}},
 discover:async p=>{calls.push('discover');assert.deepEqual(p,{...args,deadline:N+48000});
 return mode==='ok'?{ok:true,code:'d11_discovery_checkpointed',leaseReleased:true,ordersWritten:0,effects:0}:mode==='uncertain'?{ok:false,checkpointAttempted:true}:{ok:false,code:'d11_discovery_page_unconfirmed'};}});
 const r=await round({accountId:A});assert.equal(r.ok,mode==='ok');assert.deepEqual(calls,mode==='invalid'?['acquire','discover','release']:['acquire','discover']);
 }
});
