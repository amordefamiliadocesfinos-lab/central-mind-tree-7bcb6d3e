import test from 'node:test';
import assert from 'node:assert/strict';
import {createD11RecurringRound} from '../src/shopee-d11-recurring-round.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',L='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',I='cccccccc-cccc-4ccc-8ccc-cccccccccccc',O='dddddddd-dddd-4ddd-8ddd-dddddddddddd',S='D11SYNTHETIC1',N=Date.parse('2026-11-28T12:00:00Z');
function fixture(){
 const f={calls:[],flag:'true',candidate:S,proof:{ok:true,code:'d11_preflight_verified_existing',accountId:A,orderSn:S,orderId:O,observationId:I,rawId:L,ordersWritten:0,effects:0,outcome:'pending',effectAuthorized:false},effect:'ship',response:{ok:true,code:'ship_order_api_acknowledged_not_collected',effects:1}};
 const maker=effect=>({reconcile})=>async scope=>{
  f.calls.push(effect);
  assert.equal((await reconcile({...scope,expectedOrderSn:S})).observationId,I);
  assert.equal((await reconcile({...scope,expectedOrderSn:S})).ok,false);
  if(f.throwEffect)throw Error('fixture');
  return f.response;
 };
 f.run=createD11RecurringRound({enabled:true,intakeCommitEnabled:true,now:()=>N,getEnv:k=>k==='SHOPEE_D11_RECURRING_ENABLED'?f.flag:undefined,
  adapters:{acquirePreflight:async()=>{f.calls.push('acquire');return {status:'acquired',channel_account_id:A,lease_id:L,policy_revision:1,work_budget_ms:48000,expires_at:new Date(N+120000).toISOString(),candidate_order_sn:f.candidate};},
   finishPreflight:async(s,code)=>{f.calls.push(code);assert.equal(s.leaseId,L);return f.loseFinish?null:{status:'finished'};},
   readEffectScope:async s=>{assert.equal(s.observationId,I);return s.effect===f.effect?{status:'effect_scope',effect:s.effect}:null;}},
  preflight:async()=>{f.calls.push('preflight');return f.proof;},
  discover:async()=>{f.calls.push('discover');return {ok:true,code:'d11_discovery_checkpointed',ordersWritten:0,effects:0,leaseReleased:true};},
  makeShip:maker('ship'),makeLabel:maker('label')});
 return f;
}
test('D11 discovery gets a turn even with pending work, and does not finish twice',async()=>{
 const f=fixture();assert.equal((await f.run({accountId:A,discoveryTurn:true})).ok,true);assert.deepEqual(f.calls,['acquire','discover']);
 const g=fixture();g.candidate=null;assert.equal((await g.run({accountId:A})).ok,true);assert.deepEqual(g.calls,['acquire','discover']);
});
test('D11 newly imported order is left pending for fresh reconciliation, no external effect',async()=>{
 const f=fixture();f.proof={...f.proof,code:'d11_intake_written',ordersWritten:1,separationId:L};
 const r=await f.run({accountId:A});assert.equal(r.ordersWritten,1);assert.equal(r.queueOutcome,'pending');
 assert.deepEqual(f.calls,['acquire','preflight','d11_intake_written']);
});
test('D11 fresh Core state chooses ship then separate label turns; completion is only queue completion',async()=>{
 const f=fixture();const r=await f.run({accountId:A});assert.equal(r.queueOutcome,'pending');assert.equal(r.effects,1);assert.equal(r.physicalHandoffConfirmed,false);
 assert.deepEqual(f.calls,['acquire','preflight','ship','d11_effect_pending']);
 f.calls=[];f.effect='label';f.response={ok:false,code:'document_task_created_check_later',effects:1,reconciliationRequired:false};
 assert.equal((await f.run({accountId:A})).queueOutcome,'pending');
 assert.deepEqual(f.calls,['acquire','preflight','label','d11_effect_pending']);
 f.calls=[];f.response={ok:true,code:'label_attached',effects:0,documentId:O};
 const done=await f.run({accountId:A});assert.equal(done.queueOutcome,'complete');assert.equal(done.physicalHandoffConfirmed,false);
 assert.deepEqual(f.calls,['acquire','preflight','label','d11_label_available']);
});
test('D11 uncertainty quarantines candidate, no retry; missing finish acknowledgement remains unknown',async()=>{
 const f=fixture();f.response={ok:false,effects:null,reconciliationRequired:true};assert.equal((await f.run({accountId:A})).queueOutcome,'blocked');
 assert.deepEqual(f.calls,['acquire','preflight','ship','d11_effect_requires_review']);
 const g=fixture();g.loseFinish=true;const r=await g.run({accountId:A});assert.equal(r.leaseReleased,false);assert.equal(r.reconciliationRequired,true);
 assert.deepEqual(g.calls,['acquire','preflight','ship','d11_effect_pending']);
});
test('D11 disabled round cannot acquire a lease',async()=>{const f=fixture();f.flag='false';assert.equal((await f.run({accountId:A})).code,'d11_round_disabled');assert.deepEqual(f.calls,[]);});
