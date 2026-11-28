// Single bounded round on the existing Core lease and queue. Reuse discovery,
// intake, protected shipping and label executors. Internal caller only.
import {createD11BridgeAdapters} from './shopee-d11-bridge-adapter.mjs';
import {createD11RecurringPreflight} from './shopee-d11-recurring-preflight.mjs';
import {createD11DiscoveryPage} from './shopee-d11-discovery-page.mjs';
import {createD11ShipExecutor} from './shopee-d11-ship-executor.mjs';
import {createD11LabelExecutor} from './shopee-d11-label-executor.mjs';
import {createD11Refresh} from './shopee-d11-refresh.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id=v=>typeof v==='string'&&UUID.test(v);
const SN=/^[A-Za-z0-9]{8,100}$/;
const legacy=new Set(['8a8ad166-0317-4597-8be6-e43fb46b4d1b','b4027369-5abf-4ac1-ab24-862334fae892']);
const result=(ok,code,extra={})=>({ok,code,ordersWritten:0,effects:0,physicalHandoffConfirmed:false,...extra});
export function createD11RecurringRound({enabled=false,intakeCommitEnabled=false,now=Date.now,call,getEnv=k=>process.env[k],
 adapters=createD11BridgeAdapters({enabled,call}),
 preflight=createD11RecurringPreflight({enabled,intakeCommitEnabled,now,call,adapters}),
 discover=createD11DiscoveryPage({enabled,now,call,getEnv,adapters}),
 refresh=createD11Refresh({enabled,now,call,getEnv,adapters}),
 makeShip=createD11ShipExecutor,makeLabel=createD11LabelExecutor}={}){
 return async function run({accountId,discoveryTurn=false}={}){
  if(enabled!==true||getEnv('SHOPEE_D11_RECURRING_ENABLED')!=='true')return result(false,'d11_round_disabled');
  if(!id(accountId)||legacy.has(accountId.toLowerCase())||typeof discoveryTurn!=='boolean')return result(false,'d11_round_account_refused');
  const started=now();
  let lease;
  try{lease=await adapters.acquirePreflight(accountId)}catch{return result(false,'d11_round_acquire_unconfirmed');}
  if(lease?.status!=='acquired'||lease.channel_account_id!==accountId||!id(lease.lease_id)
    ||!Number.isSafeInteger(lease.policy_revision)||lease.policy_revision<1
    ||!Number.isSafeInteger(lease.work_budget_ms)||lease.work_budget_ms<1||lease.work_budget_ms>48000
    ||!Number.isFinite(Date.parse(lease.expires_at))
    ||!(lease.candidate_order_sn===null||SN.test(lease.candidate_order_sn)))
   return result(false,'d11_round_acquire_unconfirmed');
  const scope={accountId,leaseId:lease.lease_id,revision:lease.policy_revision,orderSn:lease.candidate_order_sn};
  const deadline=Math.min(started+lease.work_budget_ms,Date.parse(lease.expires_at)-1000);
  const within=()=>now()>=started&&now()<deadline;
  let writes=0,effects=0;
  const finish=async(code,r)=>{
   try{
    const f=await adapters.finishPreflight(scope,code);
    if(f?.status==='finished')return {...r,leaseReleased:true,queueOutcome:code==='d11_label_available'?'complete':code==='d11_effect_requires_review'?'blocked':'pending'};
   }catch{}
   return result(false,'d11_round_finish_unconfirmed',{ordersWritten:writes,effects,leaseReleased:false,reconciliationRequired:true,orderSn:scope.orderSn});
  };
  // OAuth rotation is a separate round under the same lease. Acknowledged
  // rotation is not an order/label effect; ambiguous rotation halts only this account.
  try{
   const a=await refresh({...scope,deadline});
   if(a?.ok===true&&a.code==='d11_oauth_refreshed')
    return finish('d11_oauth_refreshed',result(true,a.code,{oauthRefreshed:true}));
   if(a?.code==='cycle_refresh_or_discovery_uncertain')
    return finish(a.code,result(false,a.code,{reconciliationRequired:true}));
   if(a?.ok!==true||a.code!=='d11_oauth_current')
    return finish('d11_oauth_refresh_not_admitted',result(false,'d11_oauth_refresh_not_admitted'));
  }catch{return finish('cycle_refresh_or_discovery_uncertain',result(false,'cycle_refresh_or_discovery_uncertain',{reconciliationRequired:true}));}
  // Discovery always gets a turn even with pending documents, through the
  // internal cadence selector. A successful checkpoint releases this lease.
  if(scope.orderSn===null||discoveryTurn){
   try{
    if(!within())return finish(scope.orderSn===null?'d11_preflight_no_candidate':'d11_preflight_budget_exhausted',result(false,'d11_round_budget_exhausted'));
    const d=await discover({...scope,deadline});
    if(d?.ok===true&&d.code==='d11_discovery_checkpointed'&&d.leaseReleased===true&&d.ordersWritten===0&&d.effects===0)return {...d,physicalHandoffConfirmed:false};
    if(!d||d.checkpointAttempted||d.ok===true)return result(false,'d11_discovery_checkpoint_unconfirmed',{reconciliationRequired:true,leaseReleased:false});
    return finish(scope.orderSn===null?'d11_preflight_no_candidate':'d11_preflight_unavailable',result(false,d.code??'d11_discovery_unavailable'));
   }catch{return result(false,'d11_discovery_checkpoint_unconfirmed',{reconciliationRequired:true,leaseReleased:false});}
  }
  try{
   if(!within())return finish('d11_preflight_budget_exhausted',result(false,'d11_round_budget_exhausted'));
   const p=await preflight({...scope,deadline,expectedOrderSn:scope.orderSn});
   if(p?.reconciliationRequired||p?.ordersWritten===null){
    writes=p.ordersWritten===1?1:null;
    return finish('d11_effect_requires_review',result(false,'d11_intake_requires_review',{ordersWritten:writes,reconciliationRequired:true}));
   }
   if(p?.ok===true&&p.code==='d11_intake_written'&&p.ordersWritten===1&&p.accountId===accountId
     &&p.orderSn===scope.orderSn&&id(p.orderId)&&id(p.separationId)&&id(p.observationId)&&p.effects===0&&p.effectAuthorized===false){
    writes=1;
    // Commit and dispatch are separate turns. A fresh reconciliation on the
    // next lease avoids reusing a pre-commit observation as effect authority.
    return finish('d11_intake_written',result(true,'d11_intake_written',{ordersWritten:1,orderSn:scope.orderSn,orderId:p.orderId}));
   }
   if(!within()||p?.ok!==true||p.code!=='d11_preflight_verified_existing'||p.accountId!==accountId
     ||p.orderSn!==scope.orderSn||!id(p.orderId)||!id(p.observationId)||p.ordersWritten!==0||p.effects!==0
     ||p.outcome!=='pending'||p.effectAuthorized!==false)
    return finish('d11_preflight_reconciliation_refused',result(false,'d11_round_reconciliation_refused'));
   const pin={...scope,observationId:p.observationId};
   // Choose by the Core's current receipt and capability, not caller order
   // status. At most one external effect per round, never ship then label
   // on the same observation.
   const shipScope=await adapters.readEffectScope({...pin,effect:'ship'});
   const labelScope=within()&&!shipScope?await adapters.readEffectScope({...pin,effect:'label'}):null;
   const effect=shipScope?.status==='effect_scope'&&shipScope.effect==='ship'?'ship':
    labelScope?.status==='effect_scope'&&labelScope.effect==='label'?'label':null;
   if(!within()||!effect)return finish('d11_effect_pending',result(false,'d11_round_effect_not_eligible'));
   // Pass the already verified result, not another expensive read/observation.
   // Both executors independently recheck receipt and live detail before any
   // claim, transport, or attachment.
   let served=false;
   const reconcile=async q=>{
    if(served||!within()||q.accountId!==accountId||q.leaseId!==scope.leaseId||q.revision!==scope.revision
     ||q.expectedOrderSn!==scope.orderSn)return {ok:false};
    served=true;return p;
   };
   const execute=(effect==='ship'?makeShip:makeLabel)({enabled,now,call,getEnv,adapters,reconcile});
   const x=await execute({...scope,deadline});
   effects=x?.effects===0||x?.effects===1?x.effects:null;
   if(x?.reconciliationRequired===true||effects===null)
    return finish('d11_effect_requires_review',result(false,'d11_round_effect_requires_review',{effects,reconciliationRequired:true}));
   if(effect==='label'&&x?.ok===true&&['label_attached','already_available'].includes(x.code)&&id(x.documentId))
    return finish('d11_label_available',result(true,x.code,{effects,documentId:x.documentId,orderSn:scope.orderSn}));
   return finish('d11_effect_pending',result(x?.ok===true||['document_task_created_check_later','document_processing'].includes(x?.code),
     x?.code??'d11_round_effect_pending',{effects,orderSn:scope.orderSn}));
  }catch{
   // The unknown operation is never replayed in this round. The existing
   // queue quarantines the selected candidate while other orders can proceed.
   return finish('d11_effect_requires_review',result(false,'d11_round_unconfirmed',{ordersWritten:writes===1?1:null,effects:null,reconciliationRequired:true}));
  }
 };
}
