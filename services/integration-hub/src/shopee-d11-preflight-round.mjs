// D11 internal round, default-off. One Core-selected candidate, one release.
// Optional protected intake only. No discovery, effect claim, label, refresh or scheduler.
import {createD11BridgeAdapters} from './shopee-d11-bridge-adapter.mjs';
import {createD11RecurringPreflight} from './shopee-d11-recurring-preflight.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const legacy=new Set(['8a8ad166-0317-4597-8be6-e43fb46b4d1b','b4027369-5abf-4ac1-ab24-862334fae892']);
const id=v=>typeof v==='string'&&UUID.test(v);
const codes=new Set(['d11_preflight_scope_refused','d11_preflight_budget_exhausted','d11_preflight_observation_refused','d11_preflight_reconciliation_refused','d11_preflight_unavailable']);
const result=(ok,code,extra={})=>({ok,code,ordersWritten:0,effects:0,effectAuthorized:false,...extra});
export function createD11PreflightRound({enabled=false,intakeCommitEnabled=false,now=Date.now,call,
 adapters=createD11BridgeAdapters({enabled,call}),
 preflight=createD11RecurringPreflight({enabled,intakeCommitEnabled,now,call,adapters})}={}){
 return async function run({accountId}={}){
  if(enabled!==true)return result(false,'d11_round_disabled');
  if(!id(accountId)||legacy.has(accountId.toLowerCase()))return result(false,'d11_round_account_refused');
  const started=now();
  let lease;
  try{lease=await adapters.acquirePreflight(accountId)}catch{return result(false,'d11_round_acquire_unconfirmed');}
  if(lease?.status!=='acquired'||lease.channel_account_id!==accountId||!id(lease.lease_id)
    ||!Number.isSafeInteger(lease.policy_revision)||lease.policy_revision<1
    ||!Number.isSafeInteger(lease.work_budget_ms)||lease.work_budget_ms<1||lease.work_budget_ms>48000
    ||!Number.isFinite(Date.parse(lease.expires_at))
    ||!(lease.candidate_order_sn===null||(typeof lease.candidate_order_sn==='string'&&/^[A-Za-z0-9]{8,100}$/.test(lease.candidate_order_sn))))
   return result(false,'d11_round_acquire_unconfirmed');
  const scope={accountId,leaseId:lease.lease_id,revision:lease.policy_revision,orderSn:lease.candidate_order_sn};
  const deadline=Math.min(started+lease.work_budget_ms,Date.parse(lease.expires_at)-1000);
  let r=result(false,'d11_preflight_unavailable');
  try{
   if(scope.orderSn===null)r=result(true,'d11_preflight_no_candidate');
   else if(now()<started||now()>=deadline)r=result(false,'d11_preflight_budget_exhausted');
   else{
    const p=await preflight({accountId,leaseId:scope.leaseId,revision:scope.revision,expectedOrderSn:scope.orderSn,deadline});
    if(p?.reconciliationRequired===true||p?.ordersWritten===null||p?.ordersWritten===1&&(
      intakeCommitEnabled!==true||p.ok!==true||p.code!=='d11_intake_written'||p.accountId!==accountId
      ||p.orderSn!==scope.orderSn||!id(p.orderId)||!id(p.separationId)||!id(p.observationId)||!id(p.rawId)
      ||p.effects!==0||p.effectAuthorized!==false||p.outcome!=='pending'||now()>=deadline||now()<started))
      return result(false,'d11_round_intake_requires_reconciliation',{ordersWritten:p.ordersWritten===1?1:null,
       leaseId:scope.leaseId,orderSn:scope.orderSn,reconciliationRequired:true,leaseReleased:false});
    if(intakeCommitEnabled===true&&p?.ok===true&&p.code==='d11_intake_written'&&p.ordersWritten===1)
      r=result(true,p.code,{ordersWritten:1,orderSn:scope.orderSn,orderId:p.orderId,separationId:p.separationId,
       observationId:p.observationId,rawId:p.rawId});
    else if(now()>=deadline||now()<started)r=result(false,'d11_preflight_budget_exhausted');
    else if(p?.ok===true&&p.code==='d11_preflight_verified_existing'&&p.accountId===accountId&&p.orderSn===scope.orderSn
      &&id(p.orderId)&&id(p.observationId)&&id(p.rawId)&&p.ordersWritten===0&&p.effects===0
      &&p.outcome==='pending'&&p.effectAuthorized===false)
      r=result(true,p.code,{orderSn:scope.orderSn,orderId:p.orderId,observationId:p.observationId,rawId:p.rawId});
    else r=result(false,codes.has(p?.code)?p.code:'d11_preflight_unavailable');
   }
  }catch{
   if(intakeCommitEnabled===true)return result(false,'d11_round_intake_requires_reconciliation',{
    ordersWritten:null,leaseId:scope.leaseId,orderSn:scope.orderSn,reconciliationRequired:true,leaseReleased:false});
   r=result(false,'d11_preflight_unavailable');
  }
  // Even after a pause/budget expiry, attempt only the legitimate release.
  // Missing acknowledgement never promotes success and is never retried here.
  try{
   const f=await adapters.finishPreflight(scope,r.code);
   if(f?.status!=='finished')return result(false,'d11_round_finish_unconfirmed',{leaseId:scope.leaseId,ordersWritten:r.ordersWritten,reconciliationRequired:r.ordersWritten===1});
  }catch{return result(false,'d11_round_finish_unconfirmed',{leaseId:scope.leaseId,ordersWritten:r.ordersWritten,reconciliationRequired:r.ordersWritten===1});}
  return {...r,leaseReleased:true,outcome:'pending'};
 };
}
