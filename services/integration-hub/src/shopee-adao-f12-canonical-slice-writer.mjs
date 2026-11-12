import { F12_3_SCOPE } from './shopee-adao-resumable-discovery.mjs';
import { createAdaoScopedIntake } from './shopee-adao-automatic-intake.mjs';
import { resumeAdaoF12Staged, acknowledgeAdaoF12Discovery } from './core-bridge.mjs';

// F12.3 — canonical writer adapter prepared, but NOT connected to any
// production routes, Scheduler or automatic Cloud Run startup.
// An external caller must opt in explicitly for ONE staged slice. No
// shipping, labels, inventory, OP, cron, retries, or multiconta.
// SQL ACK remains authoritative: a success reported by the writer alone is
// never treated as sufficient evidence that Core has reconciled every ID.
const ORDER_RE=/^[A-Za-z0-9]{8,100}$/;
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SLICE_ORDERS=20;
const MAX_WORK_MS=120_000;

function validStage(stage) {
  if (!stage || typeof stage!=='object' || stage.status!=='resumed'
    || typeof stage.lease_id!=='string' || !UUID_RE.test(stage.lease_id)
    || !Number.isSafeInteger(stage.generation) || stage.generation<1
    || typeof stage.completed!=='boolean'
    || !Array.isArray(stage.staged_pages)
    || stage.staged_pages.length<1 || stage.staged_pages.length>2
    || stage.staged_pages.some(page=>!Array.isArray(page)
      || page.length>10
      || page.some(sn=>typeof sn!=='string'||!ORDER_RE.test(sn)))) return false;
  const ids=stage.staged_pages.flat();
  return ids.length<=MAX_SLICE_ORDERS && new Set(ids).size===ids.length;
}

export function createAdaoF12CanonicalSliceWriter({
  resume=resumeAdaoF12Staged,
  acknowledge=acknowledgeAdaoF12Discovery,
  intake=createAdaoScopedIntake(),
  now=Date.now,
  enabled=false,
}={}) {
  if (typeof resume!=='function'||typeof acknowledge!=='function'
    ||typeof intake!=='function'||typeof now!=='function')
    throw new TypeError('invalid_f12_canonical_writer_dependencies');
  // This is a factory-level AND invocation-level gate; callers cannot
  // accidentally turn on real canonical writes through a default instance.
  return async function writeOneStagedSlice({commit=false}={}) {
    if (enabled!==true || commit!==true)
      return {ok:false,code:'f12_canonical_writer_disabled'};
    const began=now();
    if (!Number.isFinite(began))
      return {ok:false,code:'f12_invalid_clock'};

    let recovered;
    try { recovered=await resume({channel_account_id:F12_3_SCOPE.account}); }
    catch { return {ok:false,code:'f12_resume_unavailable'}; }
    if (!recovered?.ok || !validStage(recovered?.payload))
      return {ok:false,code:recovered?.status===409?'f12_staged_busy':'f12_invalid_staged_lease'};

    const d=recovered.payload;
    const ids=d.staged_pages.flat();
    let written=0,alreadyRegistered=0,filteredPendingCore=0;
    for(const sn of ids){
      // No automatic retry: uncertain writer response quarantines this stage
      // until a later explicit reconciliation path is reviewed.
      const sampledNow=now();
      if (!Number.isFinite(sampledNow) || sampledNow-began>=MAX_WORK_MS)
        return {ok:false,code:'f12_writer_budget_exhausted',processed:written+alreadyRegistered+filteredPendingCore};
      let result;
      try {
        result=await intake({
          channelAccountId:F12_3_SCOPE.account,
          expectedOrderSn:sn,limit:1,mode:'commit',verifyExisting:true,
        });
      } catch { return {ok:false,code:'f12_writer_uncertain',processed:written+alreadyRegistered}; }
      // Canonical Core batch-read can exclude an already registered order.
      // This status does NOT prove an existing order; it is a pending evidence
      // marker only. The Core ACK must independently verify this exact SN
      // against Adão's canonical orders before any checkpoint can advance.
      if (result?.ok===false && result.code==='expected_order_unavailable') {
        filteredPendingCore++;
        continue;
      }
      const entry=result?.results?.[0];
      if (result?.ok!==true || result.roundStopped===true
        || result.selected!==1 || result.results?.length!==1
        || entry?.orderSn!==sn
        || !['written','already_registered'].includes(entry.status))
        return {ok:false,code:'f12_writer_requires_review',
          processed:written+alreadyRegistered+filteredPendingCore};
      if(entry.status==='written')written++;
      else alreadyRegistered++;
    }

    // No unchecked ACK even for an empty staged page. RPC verifies lease,
    // generation, canonical account, origin, uniqueness and tombstones.
    // A timeout can mean ACK committed: never retry an ambiguous response.
    let ack;
    try{
      ack=await acknowledge({
        channel_account_id:F12_3_SCOPE.account,
        lease_id:d.lease_id,generation:d.generation,
      });
    }catch{return {ok:false,code:'f12_ack_uncertain',processed:ids.length};}
    if(ack?.ok!==true || ack.payload?.status!=='acknowledged'
      || ack.payload?.reconciled!==ids.length)
      return {ok:false,code:'f12_core_reconciliation_blocked',processed:ids.length};
    return {ok:true,code:'f12_slice_canonically_reconciled',
      processed:ids.length,written,already_registered:alreadyRegistered,
      verified_filtered_by_core:filteredPendingCore,completed:d.completed};
  };
}
