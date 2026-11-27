// Protected D11 reader. Not imported by the live bridge.
// Only the service-side RPC supplies policy and canonical connection identity.
import {resolveCyclePolicy} from './cycle-policy.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS=new Set(['discover','intake','ship','label','refresh']);
const denied=code=>({ok:false,code});
function utc(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))return null;
  const t=Date.parse(value);
  return Number.isFinite(t)?new Date(t).toISOString():null;
}
export async function readCyclePolicy(core,{accountId,action,now=Date.now()}={}){
  if(typeof accountId!=='string'||!UUID.test(accountId)||!ACTIONS.has(action))return denied('policy_input_invalid');
  try{
    const {data,error}=await core.rpc('read_shopee_cycle_policy',{p_channel_account_id:accountId});
    if(error)return denied('policy_storage_unavailable');
    if(!data)return denied('policy_absent_or_disabled');
    const {policy,channel,connection}=data;
    if(!policy||!channel||!connection)return denied('policy_storage_invalid');
    return resolveCyclePolicy({accountId,action,now,channel,
      policy:{...policy,authorized_at:utc(policy.authorized_at),expires_at:utc(policy.expires_at)},
      connection:{...connection,authorization_expires_at:utc(connection.authorization_expires_at)}});
  }catch{return denied('policy_storage_unavailable');}
}
export async function checkCyclePolicyLease(core,{accountId,leaseId,revision,action}={}){
  if(!UUID.test(accountId??'')||!UUID.test(leaseId??'')||!Number.isSafeInteger(revision)||revision<1||!ACTIONS.has(action))
    return denied('policy_lease_input_invalid');
  try{
    const {data,error}=await core.rpc('check_shopee_cycle_policy_lease',{
      p_channel_account_id:accountId,p_lease_id:leaseId,p_revision:revision,p_action:action});
    if(error)return denied('policy_lease_unavailable');
    return data===true?{ok:true,code:'policy_lease_current'}:denied('policy_lease_refused');
  }catch{return denied('policy_lease_unavailable');}
}
