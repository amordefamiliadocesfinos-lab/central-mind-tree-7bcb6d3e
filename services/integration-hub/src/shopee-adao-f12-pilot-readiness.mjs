import { F12_3_SCOPE } from './shopee-adao-resumable-discovery.mjs';

// F12.3 — isolated pilot PREPARATION ONLY.
// No imports of Core Bridge, canonical writer, Shopee reader, Cloud Run app,
// shipping or Scheduler. No production operation can be performed here.
// This pure readiness check accepts a read-only evidence summary only; it
// cannot certify runtime concurrency, actual Core writes or 100 orders/day.
const MAX_AGE_MS=5*60*1000;
const MAX_CONCURRENT=1;
const REQUIRED_EVIDENCE=[
  'hmac_live_verified','core_rpc_rollback_verified',
  'canonical_pipeline_offline_verified','core_ack_gate_verified',
];

export function assessAdaoF12PilotReadiness(evidence,{now=Date.now}={}) {
  if (!evidence || typeof evidence!=='object' || Array.isArray(evidence))
    return {ok:false,code:'pilot_evidence_missing'};
  if (evidence.account!==F12_3_SCOPE.account || evidence.shop!==F12_3_SCOPE.shop)
    return {ok:false,code:'pilot_account_refused'};
  if (typeof now!=='function') return {ok:false,code:'pilot_clock_unavailable'};
  const clock=now();
  if (!Number.isSafeInteger(clock) || !Number.isSafeInteger(evidence.observedAt)
    || evidence.observedAt>clock || clock-evidence.observedAt>MAX_AGE_MS)
    return {ok:false,code:'pilot_evidence_stale'};
  // One isolated worker, one candidate order, one page per supervised step.
  // This is a proposed pilot cap, not a modification to the frozen 2-page/
  // 20-order production checkpoint format or the existing 3+3 Scheduler.
  if (evidence.pilotWorkers!==MAX_CONCURRENT
    || evidence.pilotOrders!==1
    || evidence.pilotPages!==1)
    return {ok:false,code:'pilot_scope_outside_limit'};
  if (evidence.checkpointRows!==0)
    return {ok:false,code:'pilot_existing_checkpoint_requires_review'};
  for (const key of REQUIRED_EVIDENCE) {
    if (evidence[key]!==true)
      return {ok:false,code:'pilot_required_evidence_missing'};
  }
  // Evidence about actual two-session concurrency and 100/day is
  // deliberately excluded. They remain independent production gates.
  return {ok:true,code:'pilot_offline_readiness_only',
    account:'adao',pilotWorkers:1,pilotOrders:1,pilotPages:1,
    productionAuthorized:false,concurrencyVerified:false,
    throughput100Verified:false};
}

// No "run" or "commit" method by design. Only evaluate read-only evidence.
// A later, separately reviewed operational pilot must be introduced after
// real concurrency fencing and execution authorization.
export const ADAO_F12_PILOT_PREPARATION=Object.freeze({
  mode:'offline_readiness_only',maxWorkers:1,maxOrders:1,maxPages:1,
  productionActivation:false,schedulerChanges:false,
  permittedCoreWrites:0,permittedOrdersWrites:0,
  permittedLogisticsWrites:0,
});
