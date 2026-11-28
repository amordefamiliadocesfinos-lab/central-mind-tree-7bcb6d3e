// D11 protected bridge candidate. Default-off at the authenticated dispatcher.
// No new public Hub route. Core policy and lease remain the authority.
import {readCyclePolicy,checkCyclePolicyLease} from './cycle-policy-reader.mjs';
import {createProtectedReconciliationReader} from './cycle-reconciliation-reader.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SN=/^[A-Za-z0-9]{8,100}$/;
const HASH=/^[0-9a-f]{64}$/;
const LEGACY=new Set(['8a8ad166-0317-4597-8be6-e43fb46b4d1b','b4027369-5abf-4ac1-ab24-862334fae892']);
const scopeKeys=['channel_account_id','lease_id','revision'];
export const D11_ACTIONS=Object.freeze(['shopee.d11.scope.read','shopee.d11.observation.record','shopee.d11.effect.claim','shopee.d11.reconcile.read','shopee.d11.reconcile.verify','shopee.d11.preflight.acquire','shopee.d11.preflight.finish','shopee.d11.discovery.scope','shopee.d11.discovery.finish','shopee.d11.intake.read','shopee.d11.intake.commit']);
const id=v=>typeof v==='string'&&UUID.test(v);
const text=(v,re)=>typeof v==='string'&&re.test(v);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const positive=v=>Number.isSafeInteger(v)&&v>0;
const iso=v=>typeof v==='string'&&v.length<=40&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v));
export function validateD11Payload(p){
 if(!object(p)||!D11_ACTIONS.includes(p.action)||!id(p.channel_account_id)||LEGACY.has(p.channel_account_id.toLowerCase()) )return false;
 if(p.action===D11_ACTIONS[5])return exact(p,['action','channel_account_id']);
 if(!id(p.lease_id)||!positive(p.revision))return false;
 const base=['action',...scopeKeys];
 if(p.action===D11_ACTIONS[0]||p.action===D11_ACTIONS[7])return exact(p,base);
 if(p.action===D11_ACTIONS[8])return exact(p,[...base,'list_hash','detail_hashes'])&&text(p.list_hash,HASH)
  &&object(p.detail_hashes)&&Object.keys(p.detail_hashes).length<=5
  &&Object.entries(p.detail_hashes).every(([k,v])=>text(k,SN)&&text(v,HASH));
 if(p.action===D11_ACTIONS[6])return exact(p,[...base,'candidate_order_sn','code'])
  &&(p.candidate_order_sn===null||text(p.candidate_order_sn,SN))
  &&['d11_preflight_verified_existing','d11_preflight_no_candidate','d11_preflight_scope_refused','d11_preflight_budget_exhausted','d11_preflight_observation_refused','d11_preflight_reconciliation_refused','d11_preflight_unavailable'].includes(p.code)
  &&((p.candidate_order_sn===null)===(p.code==='d11_preflight_no_candidate'));
 if(p.action===D11_ACTIONS[3]||p.action===D11_ACTIONS[9])return exact(p,[...base,'observation_id'])&&id(p.observation_id);
 if(p.action===D11_ACTIONS[4]||p.action===D11_ACTIONS[10])return exact(p,[...base,'observation_id','projection'])&&id(p.observation_id)&&object(p.projection);
 if(!positive(p.shop_id)||!text(p.order_sn,SN))return false;
 if(p.action===D11_ACTIONS[1])return exact(p,[...base,'shop_id','order_sn','payload_hash','payload','official_request_id','request_started_at','response_received_at'])
  &&text(p.payload_hash,HASH)&&object(p.payload)&&text(p.official_request_id,/^[A-Za-z0-9_.:-]{1,160}$/)
  &&iso(p.request_started_at)&&iso(p.response_received_at);
 return exact(p,[...base,'shop_id','order_sn','package_number','request_hash','observation_id','effect'])
  &&['ship','label'].includes(p.effect)&&text(p.package_number,/^[A-Za-z0-9_-]{1,100}$/)
  &&text(p.request_hash,HASH)&&id(p.observation_id);
}
const blocked=code=>({status:409,body:{status:'blocked',code}});
const unavailable=()=>({status:503,body:{error:'d11_bridge_unavailable'}});
export async function executeD11BridgeAction(core,p,{enabled=false,now=Date.now,readPolicy=readCyclePolicy,checkLease=checkCyclePolicyLease,prepareReconciliation=createProtectedReconciliationReader}={}){
 if(enabled!==true)return {status:503,body:{error:'d11_bridge_not_enabled'}};
 if(!validateD11Payload(p))return {status:400,body:{error:'invalid_request'}};
 if(p.action===D11_ACTIONS[7]||p.action===D11_ACTIONS[8]){
  try{
   const read=p.action===D11_ACTIONS[7];
   const args={p_account:p.channel_account_id,p_lease:p.lease_id,p_revision:p.revision};
   const r=await core.rpc(read?'read_shopee_d11_discovery_scope':'finish_shopee_d11_discovery',read?args:
    {...args,p_list_hash:p.list_hash,p_detail_hashes:p.detail_hashes});
   if(r.error)return unavailable();
   if(!r.data)return blocked('d11_discovery_scope_refused');
   if(!read)return r.data.status==='finished'?{status:200,body:{status:'finished',listed:r.data.listed,eligible:r.data.eligible}}:blocked('d11_discovery_checkpoint_refused');
   const v=r.data;
   if(v.channel_account_id!==p.channel_account_id||v.lease_id!==p.lease_id||v.revision!==p.revision
     ||!positive(v.shop_id)||v.partner_id!==2047685||!positive(v.history_cutoff)
     ||!positive(v.page_size)||v.page_size>5||!positive(v.work_budget_ms)||v.work_budget_ms>48000
     ||!positive(v.time_from)||!positive(v.time_to)||v.time_to<=v.time_from||v.time_to-v.time_from>604800
     ||!(v.cursor===null||(typeof v.cursor==='string'&&v.cursor.length>0&&v.cursor.length<=2048))
     ||!iso(v.expires_at)||!iso(v.lease_started_at))return unavailable();
   return {status:200,body:{status:'discovery_scope',channel_account_id:v.channel_account_id,lease_id:v.lease_id,
    revision:v.revision,shop_id:v.shop_id,partner_id:v.partner_id,history_cutoff:v.history_cutoff,
    page_size:v.page_size,work_budget_ms:v.work_budget_ms,time_from:v.time_from,time_to:v.time_to,
    cursor:v.cursor,candidate_order_sn:v.candidate_order_sn,lease_started_at:v.lease_started_at,expires_at:v.expires_at}};
  }catch{return unavailable();}
 }
 if(p.action===D11_ACTIONS[5]||p.action===D11_ACTIONS[6]){
  try{
   const acquire=p.action===D11_ACTIONS[5];
   const r=await core.rpc(acquire?'acquire_shopee_d11_preflight':'finish_shopee_d11_preflight',acquire?
    {p_account:p.channel_account_id}:{p_account:p.channel_account_id,p_lease:p.lease_id,p_revision:p.revision,p_candidate:p.candidate_order_sn,p_code:p.code});
   if(r.error||!r.data)return unavailable();
   if(!acquire)return r.data.status==='finished'?{status:200,body:{status:'finished'}}:blocked('d11_preflight_finish_refused');
   const v=r.data;
   if(v.status!=='acquired')return blocked(['busy','account_refused','account_halted'].includes(v.status)?v.status:'d11_preflight_acquire_refused');
   if(v.channel_account_id!==p.channel_account_id||!id(v.lease_id)||!positive(v.policy_revision)||!iso(v.expires_at)
    ||!positive(v.work_budget_ms)||v.work_budget_ms>48000||!(v.candidate_order_sn===null||text(v.candidate_order_sn,SN)))return unavailable();
   return {status:200,body:{status:'acquired',channel_account_id:v.channel_account_id,lease_id:v.lease_id,
    policy_revision:v.policy_revision,candidate_order_sn:v.candidate_order_sn,expires_at:v.expires_at,work_budget_ms:v.work_budget_ms}};
  }catch{return unavailable();}
 }
 const scope={accountId:p.channel_account_id,leaseId:p.lease_id,revision:p.revision};
 const action=p.action===D11_ACTIONS[2]?p.effect:'intake';
 try{
  const result=await readPolicy(core,{accountId:scope.accountId,action,now:now()});
  const profile=result?.profile;
  if(result?.ok!==true||profile?.account!==scope.accountId||profile.revision!==scope.revision
     ||profile.partner!==2047685||profile.action!==action||!positive(profile.shop)||!positive(profile.history_cutoff))
    return blocked('d11_policy_refused');
  if(!(await checkLease(core,{...scope,action}))?.ok)return blocked('d11_lease_refused');
  const {data:v,error}=await core.from('shopee_cycle_state')
   .select('channel_account_id,lease_id,lease_policy_revision,lease_expires_at,candidate_order_sn,updated_at,halted_code')
   .eq('channel_account_id',scope.accountId).maybeSingle();
  if(error||!v||v.channel_account_id!==scope.accountId||v.lease_id!==scope.leaseId||v.lease_policy_revision!==scope.revision
   ||v.halted_code!==null||!text(v.candidate_order_sn,SN)||!iso(v.updated_at)||!iso(v.lease_expires_at)
   ||Date.parse(v.updated_at)>now())return blocked('d11_candidate_refused');
  const expires=Math.min(Date.parse(v.lease_expires_at),Date.parse(profile.expires_at));
  if(!Number.isFinite(expires)||expires<=now())return blocked('d11_lease_refused');
  const q=await core.from('shopee_cycle_orders').select('channel_account_id,order_sn,state')
   .eq('channel_account_id',scope.accountId).eq('order_sn',v.candidate_order_sn).maybeSingle();
  if(q.error||q.data?.channel_account_id!==scope.accountId||q.data?.order_sn!==v.candidate_order_sn||q.data?.state!=='pending')
    return blocked('d11_candidate_refused');
  if(p.action===D11_ACTIONS[0]){
    if(!(await checkLease(core,{...scope,action}))?.ok)return blocked('d11_lease_refused');
    return {status:200,body:{ok:true,accountId:scope.accountId,leaseId:scope.leaseId,revision:scope.revision,
     partnerId:profile.partner,shopId:profile.shop,orderSn:v.candidate_order_sn,historyCutoff:profile.history_cutoff,
     leaseStartedAt:v.updated_at,expiresAt:new Date(expires).toISOString(),
     workBudgetMs:profile.work_budget_ms,maxActionsPerCycle:profile.max_actions_per_cycle,pageSize:profile.page_size}};
  }
  if(p.action===D11_ACTIONS[10]){
   if(p.projection.channel_account_id!==scope.accountId||p.projection.order_number!==v.candidate_order_sn)return blocked('d11_candidate_refused');
   const r=await core.rpc('commit_shopee_d11_intake',{p_account:scope.accountId,p_lease:scope.leaseId,p_revision:scope.revision,
    p_observation:p.observation_id,p_projection:p.projection});
   if(r.error)return unavailable();
   if(r.data?.status!=='intake_written')return blocked('d11_intake_refused');
   if(!id(r.data.order_id)||!id(r.data.separation_id)||r.data.observation_id!==p.observation_id)return unavailable();
   return {status:200,body:{status:'intake_written',channel_account_id:scope.accountId,order_number:v.candidate_order_sn,
    order_id:r.data.order_id,separation_id:r.data.separation_id,observation_id:p.observation_id}};
  }
  if(p.action===D11_ACTIONS[3]||p.action===D11_ACTIONS[4]||p.action===D11_ACTIONS[9]){
   const reader=await prepareReconciliation(core,{now,readPolicy,checkLease})({...scope,expectedObservationId:p.observation_id});
   if(reader?.ok!==true||reader.orderSn!==v.candidate_order_sn||reader.shopId!==profile.shop
    ||reader.observationId!==p.observation_id||!id(reader.rawId))return blocked('d11_reconciliation_refused');
   const b=await reader.readExistingBatch({channel_account_id:scope.accountId,order_sn:v.candidate_order_sn,limit:1});
   if(b?.ok!==true)return blocked('d11_reconciliation_refused');
   if(p.action===D11_ACTIONS[9]){
    const found=await core.from('orders').select('id,channel_account_id,channel,order_number,sale_origin,deleted_at,status,operational_status')
     .eq('channel_account_id',scope.accountId).eq('channel','shopee').eq('order_number',v.candidate_order_sn).limit(2);
    if(found.error||!Array.isArray(found.data)||found.data.length>1)return blocked('d11_intake_identity_refused');
    const o=found.data[0];
    if(o&&(!id(o.id)||o.channel_account_id!==scope.accountId||o.channel!=='shopee'||o.order_number!==v.candidate_order_sn
     ||o.sale_origin!=='shopee_open_platform'||o.deleted_at!==null||!['todo','preparing'].includes(o.operational_status)
     ||typeof o.status!=='string'||['cancelado','finalizado'].includes(o.status)))return blocked('d11_intake_identity_refused');
    if(!(await checkLease(core,{...scope,action}))?.ok)return blocked('d11_lease_refused');
    return {status:200,body:{status:'intake_batch',canonical_state:o?'existing':'absent',
     observation_id:reader.observationId,raw_id:reader.rawId,channel_account_id:scope.accountId,
     order_sn:v.candidate_order_sn,batch:b.payload}};
   }
   if(p.action===D11_ACTIONS[3])return {status:200,body:{status:'reconciliation_batch',observation_id:reader.observationId,
    raw_id:reader.rawId,channel_account_id:scope.accountId,order_sn:v.candidate_order_sn,batch:b.payload}};
   const proof=await reader.verifyCanonicalOrder(p.projection);
   if(proof?.ok!==true||proof.status!=='verified_existing'||proof.channel_account_id!==scope.accountId
    ||proof.order_number!==v.candidate_order_sn||!id(proof.order_id))return blocked('d11_reconciliation_refused');
   return {status:200,body:{ok:true,status:'verified_existing',channel_account_id:scope.accountId,
    order_number:v.candidate_order_sn,order_id:proof.order_id,observation_id:reader.observationId,raw_id:reader.rawId}};
  }
  if(p.shop_id!==profile.shop||p.order_sn!==v.candidate_order_sn)return blocked('d11_candidate_refused');
  if(p.action===D11_ACTIONS[1]){
   const bytes=new TextEncoder().encode(JSON.stringify(p.payload));
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
   if(hash!==p.payload_hash)return blocked('d11_payload_hash_refused');
   const r=await core.rpc('record_shopee_cycle_observation',{p_account:scope.accountId,p_lease:scope.leaseId,
    p_revision:scope.revision,p_shop:profile.shop,p_order:v.candidate_order_sn,p_hash:p.payload_hash,p_payload:p.payload,
    p_request:p.official_request_id,p_started:p.request_started_at,p_received:p.response_received_at});
   if(r.error)return unavailable();
   if(r.data?.status!=='observation_recorded'||!id(r.data.observation_id)||!id(r.data.raw_id))return blocked('d11_observation_refused');
   return {status:200,body:{status:'observation_recorded',observation_id:r.data.observation_id,raw_id:r.data.raw_id}};
  }
  const r=await core.rpc('claim_shopee_cycle_effect',{p_channel_account_id:scope.accountId,p_lease_id:scope.leaseId,
   p_revision:scope.revision,p_action:p.effect,p_shop_id:profile.shop,p_order_sn:v.candidate_order_sn,
   p_package_number:p.package_number,p_request_hash:p.request_hash,p_observation_id:p.observation_id});
  if(r.error)return unavailable();
  if(r.data?.status==='claimed'&&r.data.fresh===true&&id(r.data.attempt_id))
   return {status:200,body:{status:'claimed',fresh:true,attempt_id:r.data.attempt_id}};
  const codes=['already_claimed','uncertain_requires_reconciliation','claim_fingerprint_mismatch','policy_observation_refused',
   'policy_lease_refused','policy_admission_refused','policy_candidate_refused','policy_canonical_order_refused',
   'policy_history_or_package_refused','policy_external_state_refused','policy_prior_scope_requires_reconciliation'];
  return blocked(codes.includes(r.data?.status)?r.data.status:'d11_claim_refused');
 }catch{return unavailable();}
}
