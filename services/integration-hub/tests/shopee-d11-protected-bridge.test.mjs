import test from 'node:test';
import assert from 'node:assert/strict';
import {createBridgeHandler} from '../../../supabase/functions/integration-core-bridge/handler.mjs';
import {executeD11BridgeAction,isD11BridgeActionEnabled} from '../../../supabase/functions/integration-core-bridge/d11-bridge.mjs';
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
 const f={enabled:true,orders:[],admitted:true,lease:true,reads:0,calls:[],claim:{status:'claimed',fresh:true,attempt_id:I}};
 const state={channel_account_id:A,lease_id:L,lease_policy_revision:1,candidate_order_sn:S,halted_code:null,
 updated_at:iso(N-10000),lease_expires_at:iso(N+60000)};
 const core={from(table){f.reads++;const q={select(){return q},eq(){return q},limit(){return Promise.resolve({data:f.orders})},maybeSingle(){return Promise.resolve({data:table==='shopee_cycle_state'?state:{channel_account_id:A,order_sn:S,state:'pending'}})}};return q;},
 async rpc(name,args){f.calls.push({name,args});
 if(name==='acquire_shopee_d11_preflight')return {data:{status:'acquired',channel_account_id:A,lease_id:L,policy_revision:1,candidate_order_sn:S,expires_at:iso(N+60000),work_budget_ms:48000,private:'never-return'}};
 if(name==='commit_shopee_d11_intake')return {data:{status:'intake_written',order_id:I,separation_id:L,observation_id:args.p_observation}};
 if(name==='finish_shopee_d11_preflight')return {data:{status:'finished'}};
 return {data:name==='record_shopee_cycle_observation'?{status:'observation_recorded',observation_id:I,raw_id:L,private:'never-return'}:f.claim};}};
 const handler=createBridgeHandler({getSecret:()=>SECRET,checkCore:async()=>true,executeAction:p=>executeD11BridgeAction(core,p,{
 enabled:f.enabled,now:()=>N,readPolicy:async(_core,{action})=>({ok:f.admitted,profile:{account:A,revision:1,partner:2047685,shop:123,
 action,history_cutoff:Math.floor(N/1000)-3600,expires_at:iso(N+60000)}}),
 checkLease:async()=>({ok:f.lease}),
 prepareReconciliation:()=>async scope=>{
  assert.equal(scope.expectedObservationId,I);
  return {ok:true,orderSn:S,shopId:123,observationId:I,rawId:L,
   readExistingBatch:async()=>({ok:true,payload:{channel_account_id:A,snapshots:[],mappings:[]}}),
   verifyCanonicalOrder:async p=>({ok:true,status:'verified_existing',channel_account_id:p.channel_account_id,order_number:p.order_number,order_id:I})};
 }})});
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

test('D11 signed reconciliation actions pin receipt and reuse the existing projection payload validation',async()=>{
 const f=fixture(),pinned={...scope,observationId:I};
 const b=await f.adapters.readReconciliation(pinned);
 assert.equal(b.status,'reconciliation_batch');assert.equal(b.observation_id,I);
 const p={channel_account_id:A,marketplace_account:'fixture',order_number:S,order_date:'2026-11-27',
 total_value:20,payment_method:'Pix',external_status:'READY_TO_SHIP',items:[{product_id:I,variant_id:L,
 quantity:2,commercial_quantity:1,physical_multiplier:2,unit_price:20,external_item_key:'fixture',
 item_id:'1',model_id:'2',mapping_id:I,composition_position:0}]};
 assert.equal((await f.adapters.verifyReconciliation(pinned,p)).status,'verified_existing');
 assert.equal(await f.adapters.verifyReconciliation(pinned,{...p,channel_account_id:L}),null);
 assert.equal(await f.adapters.verifyReconciliation(pinned,{...p,items:[]}),null);
 assert.deepEqual(f.calls,[]);
});

test('D11 signed preflight lifecycle accepts only account acquire and pending-only exact release',async()=>{
 const f=fixture(),l=await f.adapters.acquirePreflight(A);
 assert.equal(l.status,'acquired');assert.equal(l.candidate_order_sn,S);assert.equal(l.private,undefined);
 f.admitted=false;f.lease=false;
 const finished=await f.adapters.finishPreflight({...scope,orderSn:S},'d11_preflight_scope_refused');
 assert.equal(finished.status,'finished');
 assert.deepEqual(f.calls,[{name:'acquire_shopee_d11_preflight',args:{p_account:A}},
 {name:'finish_shopee_d11_preflight',args:{p_account:A,p_lease:L,p_revision:1,p_candidate:S,p_code:'d11_preflight_scope_refused'}}]);
 for(const [action,data] of [
 ['shopee.d11.preflight.acquire',{channel_account_id:A,order_sn:S}],
 ['shopee.d11.preflight.finish',{channel_account_id:A,lease_id:L,revision:1,candidate_order_sn:S,code:'complete'}],
 ['shopee.d11.preflight.finish',{channel_account_id:A,lease_id:L,revision:1,candidate_order_sn:S,code:'d11_preflight_verified_existing',page:{}}],
 ]){
 assert.equal((await f.call({action,data})).status,400);
 }
 f.enabled=false;assert.equal(await f.adapters.acquirePreflight(A),null);
 assert.equal(f.calls.length,2);
});

test('D11 signed protected intake classifies absence, existing order and tombstone, then pins commit RPC',async()=>{
 const f=fixture(),pinned={...scope,observationId:I};
 const p={channel_account_id:A,marketplace_account:'fixture',order_number:S,order_date:'2026-11-27',
 total_value:20,payment_method:'Pix',external_status:'READY_TO_SHIP',items:[{product_id:I,variant_id:L,
 quantity:2,commercial_quantity:1,physical_multiplier:2,unit_price:20,external_item_key:'fixture',
 item_id:'1',model_id:'2',mapping_id:I,composition_position:0}]};
 assert.equal((await f.adapters.readIntake(pinned)).canonical_state,'absent');
 f.orders=[{id:I,channel_account_id:A,channel:'shopee',order_number:S,sale_origin:'shopee_open_platform',
 deleted_at:null,status:'pendente',operational_status:'todo'}];
 assert.equal((await f.adapters.readIntake(pinned)).canonical_state,'existing');
 f.orders[0].deleted_at=iso(N);assert.equal(await f.adapters.readIntake(pinned),null);
 f.orders=[];assert.equal(await f.adapters.commitIntake(pinned,{...p,channel_account_id:L}),null);
 assert.equal(await f.adapters.commitIntake(pinned,{...p,items:[]}),null);
 f.enabled=false;assert.equal(await f.adapters.commitIntake(pinned,p),null);
 assert.deepEqual(f.calls,[]);f.enabled=true;
 const ack=await f.adapters.commitIntake(pinned,p);assert.equal(ack.status,'intake_written');
 assert.equal(ack.observation_id,I);assert.deepEqual(f.calls,[{name:'commit_shopee_d11_intake',
 args:{p_account:A,p_lease:L,p_revision:1,p_observation:I,p_projection:p}}]);
});

test('D11 default-off flags isolate intake commit from observation and shipment claim',()=>{
 const env={},get=k=>env[k];
 for(const a of ['shopee.d11.intake.read','shopee.d11.intake.commit','shopee.d11.effect.claim'])assert.equal(isD11BridgeActionEnabled(a,get),false);
 env.SHOPEE_D11_BRIDGE_ENABLED='true';assert.equal(isD11BridgeActionEnabled('shopee.d11.intake.read',get),true);
 assert.equal(isD11BridgeActionEnabled('shopee.d11.intake.commit',get),false);
 env.SHOPEE_D11_INTAKE_COMMIT_ENABLED='true';assert.equal(isD11BridgeActionEnabled('shopee.d11.intake.commit',get),true);
 assert.equal(isD11BridgeActionEnabled('shopee.d11.effect.claim',get),false);
 env.SHOPEE_D11_BRIDGE_ENABLED='false';assert.equal(isD11BridgeActionEnabled('shopee.d11.intake.commit',get),false);
});
