// Internal client adapter; never invoked by a live route in this candidate.
import {callCoreBridgeAction} from './core-bridge.mjs';
import {createD11OfficialObservation} from './shopee-d11-official-observation.mjs';
const scopeData=s=>({channel_account_id:s.accountId,lease_id:s.leaseId,revision:s.revision});
export function createD11BridgeAdapters({call=callCoreBridgeAction,enabled=false}={}){
 async function invoke(action,data){
  if(enabled!==true)return null;
  const r=await call({action,data,timeoutMs:5000});
  return r?.ok===true?r.payload:null;
 }
 return {
  readDiscoveryScope:p=>invoke('shopee.d11.discovery.scope',scopeData(p)),
  finishDiscovery:(p,listHash,detailHashes)=>invoke('shopee.d11.discovery.finish',{...scopeData(p),list_hash:listHash,detail_hashes:detailHashes}),
  acquirePreflight:accountId=>invoke('shopee.d11.preflight.acquire',{channel_account_id:accountId}),
  finishPreflight:(p,code)=>invoke('shopee.d11.preflight.finish',{...scopeData(p),candidate_order_sn:p.orderSn,code}),
  readScope:s=>invoke('shopee.d11.scope.read',scopeData(s)),
  recordObservation:p=>invoke('shopee.d11.observation.record',{
   channel_account_id:p.p_account,lease_id:p.p_lease,revision:p.p_revision,
   shop_id:p.p_shop,order_sn:p.p_order,payload_hash:p.p_hash,payload:p.p_payload,
   official_request_id:p.p_request,request_started_at:p.p_started,response_received_at:p.p_received}),
  readIntake:p=>invoke('shopee.d11.intake.read',{...scopeData(p),observation_id:p.observationId}),
  commitIntake:(p,projection)=>invoke('shopee.d11.intake.commit',{...scopeData(p),observation_id:p.observationId,projection}),
  readReconciliation:p=>invoke('shopee.d11.reconcile.read',{...scopeData(p),observation_id:p.observationId}),
  verifyReconciliation:(p,projection)=>invoke('shopee.d11.reconcile.verify',{
   ...scopeData(p),observation_id:p.observationId,projection}),
  readEffectScope:p=>invoke('shopee.d11.effect.scope',{...scopeData(p),observation_id:p.observationId,effect:p.effect}),
  resolveEffect:p=>invoke('shopee.d11.effect.resolve',{...scopeData(p),observation_id:p.observationId,effect:p.effect,
   attempt_id:p.attemptId,request_hash:p.requestHash,outcome:p.outcome}),
  claimEffect:p=>invoke('shopee.d11.effect.claim',{
   ...scopeData(p),shop_id:p.shopId,order_sn:p.orderSn,package_number:p.packageNumber,
   request_hash:p.requestHash,observation_id:p.observationId,effect:p.effect})
 };
}
// The explicit flag controls the candidate client as well as the server gate.
// Caller still needs a Core-selected scope, not arbitrary request identity.
export function createD11BridgeObservation({enabled=false,call,...options}={}){
 const adapters=createD11BridgeAdapters({enabled,call});
 return createD11OfficialObservation({...options,...adapters});
}
