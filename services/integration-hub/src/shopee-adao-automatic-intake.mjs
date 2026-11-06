import { createShopeeLiveOrdersReader } from './shopee-live-orders.mjs';
import { runShopeeControlledAutoIntake } from './shopee-order-auto-intake.mjs';
import { ADAO_CHANNEL_ACCOUNT_ID } from './shopee-adao-easter-commit-guard.mjs';

// Independent of Viviane's cycle, label workflow and shipping arrangement.
export const ADAO_AUTO_INTAKE_SCOPE = Object.freeze({
  account: ADAO_CHANNEL_ACCOUNT_ID,
  shop: 1156446003,
  partner: 2047685,
  pageSize: 10,
  maxPages: 4,
  lookbackSeconds: 48 * 60 * 60,
});

const PAIRS_RE = /^\d+:\d+(,\d+:\d+)*$/;
const ORDER_RE = /^[A-Za-z0-9]{8,100}$/;
const enabled = value => String(value ?? '').trim().toLowerCase() === 'true';

export function createAdaoAutomaticIntake({
  getEnv = key => process.env[key],
  now = Date.now,
  readOrders = null,
  intake = runShopeeControlledAutoIntake,
} = {}) {
  return async function runAdaoAutomaticIntake() {
    const report = {
      ok: false, code: 'not_started', account: 'adao',
      discovered: 0, written: 0, already_registered: 0,
      skipped: 0, blocked: 0, pages: 0, stopped: false,
      // No labels, shipment arrangement, inventory or physical finalization.
      logistics_writes: 0, inventory_writes: 0,
    };
    if (!enabled(getEnv('SHOPEE_ADAO_AUTO_INTAKE_ENABLED'))) {
      return { ...report, code: 'adao_auto_intake_disabled' };
    }
    if (!PAIRS_RE.test(String(getEnv('SHOPEE_ADAO_NON_EASTER_MODEL_PAIRS') ?? ''))) {
      return { ...report, code: 'adao_approved_pairs_missing' };
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
    });
    let cursor = null;
    const cursors = new Set();
    const seen = new Set();
    for (let page = 0; page < ADAO_AUTO_INTAKE_SCOPE.maxPages; page++) {
      let listed;
      try {
        listed = await reader({
          timeFrom: timeTo - ADAO_AUTO_INTAKE_SCOPE.lookbackSeconds,
          timeTo,
          cursor,
          pageSize: ADAO_AUTO_INTAKE_SCOPE.pageSize,
          timeRangeField: 'update_time',
          responseOptionalFields: ['item_list', 'total_amount', 'payment_method', 'pay_time'],
        });
      } catch {
        return { ...report, code: 'shopee_discovery_exception', stopped: true };
      }
      if (!listed?.ok || listed.shop_id !== ADAO_AUTO_INTAKE_SCOPE.shop
        || !Array.isArray(listed.order_sns)
        || listed.order_sns.length > ADAO_AUTO_INTAKE_SCOPE.pageSize
        || listed.order_sns.some(sn => typeof sn !== 'string' || !ORDER_RE.test(sn) || seen.has(sn))) {
        return { ...report, code: listed?.code ?? 'discovery_invalid', stopped: true };
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
          return { ...report, code: 'intake_exception_requires_review', stopped: true };
        }
        if (!committed?.ok && committed?.code === 'expected_order_unavailable') {
          // The Core reader filters existing / non-eligible orders.
          report.skipped++;
          continue;
        }
        const entry = committed?.results?.[0];
        if (!committed?.ok || committed.roundStopped || committed.selected !== 1
          || entry?.orderSn !== sn) {
          return { ...report, code: 'intake_uncertain_requires_review', stopped: true };
        }
        if (entry.status === 'written') report.written++;
        else if (entry.status === 'already_registered') report.already_registered++;
        else if (entry.status === 'blocked') report.blocked++;
        else return { ...report, code: 'writer_uncertain_requires_review', stopped: true };
      }
      if (listed.more !== true) return { ...report, ok: true, code: 'cycle_completed' };
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
