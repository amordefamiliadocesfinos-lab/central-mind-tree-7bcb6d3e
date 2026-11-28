// D11 candidate preflight on an EXISTING Core lease. Optional protected intake.
// No claim, refresh,
// discovery, finish or external effect. The future scheduler owns the lease.
import {createD11BridgeAdapters,createD11BridgeObservation} from './shopee-d11-bridge-adapter.mjs';
import {buildShopeeOrderCreateRequest} from './shopee-order-writer.mjs';
import {createShopeeControlledAutoIntake} from './shopee-order-auto-intake.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SN=/^[A-Za-z0-9]{8,100}$/;
const legacy=new Set(['8a8ad166-0317-4597-8be6-e43fb46b4d1b','b4027369-5abf-4ac1-ab24-862334fae892']);
const id=v=>typeof v==='string'&&UUID.test(v);
const cap=(v,n)=>Number.isSafeInteger(v)&&v>=1&&v<=n;
const fail=code=>({ok:false,code,ordersWritten:0,effects:0});
export function createD11RecurringPreflight({enabled=false,intakeCommitEnabled=false,now=Date.now,call,
 adapters=createD11BridgeAdapters({enabled,call}),
 observe=createD11BridgeObservation({enabled,call,now}),
 intakeFactory=createShopeeControlledAutoIntake}={}){
 return async function preflight({accountId,leaseId,revision,deadline:outerDeadline=Infinity,expectedOrderSn=null}={}){
  if(enabled!==true)return fail('d11_preflight_disabled');
  if(!id(accountId)||legacy.has(accountId.toLowerCase())||!id(leaseId)||!cap(revision,2147483647))
   return fail('d11_preflight_scope_invalid');
  const scope={accountId,leaseId,revision};
  const started=now();
  let commitAttempted=false, confirmedWrite=null;
  try{
   const s=await adapters.readScope(scope);
   if(s?.ok!==true||s.accountId!==accountId||s.leaseId!==leaseId||s.revision!==revision
    ||s.partnerId!==2047685||!Number.isSafeInteger(s.shopId)||s.shopId<1||typeof s.orderSn!=='string'||!SN.test(s.orderSn)
    ||(expectedOrderSn!==null&&s.orderSn!==expectedOrderSn)
    ||!cap(s.workBudgetMs,48000)||!cap(s.maxActionsPerCycle,3)||!cap(s.pageSize,5))
    return fail('d11_preflight_scope_refused');
   const deadline=Math.min(outerDeadline,started+s.workBudgetMs,Date.parse(s.expiresAt)-1000);
   const within=()=>Number.isFinite(deadline)&&now()>=started&&now()<deadline;
   if(!within())return fail('d11_preflight_budget_exhausted');
   // One selected candidate, at most one observation. No loop or implicit retry.
   const observed=await observe({...scope,deadline});
   if(!within())return fail('d11_preflight_budget_exhausted');
   if(observed?.ok!==true||observed.code!=='observation_recorded'||observed.orderSn!==s.orderSn
    ||observed.shopId!==s.shopId||!id(observed.observationId)||!id(observed.rawId)||observed.ordersWritten!==0)
    return fail('d11_preflight_observation_refused');
   const pinned={...scope,observationId:observed.observationId};
   let delivered=false, verified=false, orderId=null, prepared=null, newOrder=false;
   if(intakeCommitEnabled===true){
    prepared=await adapters.readIntake(pinned);
    if(!within()||prepared?.status!=='intake_batch'||prepared.channel_account_id!==accountId||prepared.order_sn!==s.orderSn
     ||prepared.observation_id!==observed.observationId||prepared.raw_id!==observed.rawId
     ||!['existing','absent'].includes(prepared.canonical_state)||prepared.batch?.channel_account_id!==accountId
     ||prepared.batch?.snapshots?.length!==1||prepared.batch.snapshots[0]?.channel_account_id!==accountId
     ||prepared.batch.snapshots[0]?.external_entity_id!==s.orderSn)return fail('d11_preflight_reconciliation_refused');
    newOrder=prepared.canonical_state==='absent';
   }
   const intake=intakeFactory({
    readBatch:async r=>{
     if(!newOrder||delivered||!within()||r?.channel_account_id!==accountId||r?.order_sn!==s.orderSn||r?.limit!==1)return {ok:false};
     delivered=true;return {ok:true,payload:prepared.batch};
    },
    persistOrder:async contract=>{
     if(!newOrder||!delivered||commitAttempted||!within())return {ok:false};
     const projection=buildShopeeOrderCreateRequest(contract);
     if(projection.channel_account_id!==accountId||projection.order_number!==s.orderSn
      ||projection.items.some(i=>i.commercial_presentation_id||!prepared.batch.mappings.some(m=>
       m.id===i.mapping_id&&m.channel_account_id===accountId&&m.marketplace==='shopee'
       &&String(m.external_item_id??'')===i.item_id&&String(m.external_model_id??'')===i.model_id)))
      return {ok:false};
     commitAttempted=true;
     const p=await adapters.commitIntake(pinned,projection);
     if(p?.status!=='intake_written'||p.channel_account_id!==accountId||p.order_number!==s.orderSn
      ||p.observation_id!==observed.observationId||!id(p.order_id)||!id(p.separation_id))return {ok:false};
     confirmedWrite=p;
     return {ok:true,status:200,payload:{order_id:p.order_id,separation_id:p.separation_id,already_registered:false}};
    },
    readExistingBatch:async r=>{
     if(delivered||!within()||r?.channel_account_id!==accountId||r?.order_sn!==s.orderSn||r?.limit!==1)return {ok:false};
     const b=prepared?{...prepared,status:'reconciliation_batch'}:await adapters.readReconciliation(pinned);
     if(!within()||b?.status!=='reconciliation_batch'||b.channel_account_id!==accountId||b.order_sn!==s.orderSn
      ||b.observation_id!==observed.observationId||b.raw_id!==observed.rawId)return {ok:false};
     delivered=true;return {ok:true,payload:b.batch};
    },
    verifyCanonicalOrder:async r=>{
     if(!delivered||verified||!within()||r?.channel_account_id!==accountId||r?.order_number!==s.orderSn)return {ok:false};
     const p=await adapters.verifyReconciliation(pinned,r);
     if(!within()||p?.ok!==true||p.status!=='verified_existing'||p.channel_account_id!==accountId||p.order_number!==s.orderSn
      ||p.observation_id!==observed.observationId||p.raw_id!==observed.rawId||!id(p.order_id))return {ok:false};
     verified=true;orderId=p.order_id;return p;
    }
   });
   const result=await intake({channelAccountId:accountId,expectedOrderSn:s.orderSn,limit:1,mode:newOrder?'commit':'reconcile'});
   // A late ACK still proves a write. It does NOT authorize further work.
   // Unknown ACK is a reconciliation obligation, never an automatic retry.
   if(commitAttempted){
    if(!confirmedWrite)return {ok:false,code:'d11_intake_commit_unconfirmed',ordersWritten:null,effects:0,
     reconciliationRequired:true,effectAuthorized:false,observationId:observed.observationId,orderSn:s.orderSn};
    if(!within()||result?.ok!==true||result.written!==1||result.results?.length!==1||result.results[0]?.status!=='written'
      ||result.results[0]?.write?.orderId!==confirmedWrite.order_id||result.results[0]?.write?.separationId!==confirmedWrite.separation_id)
     return {ok:false,code:'d11_intake_written_requires_reconciliation',ordersWritten:1,effects:0,
      reconciliationRequired:true,effectAuthorized:false,orderId:confirmedWrite.order_id,orderSn:s.orderSn};
    return {ok:true,code:'d11_intake_written',accountId,orderSn:s.orderSn,orderId:confirmedWrite.order_id,
     separationId:confirmedWrite.separation_id,observationId:observed.observationId,rawId:observed.rawId,
     ordersWritten:1,effects:0,outcome:'pending',effectAuthorized:false};
   }
   if(!within())return fail('d11_preflight_budget_exhausted');
   if(!verified||result?.ok!==true||result.selected!==1||result.written!==0||result.results?.length!==1
    ||result.results[0]?.status!=='verified_existing'||result.results[0]?.orderSn!==s.orderSn||result.results[0]?.orderId!==orderId)
    return fail('d11_preflight_reconciliation_refused');
   return {ok:true,code:'d11_preflight_verified_existing',accountId,orderSn:s.orderSn,orderId,
    observationId:observed.observationId,rawId:observed.rawId,ordersWritten:0,effects:0,
    outcome:'pending',effectAuthorized:false};
  }catch{
   if(commitAttempted)return {ok:false,code:confirmedWrite?'d11_intake_written_requires_reconciliation':'d11_intake_commit_unconfirmed',
    ordersWritten:confirmedWrite?1:null,effects:0,reconciliationRequired:true,effectAuthorized:false};
   return fail('d11_preflight_unavailable');
  }
 };
}
