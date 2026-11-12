import { F12_3_SCOPE, createAdaoResumableDiscovery } from './shopee-adao-resumable-discovery.mjs';
import { acquireAdaoF12Discovery, stageAdaoF12Discovery } from './core-bridge.mjs';

// F12.3: isolated read-only runner. No production route invokes this module.
// Persist page IDs durably BEFORE any future writer can consume them; it never
// automatically acknowledges a staged batch, since an unacknowledged stage
// requires explicit post-writer reconciliation and a valid lease.
export function createAdaoDurableDiscoveryStage({
  acquire = acquireAdaoF12Discovery,
  stage = stageAdaoF12Discovery,
  readSlice,
} = {}) {
  if (typeof acquire !== 'function' || typeof stage !== 'function'
    || typeof readSlice !== 'function') throw new TypeError('invalid_f12_dependencies');
  return async function runReadOnlyStage() {
    let lease;
    try {
      lease = await acquire({ channel_account_id:F12_3_SCOPE.account });
    } catch { return { ok:false,code:'checkpoint_acquire_unavailable' }; }
    if (!lease?.ok || lease.payload?.status !== 'acquired'
      || typeof lease.payload.lease_id !== 'string'
      || !Number.isSafeInteger(lease.payload.generation)
      || lease.payload.generation < 1) {
      return { ok:false,code:'checkpoint_busy_or_unavailable' };
    }
    const { lease_id, generation, checkpoint } = lease.payload;
    let slice;
    try { slice = await readSlice(checkpoint ?? null); }
    catch { return { ok:false,code:'discovery_exception' }; }
    if (!slice?.ok || !Array.isArray(slice.page_orders)
      || slice.page_orders.length<1 || slice.page_orders.length>F12_3_SCOPE.maxPagesPerSlice) {
      return { ok:false,code:'discovery_blocked' };
    }
    let result;
    try {
      result = await stage({
        channel_account_id:F12_3_SCOPE.account,
        lease_id, generation,
        checkpoint:slice.checkpoint,
        pages:slice.page_orders,
        completed:slice.completed===true,
      });
    } catch { return { ok:false,code:'checkpoint_stage_uncertain' }; }
    if (!result?.ok || result.payload?.status !== 'staged') {
      return { ok:false,code:'checkpoint_stage_uncertain' };
    }
    // Only low-cardinality counters leave the module; never reveal a cursor,
    // lease token, order IDs, OAuth credentials or buyer information.
    return { ok:true, code:'read_only_pages_staged',
      pages:slice.pages_in_slice,
      orders:slice.page_orders.reduce((count, page)=>count+page.length,0),
      completed:slice.completed===true };
  };
}

// Explicit factory to make the existing read-only discovery usable with an
// injected reader; never provide a default writer or a production activation.
export function makeAdaoReadOnlyStager({
  readOrders, now=Date.now, acquire, stage,
}={}) {
  const readSlice=createAdaoResumableDiscovery({readOrders,now});
  return createAdaoDurableDiscoveryStage({readSlice,acquire,stage});
}
