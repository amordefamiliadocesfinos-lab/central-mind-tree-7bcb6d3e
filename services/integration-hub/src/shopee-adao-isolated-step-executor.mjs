import { makeAdaoReadOnlyStager } from './shopee-adao-durable-stage.mjs';
import { createAdaoF12StageReconciler } from './shopee-adao-stage-reconcile.mjs';

// F12.3 — opt-in, single-step executor with injected dependencies.
// IMPORTANT: no Cloud Run route, Scheduler, startup hook or production writer
// imports this module. The caller must explicitly select one operation.
// Discover only reads Shopee and stages up to 2 pages in Core.
// Reconcile asks the Core for a fenced, expired staged lease and lets its
// canonical-order SQL gate make the sole ACK decision.
// Never run discovery and reconciliation in one implicit loop: this would
// defeat the staged quarantine for missing, uncertain or uncommitted orders.
const OPERATIONS = new Set(['discover_one_slice', 'reconcile_staged']);
const sanitize = result => {
  const safe = { ok: result?.ok === true };
  const code = result?.code;
  if (typeof code !== 'string' || !/^[a-z_]{1,64}$/.test(code)) {
    return { ok:false,code:'step_unavailable' };
  }
  safe.code = code;
  if (safe.ok) {
    for (const field of ['pages','orders']) {
      if (Number.isSafeInteger(result?.[field])
        && result[field] >= 0 && result[field] <= 100) safe[field]=result[field];
    }
    if (typeof result?.completed === 'boolean') safe.completed=result.completed;
  }
  return safe;
};

export function createAdaoF12IsolatedStepExecutor({
  readOrders, now=Date.now, acquire, stage, resume, acknowledge,
}={}) {
  if (typeof readOrders !== 'function') throw new TypeError('readOrders_required');
  const discover = makeAdaoReadOnlyStager({readOrders,now,acquire,stage});
  const reconcile = createAdaoF12StageReconciler({resume,acknowledge});
  return async function executeOneStep(operation) {
    if (!OPERATIONS.has(operation)) return {ok:false,code:'invalid_operation'};
    // These steps never infer the user's intent or retry a previous uncertainty.
    try {
      return sanitize(await (operation==='discover_one_slice'?discover():reconcile()));
    } catch {
      return {ok:false,code:'step_unavailable'};
    }
  };
}
