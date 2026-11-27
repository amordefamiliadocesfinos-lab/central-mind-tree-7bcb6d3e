import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCyclePolicy } from '../../../supabase/functions/integration-core-bridge/cycle-policy.mjs';
const account='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const now=Date.parse('2026-11-27T20:00:00Z');
function fixture(){
  return {accountId:account,action:'ship',now,
    channel:{id:account,is_active:true,marketplace:'shopee'},
    connection:{channel_account_id:account,environment:'live',shop_id:123,partner_id:2047685,shop_status:'NORMAL',authorization_expires_at:'2027-11-27T20:00:00Z'},
    policy:{channel_account_id:account,environment:'live',shop_id:123,partner_id:2047685,
      enabled:true,paused:false,revision:1,authorized_by:other,evidence_ref:'approval/fixture-1',
      authorized_at:'2026-11-27T19:00:00Z',expires_at:'2026-11-28T20:00:00Z',
      capabilities:{discover:true,intake:true,ship:true,label:true,refresh:true},
      page_size:5,max_actions_per_cycle:1,work_budget_ms:48000,history_cutoff:Math.floor(now/1000)-3600,
      fiscal_mode:'cpf_no_invoice_step',shipping_mode:'simple_dropoff',
      shipping_evidence_ref:'proof/fixture',document_type:'NORMAL_AIR_WAYBILL'}};
}
test('D11 policy admits exact independently authorized account and action',()=>{
  const f=fixture(),result=resolveCyclePolicy(f);
  assert.equal(result.code,'policy_admitted');
  assert.equal(result.profile.account,account);
  assert.equal(result.profile.shop,123);
  assert.equal(result.profile.action,'ship');
  assert.equal(Object.isFrozen(result.profile),true);
  assert.equal(Object.hasOwn(result.profile,'authorized_by'),false);
  assert.equal(Object.hasOwn(result.profile,'access_token'),false);
});
test('D11 OAuth or public metadata alone never authorizes operational effects',()=>{
  const f=fixture();
  assert.equal(resolveCyclePolicy({...f,policy:null,channel:{...f.channel,metadata:{enabled:true}}}).code,'policy_absent_or_disabled');
  f.policy.enabled=false; assert.equal(resolveCyclePolicy(f).ok,false);
});
test('D11 rejects cross-account, shop, partner, environment and inactive channel',()=>{
  for(const [target,change] of [
    ['policy',{channel_account_id:other}],['connection',{channel_account_id:other}],
    ['connection',{shop_id:321}],['connection',{partner_id:654}],
    ['connection',{environment:'test'}],['channel',{is_active:false}],['channel',{marketplace:'other'}]]){
    const f=fixture();Object.assign(f[target],change);
    assert.equal(resolveCyclePolicy(f).code,'policy_identity_mismatch');
  }
});
test('D11 rejects expired authorization and unavailable shop',()=>{
  for(const change of [{shop_status:'FROZEN'},{authorization_expires_at:'2026-11-27T20:00:00Z'},{authorization_expires_at:null}]){
    const f=fixture();Object.assign(f.connection,change);assert.equal(resolveCyclePolicy(f).code,'policy_connection_unavailable');
  }
});
test('D11 rejects expired, future, missing authority and invalid timestamps',()=>{
  for(const change of [{expires_at:'2026-11-27T20:00:00Z'},{authorized_at:'2026-11-27T21:00:00Z'},
    {authorized_by:null},{evidence_ref:''},{revision:0},{expires_at:'2026-11-31T20:00:00Z'}]){
    const f=fixture();Object.assign(f.policy,change);
    assert.equal(resolveCyclePolicy(f).code,'policy_authority_invalid_or_expired');
  }
});
test('D11 individual capabilities are explicit, dependent and pause overrides all',()=>{
  const f=fixture();f.policy.paused=true;assert.equal(resolveCyclePolicy(f).code,'policy_paused');
  f.policy.paused=false;f.policy.capabilities.ship=false;
  assert.equal(resolveCyclePolicy(f).code,'policy_action_disabled');
  assert.equal(resolveCyclePolicy({...f,action:'discover'}).ok,true);
  f.policy.capabilities.intake=false;assert.equal(resolveCyclePolicy(f).code,'policy_dependencies_invalid');
  f.policy.capabilities.intake=true;f.policy.capabilities.ship='true';
  assert.equal(resolveCyclePolicy(f).code,'policy_capabilities_invalid');
});
test('D11 rejects unsupported fiscal/logistics/document policy and unsafe limits',()=>{
  for(const [change,code] of [
    [{fiscal_mode:'unknown'},'policy_shipping_unhomologated'],[{shipping_mode:'pickup'},'policy_shipping_unhomologated'],
    [{shipping_evidence_ref:''},'policy_shipping_unhomologated'],[{document_type:'unknown'},'policy_document_unsupported'],
    [{page_size:6},'policy_limits_invalid'],[{max_actions_per_cycle:4},'policy_limits_invalid'],
    [{work_budget_ms:48001},'policy_limits_invalid'],[{history_cutoff:Math.floor(now/1000)+1},'policy_limits_invalid']]){
    const f=fixture();Object.assign(f.policy,change);assert.equal(resolveCyclePolicy(f).code,code);
  }
});
test('D11 read-only policy needs no fiscal mode and cannot authorize shipping',()=>{
  const f=fixture();f.policy.capabilities={discover:true,intake:false,ship:false,label:false,refresh:false};
  f.policy.fiscal_mode=null;f.policy.shipping_mode=null;f.policy.document_type=null;
  assert.equal(resolveCyclePolicy({...f,action:'discover'}).ok,true);
  assert.equal(resolveCyclePolicy(f).ok,false);
  assert.equal(resolveCyclePolicy({...f,action:'arbitrary'}).code,'policy_input_invalid');
});
