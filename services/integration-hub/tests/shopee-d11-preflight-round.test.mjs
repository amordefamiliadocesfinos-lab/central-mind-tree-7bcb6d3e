import test from 'node:test';
import assert from 'node:assert/strict';
import {createD11PreflightRound} from '../src/shopee-d11-preflight-round.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',L='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',I='cccccccc-cccc-4ccc-8ccc-cccccccccccc',R='dddddddd-dddd-4ddd-8ddd-dddddddddddd',O='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',S='SYNTHETIC001';
const N=Date.parse('2026-11-27T22:00:00Z');
function fixture(intakeCommitEnabled=false){
 const f={time:N,calls:[],lease:{status:'acquired',channel_account_id:A,lease_id:L,policy_revision:2,candidate_order_sn:S,expires_at:new Date(N+120000).toISOString(),work_budget_ms:48000},
 proof:{ok:true,code:'d11_preflight_verified_existing',accountId:A,orderSn:S,orderId:O,observationId:I,rawId:R,ordersWritten:0,effects:0,outcome:'pending',effectAuthorized:false},finish:{status:'finished'}};
 f.run=createD11PreflightRound({enabled:true,intakeCommitEnabled,now:()=>f.time,adapters:{
 acquirePreflight:async a=>{f.calls.push('acquire');assert.equal(a,A);if(f.acquireThrows)throw Error('fixture');f.time+=f.acquireDelay??0;return f.lease},
 finishPreflight:async(p,code)=>{f.calls.push('finish');assert.deepEqual(p,{accountId:A,leaseId:L,revision:2,orderSn:f.lease.candidate_order_sn});f.code=code;if(f.finishThrows)throw Error('fixture');return f.finish}},
 preflight:async p=>{f.calls.push('preflight');assert.deepEqual(p,{accountId:A,leaseId:L,revision:2,expectedOrderSn:S,deadline:N+48000});if(f.preflightThrows)throw Error('fixture');f.time+=f.delay??0;return f.proof}});
 return f;
}
test('D11 preflight round acquires exact lease, performs one preflight and confirms pending release',async()=>{
 const f=fixture(),r=await f.run({accountId:A,orderSn:'OTHERORDER1'});
 assert.deepEqual(f.calls,['acquire','preflight','finish']);assert.equal(r.ok,true);assert.equal(r.leaseReleased,true);
 assert.equal(r.outcome,'pending');assert.equal(r.effects,0);assert.equal(r.effectAuthorized,false);assert.equal(r.observationId,I);
});
test('D11 empty queue releases without external work',async()=>{
 const f=fixture();f.lease.candidate_order_sn=null;const r=await f.run({accountId:A});
 assert.equal(r.code,'d11_preflight_no_candidate');assert.equal(r.ok,true);assert.deepEqual(f.calls,['acquire','finish']);
});
test('D11 disabled, legacy or unconfirmed acquisition never initiates work or release',async()=>{
 const run=createD11PreflightRound({adapters:{acquirePreflight:()=>assert.fail('disabled')}});
 assert.equal((await run({accountId:A})).code,'d11_round_disabled');
 const f=fixture();assert.equal((await f.run({accountId:'b4027369-5abf-4ac1-ab24-862334fae892'})).ok,false);assert.deepEqual(f.calls,[]);
 for(const change of [g=>g.acquireThrows=true,g=>g.lease.channel_account_id=L,g=>g.lease.status='busy',g=>g.lease.policy_revision=null]){
 const g=fixture();change(g);assert.equal((await g.run({accountId:A})).code,'d11_round_acquire_unconfirmed');assert.deepEqual(g.calls,['acquire']);}
});
test('D11 deadline includes acquisition, late success is refused and lease is released once',async()=>{
 for(const [field,calls] of [['acquireDelay',['acquire','finish']],['delay',['acquire','preflight','finish']]]){
 const f=fixture();f[field]=48001;const r=await f.run({accountId:A});
 assert.equal(r.code,'d11_preflight_budget_exhausted');assert.equal(r.ok,false);assert.deepEqual(f.calls,calls);
 assert.equal(f.code,'d11_preflight_budget_exhausted');}
});
test('D11 errors or incompatible proof release pending; missing finish confirmation is not success',async()=>{
 for(const change of [g=>g.preflightThrows=true,g=>g.proof.effectAuthorized=true,g=>g.proof.orderSn='OTHERORDER1']){
 const g=fixture();change(g);const r=await g.run({accountId:A});assert.equal(r.ok,false);assert.equal(r.leaseReleased,true);assert.deepEqual(g.calls,['acquire','preflight','finish']);}
 for(const change of [g=>g.finishThrows=true,g=>g.finish=null]){
 const g=fixture();change(g);const r=await g.run({accountId:A});assert.equal(r.code,'d11_round_finish_unconfirmed');assert.equal(r.ok,false);assert.deepEqual(g.calls,['acquire','preflight','finish']);}
});

test('D11 round preserves confirmed import and releases pending only after exact proof',async()=>{
 const f=fixture(true);f.proof={...f.proof,code:'d11_intake_written',ordersWritten:1,separationId:L};
 const r=await f.run({accountId:A});assert.equal(r.ok,true);assert.equal(r.ordersWritten,1);
 assert.equal(r.leaseReleased,true);assert.equal(r.effectAuthorized,false);assert.equal(f.code,'d11_intake_written');
 assert.deepEqual(f.calls,['acquire','preflight','finish']);
});
test('D11 round never releases uncertain or late intake and never erases confirmed write on lost finish ACK',async()=>{
 for(const [count,code] of [[null,'d11_intake_commit_unconfirmed'],[1,'d11_intake_written_requires_reconciliation']]){
 const f=fixture(true);f.proof={ok:false,code,ordersWritten:count,reconciliationRequired:true};
 const r=await f.run({accountId:A});assert.equal(r.ordersWritten,count);assert.equal(r.reconciliationRequired,true);
 assert.equal(r.leaseReleased,false);assert.deepEqual(f.calls,['acquire','preflight']);
 }
 const f=fixture(true);f.proof={...f.proof,code:'d11_intake_written',ordersWritten:1,separationId:L};
 f.finish=null;const r=await f.run({accountId:A});assert.equal(r.ordersWritten,1);assert.equal(r.reconciliationRequired,true);
 assert.deepEqual(f.calls,['acquire','preflight','finish']);
});
