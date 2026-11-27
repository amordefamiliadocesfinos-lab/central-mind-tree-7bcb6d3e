import test from 'node:test';
import assert from 'node:assert/strict';
import {readCyclePolicy,checkCyclePolicyLease} from '../../../supabase/functions/integration-core-bridge/cycle-policy-reader.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NOW=Date.parse('2026-11-27T20:00:00Z');
const fixture=()=>({
  policy:{channel_account_id:A,revision:2,environment:'live',shop_id:123,partner_id:2047685,
    enabled:true,paused:false,authorized_by:B,authorized_at:'2026-11-27T16:00:00.123456-03:00',
    expires_at:'2026-11-27T21:00:00+00:00',evidence_ref:'fixture/proof',
    capabilities:{discover:true,intake:false,ship:false,label:false,refresh:false},
    page_size:5,max_actions_per_cycle:1,work_budget_ms:48000,history_cutoff:Math.floor(NOW/1000)-3600},
  channel:{id:A,is_active:true,marketplace:'shopee'},
  connection:{channel_account_id:A,environment:'live',shop_id:123,partner_id:2047685,
    shop_status:'NORMAL',authorization_expires_at:'2027-11-27T20:00:00+00:00'}
});
test('D11 reader normalizes canonical Postgres timestamps and returns no authority secrets',async()=>{
  const r=await readCyclePolicy({rpc:async(name,args)=>{
    assert.equal(name,'read_shopee_cycle_policy');assert.deepEqual(args,{p_channel_account_id:A});
    return {data:fixture(),error:null};
  }},{accountId:A,action:'discover',now:NOW});
  assert.equal(r.ok,true);assert.equal(r.profile.revision,2);
  assert.equal(r.profile.expires_at,'2026-11-27T21:00:00.000Z');
  assert.equal(Object.hasOwn(r.profile,'authorized_by'),false);
});
test('D11 reader refuses absent, unavailable, malformed and mismatched canonical records',async()=>{
  for(const [response,code] of [
    [{data:null},'policy_absent_or_disabled'],[{error:{message:'private detail'}},'policy_storage_unavailable'],
    [{data:{policy:{}}},'policy_storage_invalid'],
    [{data:{...fixture(),connection:{...fixture().connection,shop_id:321}}},'policy_identity_mismatch'],
    [{data:{...fixture(),policy:{...fixture().policy,paused:true}}},'policy_paused'],
    [{data:{...fixture(),policy:{...fixture().policy,expires_at:'bad'}}},'policy_authority_invalid_or_expired']
  ]){
    const r=await readCyclePolicy({rpc:async()=>response},{accountId:A,action:'discover',now:NOW});
    assert.deepEqual(r,{ok:false,code});
  }
});
test('D11 reader does not accept external capability or profile override',async()=>{
  const r=await readCyclePolicy({rpc:async()=>({data:fixture()})},{
    accountId:A,action:'ship',now:NOW,policy:{enabled:true,capabilities:{ship:true}}
  });assert.equal(r.code,'policy_action_disabled');
});
test('D11 fence accepts only exact boolean true and validates action/lease/revision',async()=>{
  let calls=0;
  const core={rpc:async(name,args)=>{calls++;assert.equal(name,'check_shopee_cycle_policy_lease');
    assert.deepEqual(args,{p_channel_account_id:A,p_lease_id:B,p_revision:2,p_action:'discover'});return {data:true};}};
  assert.equal((await checkCyclePolicyLease(core,{accountId:A,leaseId:B,revision:2,action:'discover'})).ok,true);
  assert.equal((await checkCyclePolicyLease(core,{accountId:A,leaseId:B,revision:0,action:'discover'})).ok,false);
  assert.equal(calls,1);
  for(const data of [false,null,'true',1])assert.equal((await checkCyclePolicyLease({rpc:async()=>({data})},
    {accountId:A,leaseId:B,revision:2,action:'discover'})).code,'policy_lease_refused');
  assert.equal((await checkCyclePolicyLease({rpc:async()=>{throw Error('timeout')}},
    {accountId:A,leaseId:B,revision:2,action:'discover'})).code,'policy_lease_unavailable');
});
