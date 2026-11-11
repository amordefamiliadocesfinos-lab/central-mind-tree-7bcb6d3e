import { createShopeeLiveOrdersReader } from './shopee-live-orders.mjs';
import { readLiveShopeeOauthConnection, readLiveShopeeOrderIntakeBatch } from './core-bridge.mjs';
import { createShopeeControlledAutoIntake } from './shopee-order-auto-intake.mjs';
import { ADAO_CHANNEL_ACCOUNT_ID } from './shopee-adao-easter-commit-guard.mjs';
import { syncAdaoReadyLabelOnce } from './shopee-adao-ready-label-sync.mjs';
import { arrangeAdaoNewOrderOnce, isAdaoAutomaticShippingCandidate, isAdaoReopenedShippingPilotCandidate, isAdaoNewShippingCandidate, ADAO_AUTO_SHIP_HISTORY_CUTOFF } from './shopee-adao-automatic-shipping.mjs';

// Independent of Viviane's cycle, label workflow and shipping arrangement.
export const ADAO_AUTO_INTAKE_SCOPE = Object.freeze({
  account: ADAO_CHANNEL_ACCOUNT_ID,
  shop: 1156446003,
  partner: 2047685,
  pageSize: 10,
  maxPages: 10,
  lookbackSeconds: 48 * 60 * 60,
});

const ORDER_RE = /^[A-Za-z0-9]{8,100}$/;
const enabled = value => String(value ?? '').trim().toLowerCase() === 'true';

// Adão-only read budget: the Core OAuth read exceeded the shared 5s ceiling.
// Keep the shared Core Bridge timeout (and Viviane) unchanged.
export const ADAO_OAUTH_READ_TIMEOUT_MS = 12_000;
export function createAdaoOauthConnectionReader(readConnection = readLiveShopeeOauthConnection) {
  return data => readConnection(data, { timeoutMs: ADAO_OAUTH_READ_TIMEOUT_MS });
}

// Adão-only batch reads crossed the default 5s Core deadline in the isolated test.
// The shared timeout, Viviane and all non-Adão intake callers remain unchanged.
export const ADAO_INTAKE_BATCH_READ_TIMEOUT_MS = 12_000;
export function createAdaoIntakeBatchReader(readBatch = readLiveShopeeOrderIntakeBatch) {
  return data => {
    if (data?.channel_account_id !== ADAO_AUTO_INTAKE_SCOPE.account) {
      return { ok: false, status: 409, payload: null };
    }
    return readBatch(data, { timeoutMs: ADAO_INTAKE_BATCH_READ_TIMEOUT_MS });
  };
}

export function createAdaoScopedIntake(readBatch = readLiveShopeeOrderIntakeBatch, persistOrder = undefined) {
  return createShopeeControlledAutoIntake({
    readBatch: createAdaoIntakeBatchReader(readBatch),
    ...(persistOrder === undefined ? {} : { persistOrder }),
  });
}

// Only finite, low-cardinality diagnostic values may leave the Hub.
const SAFE_CODE = /^[a-z][a-z0-9_]{0,79}$/;
function safeCode(value) {
  return typeof value === 'string' && SAFE_CODE.test(value) ? value : 'unknown';
}
function safeHttpStatus(value) {
  return Number.isInteger(value) && value >= 400 && value <= 599 ? value : null;
}
function selectionCounts(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const counts = {};
  for (const field of ['selected', 'skipped_existing', 'skipped_status', 'skipped_malformed']) {
    const number = value[field];
    if (Number.isSafeInteger(number) && number >= 0) counts[field] = number;
  }
  return counts;
}
function classifyBlockedEntry(blockers) {
  const codes = Array.isArray(blockers) ? blockers.map(safeCode) : [];
  if (codes.some(code => /mapping|physical|projection|catalog/.test(code))) return 'mapping_or_projection_blocked';
  if (codes.some(code => /pascoa|easter|offer|temporal|historical/.test(code))) return 'offer_policy_blocked';
  return 'pipeline_blocked';
}
function diagnostic(stage, reason, info = {}) {
  return { stage, reason: safeCode(reason), ...info };
}


// A single label action per scheduled cycle keeps the existing 60s Cloud Run
// request bounded. The stable round-robin covers already-imported candidates
// over successive 5-minute runs, without manual per-order commands.
// PDF persistence and one-time upstream document creation remain in the
// existing Core-claimed synchronizer.
export const ADAO_AUTO_LABELS_PER_CYCLE = 1;
export function selectAdaoLabelCandidate(orderSns, nowMs) {
  if (!Array.isArray(orderSns) || !orderSns.length || !Number.isFinite(nowMs)) return null;
  const unique = [...new Set(orderSns)].filter(sn => typeof sn === 'string' && ORDER_RE.test(sn)).sort();
  if (!unique.length) return null;
  return unique[Math.floor(nowMs / 300_000) % unique.length];
}

// Prioritize recently organized Adão orders over unrelated historic backlog.
// Only PROCESSED orders after the administrative cutoff may enter this
// fast path; other existing label candidates retain round-robin fallback.
export function selectAdaoRecentProcessedLabelCandidate(candidates, nowMs) {
  if (!Array.isArray(candidates) || !Number.isFinite(nowMs)) return null;
  const recent = new Map();
  for (const candidate of candidates) {
    if (!candidate || typeof candidate.order_sn !== 'string' ||
        !ORDER_RE.test(candidate.order_sn) || !Number.isSafeInteger(candidate.create_time) ||
        candidate.create_time <= ADAO_AUTO_SHIP_HISTORY_CUTOFF) continue;
    recent.set(candidate.order_sn, candidate.create_time);
  }
  const sorted = [...recent.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8).map(([sn]) => sn);
  return sorted.length ? sorted[Math.floor(nowMs / 300_000) % sorted.length] : null;
}

export function createAdaoAutomaticIntake({
  getEnv = key => process.env[key],
  now = Date.now,
  readOrders = null,
  readConnection = readLiveShopeeOauthConnection,
  intake = createAdaoScopedIntake(),
  syncLabel = syncAdaoReadyLabelOnce,
  arrangeShipping = arrangeAdaoNewOrderOnce,
  logDiagnostic = entry => console.log(JSON.stringify(entry)),
} = {}) {
  return async function runAdaoAutomaticIntake() {
    const report = {
      ok: false, code: 'not_started', account: 'adao',
      discovered: 0, written: 0, already_registered: 0,
      skipped: 0, blocked: 0, pages: 0, stopped: false,
      labels_attached: 0, labels_already: 0, labels_pending: 0, labels_blocked: 0,
      shipment_acknowledged: 0, shipment_pending: 0,
      shipment_candidates: 0,
      // No shipping arrangement, inventory or physical finalization.
      logistics_writes: 0, inventory_writes: 0,
    };
    if (!enabled(getEnv('SHOPEE_ADAO_AUTO_INTAKE_ENABLED'))) {
      return { ...report, code: 'adao_auto_intake_disabled' };
    }
    if (Number(getEnv('SHOPEE_LIVE_PARTNER_ID')) !== ADAO_AUTO_INTAKE_SCOPE.partner) {
      return { ...report, code: 'partner_identity_mismatch' };
    }
    const timeTo = Math.floor(now() / 1000) - 30;
    if (!Number.isSafeInteger(timeTo) || timeTo <= ADAO_AUTO_INTAKE_SCOPE.lookbackSeconds) {
      return { ...report, code: 'invalid_clock' };
    }
    // Overlay ONLY the account. The reader verifies the independent OAuth shop identity.
    const scopedEnv = key => key === 'SHOPEE_LIVE_CHANNEL_ACCOUNT_ID'
      ? ADAO_AUTO_INTAKE_SCOPE.account : getEnv(key);
    const reader = readOrders ?? createShopeeLiveOrdersReader({
      getEnv: scopedEnv,
      now,
      allowRefresh: true,
      expectedShopId: ADAO_AUTO_INTAKE_SCOPE.shop,
      readConnection: createAdaoOauthConnectionReader(readConnection),
    });
    let cursor = null;
    const cursors = new Set();
    const seen = new Set();
    const labelCandidates = new Set();
    const processedLabelCandidates = new Map();
    const newlyWritten = [];
    const shippingCandidates = new Map();
    const acceptedForShipping = new Set();
    for (let page = 0; page < ADAO_AUTO_INTAKE_SCOPE.maxPages; page++) {
      let listed;
      try {
        listed = await reader({
          timeFrom: timeTo - ADAO_AUTO_INTAKE_SCOPE.lookbackSeconds,
          timeTo,
          cursor,
          pageSize: ADAO_AUTO_INTAKE_SCOPE.pageSize,
          timeRangeField: 'update_time',
          onlyIntakeEligibleOrders: true,
          includeReadyToShipCandidates: true,
          responseOptionalFields: ['item_list', 'total_amount', 'payment_method', 'pay_time', 'buyer_message'],
        });
      } catch {
        return { ...report, code: 'shopee_discovery_exception', stopped: true,
          diagnostic: diagnostic('discovery', 'exception') };
      }
      if (!listed?.ok || listed.shop_id !== ADAO_AUTO_INTAKE_SCOPE.shop
        || !Array.isArray(listed.order_sns)
        || listed.order_sns.length > ADAO_AUTO_INTAKE_SCOPE.pageSize
        || listed.order_sns.some(sn => typeof sn !== 'string' || !ORDER_RE.test(sn) || seen.has(sn))) {
        return { ...report, code: safeCode(listed?.code ?? 'discovery_invalid'), stopped: true,
          diagnostic: diagnostic('discovery', 'invalid_or_unavailable') };
      }
      if (listed.ready_to_ship_candidates !== undefined
          && (!Array.isArray(listed.ready_to_ship_candidates)
            || listed.ready_to_ship_candidates.some(v => !listed.order_sns.includes(v?.order_sn)
              || !Number.isSafeInteger(v.create_time)))) {
        return { ...report, code: 'shipping_candidate_invalid', stopped: true };
      }
      if (listed.label_ready_candidates !== undefined &&
          (!Array.isArray(listed.label_ready_candidates) ||
           listed.label_ready_candidates.some(v => !listed.order_sns.includes(v?.order_sn) ||
             !Number.isSafeInteger(v.create_time)))) {
        return { ...report, code: 'label_candidate_invalid', stopped: true };
      }
      for (const candidate of listed.label_ready_candidates ?? []) {
        processedLabelCandidates.set(candidate.order_sn, candidate);
      }
      for (const candidate of listed.ready_to_ship_candidates ?? []) {
        if (isAdaoAutomaticShippingCandidate(candidate)) shippingCandidates.set(candidate.order_sn, candidate);
      }
      report.pages++;
      for (const sn of listed.order_sns) {
        seen.add(sn);
        report.discovered++;
        let committed;
        try {
          committed = await intake({
            channelAccountId: ADAO_AUTO_INTAKE_SCOPE.account,
            expectedOrderSn: sn, limit: 1, mode: 'commit', verifyExisting: true,
          });
        } catch {
          return { ...report, code: 'intake_exception_requires_review', stopped: true,
            diagnostic: diagnostic('intake', 'exception') };
        }
        if (!committed?.ok && committed?.code === 'expected_order_unavailable') {
          // The Core filters already-registered and ineligible orders before
          // the writer. Keep a count but do not claim these were all duplicates.
          report.skipped++;
          // The Core excludes orders already registered, too. Continue to
          // reconcile their missing labels in later cycles.
          labelCandidates.add(sn);
          // Exactly three previously finalized test orders were explicitly
          // reopened in the Adão Core. The reader must have supplied LIVE
          // READY_TO_SHIP evidence on this cycle, and the writer must still
          // pass a new live preflight and permanent Core shipping claim.
          if (shippingCandidates.has(sn) &&
              (isAdaoReopenedShippingPilotCandidate({ order_sn: sn })
                || isAdaoNewShippingCandidate(shippingCandidates.get(sn)))) {
            acceptedForShipping.add(sn);
          }
          continue;
        }
        const entry = committed?.results?.[0];
        if (!committed?.ok) {
          return { ...report, code: 'intake_uncertain_requires_review', stopped: true,
            diagnostic: diagnostic('core_intake', safeCode(committed?.code), {
              http_status: safeHttpStatus(committed?.status),
              selection_counts: selectionCounts(committed?.sourceCounts),
            }) };
        }
        if (committed.roundStopped || committed.selected !== 1 || entry?.orderSn !== sn) {
          return { ...report, code: 'intake_uncertain_requires_review', stopped: true,
            diagnostic: diagnostic('intake_contract', committed.roundStopped
              ? safeCode(committed.stopReason) : 'unexpected_selection', {
              selected: Number.isSafeInteger(committed.selected) ? committed.selected : null,
            }) };
        }
        if (entry.status === 'written') {
          report.written++;
          newlyWritten.push(sn);
          labelCandidates.add(sn);
          acceptedForShipping.add(sn);
        }
        else if (entry.status === 'already_registered') {
          report.already_registered++;
          labelCandidates.add(sn);
          // A previously registered order is NOT generally eligible. Only
          // the exact three operator-reopened pilot orders can be selected.
          if (shippingCandidates.has(sn) &&
              (isAdaoReopenedShippingPilotCandidate({ order_sn: sn })
                || isAdaoNewShippingCandidate(shippingCandidates.get(sn)))) {
            acceptedForShipping.add(sn);
          }
        }
        else if (entry.status === 'blocked') {
          report.blocked++;
          // A policy/mapping rejection is an expected scoped non-write.
          // Keep it visible without revealing customer/order data.
          report.last_blocker = classifyBlockedEntry(entry.blockers);
        } else {
          return { ...report, code: 'writer_uncertain_requires_review', stopped: true,
            diagnostic: diagnostic('writer', entry.status === 'write_failed'
              ? 'write_failed' : 'unexpected_write_status') };
        }
      }
      if (listed.more !== true) {
        // Arrange at most one new/unfinalized Core order. The source is a
        // current READY_TO_SHIP detail, not an old order in Separação. The
        // trusted one-shot writer repeats LIVE eligibility and Core claim.
        // Historical orders predating the administrative test cleanup are out.
        if (enabled(getEnv('SHOPEE_ADAO_AUTO_SHIP_ENABLED'))) {
          // Continue helping when a new order was imported before the
          // Shopee transition to READY_TO_SHIP. Rotation avoids starving
          // later orders when the first candidate has unmet prerequisites.
          // The Core claim checks the order remains operationally open.
          const eligible = [...shippingCandidates.keys()].sort()
            .filter(sn => acceptedForShipping.has(sn));
          report.shipment_candidates = eligible.length;
          const target = eligible.length
            ? eligible[Math.floor(now() / 300_000) % eligible.length] : null;
          if (target) {
            try {
              const arranged = await arrangeShipping(target);
              if (arranged?.ok && arranged.code === 'ship_order_api_acknowledged_not_collected') {
                report.shipment_acknowledged++;
              } else {
                report.shipment_pending++;
                report.shipment_code = safeCode(arranged?.code);
              }
            } catch {
              report.shipment_pending++;
              report.shipment_code = 'automatic_shipping_exception';
            }
          }
        }
        // Process one official label per scheduled cycle. Priority is a newly
        // imported order; otherwise rotate among already-known live candidates.
        // Sync failures are recorded, not mistaken for order intake failures.
        if (enabled(getEnv('SHOPEE_ADAO_LABEL_SYNC_ENABLED'))) {
          const target = selectAdaoRecentProcessedLabelCandidate(
            [...processedLabelCandidates.values()].filter(v => labelCandidates.has(v.order_sn)), now())
            ?? newlyWritten[0] ?? selectAdaoLabelCandidate([...labelCandidates], now());
          if (target) {
            try {
              const label = await syncLabel(target);
              // No PII/order IDs, auth material or upstream messages in logs.
              try { logDiagnostic({ event: 'adao_auto_label_cycle',
                result_code: safeCode(label?.code), outcome: label?.ok === true ? 'ok' : 'pending_or_blocked',
                processed_candidates: processedLabelCandidates.size }); } catch { /* diagnostics optional */ }
              if (label?.ok === true && label.code === 'label_attached') report.labels_attached++;
              else if (label?.ok === true && label.code === 'already_available') report.labels_already++;
              else if (['document_processing', 'document_task_created_check_later',
                'document_creation_already_claimed', 'document_not_ready'].includes(label?.code)) report.labels_pending++;
              else {
                report.labels_blocked++;
                report.label_code = safeCode(label?.code);
              }
            } catch {
              report.labels_blocked++;
              report.label_code = 'label_sync_exception';
              try { logDiagnostic({ event: 'adao_auto_label_cycle',
                result_code: 'label_sync_exception', outcome: 'blocked',
                processed_candidates: processedLabelCandidates.size }); } catch { /* noop */ }
            }
          }
        }
        return { ...report, ok: true, code: 'cycle_completed' };
      }
      const next = listed.next_cursor;
      if (typeof next !== 'string' || !next || cursors.has(next) || next === cursor) {
        return { ...report, code: 'pagination_invalid', stopped: true };
      }
      cursors.add(next);
      cursor = next;
    }
    // Never silently report a truncated page scan as success.
    return { ...report, code: 'pagination_budget_exhausted', stopped: true };
  };
}

export const runAdaoAutomaticIntake = createAdaoAutomaticIntake();
