import { F12_3_SCOPE } from './shopee-adao-resumable-discovery.mjs';
import { resumeAdaoF12Staged, acknowledgeAdaoF12Discovery } from './core-bridge.mjs';

// F12.3 explicit, standalone reconciliation. NOT wired to any production route.
// It never imports/sends a Shopee order, arranges shipping, generates labels,
// marks an OP or changes stock. Core SQL alone evaluates canonical reconciliation.
// Missing/ambiguous writes remain staged and cannot be ACKed by this module.
export function createAdaoF12StageReconciler({
  resume = resumeAdaoF12Staged,
  acknowledge = acknowledgeAdaoF12Discovery,
} = {}) {
  if (typeof resume !== 'function' || typeof acknowledge !== 'function')
    throw new TypeError('invalid_reconciliation_dependencies');
  return async function reconcileStaged() {
    let staged;
    try { staged = await resume({ channel_account_id:F12_3_SCOPE.account }); }
    catch { return {ok:false,code:'resume_unavailable'}; }
    const d=staged?.payload;
    if (!staged?.ok || d?.status !== 'resumed') {
      return {ok:false,code:staged?.status===409?'stage_blocked':'resume_unavailable'};
    }
    if (typeof d.lease_id!=='string'
        || !Number.isSafeInteger(d.generation) || d.generation<1
        || !Array.isArray(d.staged_pages)
        || d.staged_pages.length<1 || d.staged_pages.length>2
        || d.staged_pages.some(p=>!Array.isArray(p)||p.length>10
          || p.some(sn=>typeof sn!=='string'||!/^[A-Za-z0-9]{8,100}$/.test(sn)))) {
      return {ok:false,code:'invalid_staged_evidence'};
    }
    // The only decision authority for ACK is the Core RPC, which locks state,
    // validates the generation and confirms all IDs in canonical Adão orders.
    // No client-side "reconciled=true" flag can override that.
    let result;
    try {
      result=await acknowledge({
        channel_account_id:F12_3_SCOPE.account,
        lease_id:d.lease_id, generation:d.generation,
      });
    } catch { return {ok:false,code:'ack_uncertain'}; }
    if (!result?.ok || result.payload?.status!=='acknowledged') {
      return {ok:false,code:result?.status===409?'reconciliation_blocked':'ack_uncertain'};
    }
    return {ok:true,code:'stage_reconciled',completed:d.completed===true,
      pages:d.staged_pages.length,
      orders:d.staged_pages.reduce((n,page)=>n+page.length,0)};
  };
}
