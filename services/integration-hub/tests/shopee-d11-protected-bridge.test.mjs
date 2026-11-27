import test from 'node:test';
import assert from 'node:assert/strict';
import {createBridgeHandler} from '../../../supabase/functions/integration-core-bridge/handler.mjs';
import {executeD11BridgeAction} from '../../../supabase/functions/integration-core-bridge/d11-bridge.mjs';
import {callCoreBridgeAction,CORE_BRIDGE_URL,sha256Hex} from '../src/core-bridge.mjs';
import {createD11BridgeAdapters,createD11BridgeObservation} from '../src/shopee-d11-bridge-adapter.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',L='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',I='cccccccc-cccc-4ccc-8ccc-cccccccccccc',S='SYNTHETIC001';
const SECRET='synthetic-d11-fixture-only',N=Date.now(),iso=x=>new Date(x).toISOString();
const scope={accountId:A,leaseId:L,revision:1}, data={channel_account_id:A,lease_id:L,revision:1};
const payload={response:{order_list:[{order_sn:S,order_status:'READY_TO_SHIP',create_time:Math.floor(N/1000)-120,split_up:false,
 item_list:[{item_id:1,model_id:2,model_quantity_purchased:2,model_discounted_price:10}],
 package_list:[{package_number:'PKG1',logistics_status:'LOGISTICS_READY'}]}]}};
const record={p_account:A,p_lease:L,p_revision:1,p_shop:123,p_order:S,p_hash:sha256Hex(JSON.stringify(payload)),p_payload:payload,
 p_request:'req_1',p_started:iso(N-1000),p_received:iso(N)};
const effect={...scope,shopId:123,orderSn:S,packageNumber:'PKG1',requestHash:'b'.repeat(64),observationId:I,effect:'ship'};
function fixture(){
 const f={enabled:true,admitted:true,lease:true,reads:0,calls:[],claim:{status:'claimed',fresh:true,attempt_id:I}};
 const state={channel_account_id:A,lease_id:L,lease_policy_revision:1,candidate_order_sn:S,halted_code:null,
 updated_at:iso(N-10000),lease_expires_at:iso(N+60000)};
 const core={from(table){f.reads++;const q={select(){return q},eq(){return q},maybeSingle(){return Promise.resolve({data:table==='shopee_cycle_state'?state:{channel_account_id:A,order_sn:S,state:'pending'}})}};return q;},
 async rpc(name,args){f.calls.push({name,args});return {data:name==='record_shopee_cycle_observation'?{status:'observation_recorded',observation_id:I,raw_id:L,private:'never-return'}:f.claim};}};
 const handler=createBridgeHandler({getSecret:()=>SECRET,checkCore:async()=>true,executeAction:p=>executeD11BridgeAction(core,p,{
 enabled:f.enabled,now:()=>N,readPolicy:async(_core,{action})=>({ok:f.admitted,profile:{account:A,revision:1,partner:2047685,shop:123,
 action,history_cutoff:Math.floor(N/1000)-3600,expires_at:iso(N+60000)}}),
 checkLease:async()=>({ok:f.lease})})});
 f.call=({action,data,secret=SECRET})=>callCoreBridgeAction({action,data,url:CORE_BRIDGE_URL,secret,logger:()=>{},
 fetchImpl:(url,options)=>handler(new Request(url,options))});
 f.adapters=createD11BridgeAdapters({enabled:true,call:f.call});
 return f;
}
test('D11 signed bridge selects canonical scope and forwards only exact receipt and claim identities',async()=>{
 const f=fixture(),s=await f.adapters.readScope({...scope,orderSn:'OTHERORDER1',shopId:999});
 assert.equal(s.ok,true);assert.equal(s.orderSn,S);assert.equal(s.shopId,123);
 const r=await f.adapters.recordObservation(record);
 assert.equal(r.status,'observation_recorded');assert.equal(r.private,undefined);
 assert.deepEqual(f.calls[0],{name:'record_shopee_cycle_observation',args:record});
 const c=await f.adapters.claimEffect(effect);
 assert.equal(c.status,'claimed');assert.equal(c.fresh,true);assert.equal(f.calls[1].args.p_observation_id,I);
});
test('D11 default-off and invalid HMAC prevent all Core reads and effects',async()=>{
 const f=fixture();f.enabled=false;
 assert.equal(await f.adapters.readScope(scope),null);
 assert.equal(f.reads,0);
 f.enabled=true;
 const r=await f.call({action:'shopee.d11.scope.read',data,secret:'wrong'});
 assert.equal(r.status,401);assert.equal(f.reads,0);
 const disabled=createD11BridgeAdapters({call:()=>assert.fail('disabled client must not call')});
 assert.equal(await disabled.readScope(scope),null);
 assert.deepEqual(f.calls,[]);
});
test('D11 bridge rejects caller additions, legacy accounts, mismatched candidate and hash before any write',async()=>{
 const f=fixture();
 for(const d of [{...data,shop_id:999},{...data,channel_account_id:'b4027369-5abf-4ac1-ab24-862334fae892'}]){
  assert.equal((await f.call({action:'shopee.d11.scope.read',data:d})).status,400);
 }
 assert.equal(await f.adapters.recordObservation({...record,p_shop:999}),null);
 assert.equal(await f.adapters.recordObservation({...record,p_hash:'f'.repeat(64)}),null);
 assert.equal(await f.adapters.claimEffect({...effect,orderSn:'OTHERORDER1'}),null);
 assert.deepEqual(f.calls,[]);
});
test('D11 revoked policy or lease prevents recorder and claim; nonfresh claim never authorizes a POST',async()=>{
 const f=fixture();f.admitted=false;assert.equal(await f.adapters.claimEffect(effect),null);
 f.admitted=true;f.lease=false;assert.equal(await f.adapters.recordObservation(record),null);
 assert.deepEqual(f.calls,[]);f.lease=true;f.claim={status:'already_claimed',fresh:false,attempt_id:I};
 assert.equal(await f.adapters.claimEffect(effect),null);
 assert.equal(f.calls.length,1);
});
test('D11 observation factory connects signed scope and recorder without an external writer',async()=>{
 const f=fixture(),writes=[];
 const run=createD11BridgeObservation({enabled:true,call:f.call,now:()=>N,getEnv:()=> 'fixture',
 readConnection:async()=>({ok:true,payload:{shop_id:123,partner_id:2047685,access_token_expires_at:iso(N+120000),access_token_ciphertext:'fixture'}}),
 decryptToken:async()=> 'fixture',detailOrders:async()=>({response:{ok:true},payload:{...payload,request_id:'req_1'}}),
 persistSnapshot:async p=>{writes.push(p);return {ok:true}}});
 const r=await run(scope);
 assert.equal(r.ok,true);assert.equal(r.observationId,I);assert.equal(r.ordersWritten,0);
 assert.equal(writes.length,1);assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].args.p_hash,writes[0].payload_hash);
});
