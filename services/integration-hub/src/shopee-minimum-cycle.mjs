import { callCoreBridgeAction } from './core-bridge.mjs';
import { createShopeeLiveOrdersReader } from './shopee-live-orders.mjs';
import { runShopeeControlledAutoIntake } from './shopee-order-auto-intake.mjs';
import { createShopeeLabelPreparation } from './shopee-label-preparation.mjs';
import { SHOPEE_CYCLE_ACCOUNT, validCycleScope } from './shopee-cycle-scope.mjs';

export function createShopeeMinimumCycle({
  getEnv = k => process.env[k], now = Date.now, callCore = callCoreBridgeAction,
  readOrders, intake = runShopeeControlledAutoIntake, prepareLabel = createShopeeLabelPreparation,
} = {}) {
  return async function runCycle() {
    const enabled = k => String(getEnv(k) ?? '').trim().toLowerCase() === 'true';
    for (const gate of ['SHOPEE_LIVE_CYCLE_ENABLED', 'SHOPEE_LIVE_AUTO_COMMIT_ENABLED',
      'SHOPEE_LIVE_LABEL_CREATE_ENABLED', 'SHOPEE_LIVE_LABEL_SYNC_ENABLED']) {
      if (!enabled(gate)) return { ok: false, code: 'cycle_not_enabled' };
    }
    const a = SHOPEE_CYCLE_ACCOUNT;
    if (getEnv('SHOPEE_LIVE_CHANNEL_ACCOUNT_ID') !== a.account
      || Number(getEnv('SHOPEE_LIVE_PARTNER_ID')) !== a.partner) return { ok: false, code: 'cycle_account_refused' };
    // Dispatch remains exclusively in Seller Center, even if misconfigured.
    if (['SHOPEE_LIVE_SHIP_ORDER_ENABLED', 'SHOPEE_LIVE_SHIP_ORDER_ROUTE_ENABLED'].some(enabled)) {
      return { ok: false, code: 'cycle_dispatch_gate_conflict' };
    }
    const acquired = await callCore({ action: 'shopee.cycle.acquire', data: { channel_account_id: a.account } });
    const lease = acquired?.payload;
    if (!acquired?.ok || lease?.status !== 'acquired') return { ok: false, code: 'cycle_busy_or_unavailable' };
    let page = null, outcome = 'pending', code = 'cycle_unavailable', stage = 'discovery';
    const candidate = lease.candidate;
    try {
      if (!(Date.parse(lease.expires_at) > now() + 90000)) throw new Error('lease_budget');
      const reader = readOrders ?? createShopeeLiveOrdersReader({ getEnv, now,
        // Rotation is serialized by the account lease, separately gated, and
        // an uncertain discovery/rotation halts the account in the Core.
        allowRefresh: enabled('SHOPEE_LIVE_OAUTH_REFRESH_ENABLED'), expectedShopId: a.shop,
        fetchImpl: (url, options) => fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(5000) }),
      });
      const discovered = await reader({ timeFrom: lease.time_from, timeTo: lease.time_to,
        cursor: lease.cursor, pageSize: 5, timeRangeField: 'update_time',
        responseOptionalFields: ['item_list', 'package_list', 'invoice_data', 'shipping_carrier',
          'payment_method', 'total_amount', 'pay_time', 'recipient_address', 'buyer_message'] });
      if (!discovered?.ok || discovered.shop_id !== a.shop
        || !Array.isArray(discovered.order_sns) || discovered.order_sns.length > 5
        || discovered.order_sns.some(sn => typeof sn !== 'string' || !/^[A-Za-z0-9]{8,100}$/.test(sn))
        || (discovered.more && (!discovered.next_cursor || discovered.next_cursor === lease.cursor))) {
        code = discovered?.code ?? 'cycle_discovery_invalid';
        return { ok: false, code };
      }
      stage = 'candidate';
      page = { order_sns: discovered.order_sns, next_cursor: discovered.more ? discovered.next_cursor : null };
      if (!candidate) { code = 'cycle_discovered'; return { ok: true, code: 'cycle_discovered', discovered: page.order_sns.length }; }
      if (candidate.blocked_reason) {
        outcome = 'blocked'; code = 'cycle_candidate_integrity_blocked';
        return { ok: false, code, order_sn: candidate.order_sn };
      }
      if (candidate.terminal || candidate.document_available) {
        outcome = 'complete'; code = candidate.document_available ? 'already_available' : 'external_order_terminal';
        return { ok: true, code, order_sn: candidate.order_sn };
      }
      const projected = await intake({ channelAccountId: a.account, expectedOrderSn: candidate.order_sn, limit: 1, mode: 'commit', verifyExisting: true });
      const entry = projected?.results?.[0];
      if (!projected?.ok || projected.roundStopped || projected.selected !== 1
        || entry?.orderSn !== candidate.order_sn || !['written', 'already_registered'].includes(entry?.status)) {
        outcome = entry?.status === 'write_failed' ? 'blocked' : 'pending';
        code = 'cycle_intake_blocked';
        return { ok: outcome === 'pending', code, order_sn: candidate.order_sn, blockers: entry?.blockers ?? [projected?.code ?? code] };
      }
      if (!(Date.parse(lease.expires_at) > now() + 90000)) { code = 'cycle_budget_exhausted'; return { ok: false, code }; }
      if (!validCycleScope({ ...a, order: candidate.order_sn, package: candidate.package_number })) {
        code = 'cycle_waiting_single_package';
        return { ok: true, code, order_sn: candidate.order_sn };
      }
      const scope = { ...a, order: candidate.order_sn, package: candidate.package_number };
      const overlay = { SHOPEE_LIVE_LABEL_ORDER_SN: scope.order, SHOPEE_LIVE_LABEL_PACKAGE_NUMBER: scope.package,
        SHOPEE_LIVE_LABEL_SHOP_ID: String(a.shop), SHOPEE_LIVE_LABEL_CREATE_WINDOW_EXPIRES_AT: new Date(lease.expires_at).toISOString() };
      const scopedEnv = k => Object.hasOwn(overlay, k) ? overlay[k] : getEnv(k);
      const result = await prepareLabel({ getEnv: scopedEnv, now, recurringScope: scope })();
      code = result?.code ?? 'label_preparation_unavailable';
      outcome = result?.ok ? 'complete' : ['document_creation_uncertain', 'document_core_confirmation_missing',
        'document_claim_locked', 'document_claim_unavailable', 'document_failed', 'document_status_unknown',
        'ready_label_sync_failed', 'label_preparation_unavailable'].includes(code) ? 'blocked' : 'pending';
      return { ok: result?.ok === true || outcome === 'pending', code, order_sn: scope.order,
        document_id: result?.ok ? result.document_id : null };
    } catch {
      // If execution reached an uncertain boundary, do not schedule a blind retry.
      if (candidate && stage === 'candidate') outcome = 'blocked';
      code = stage === 'candidate' ? 'cycle_exception_requires_review'
        : enabled('SHOPEE_LIVE_OAUTH_REFRESH_ENABLED') ? 'cycle_refresh_or_discovery_uncertain' : 'cycle_discovery_unavailable';
      return { ok: false, code };
    } finally {
      const completed = await callCore({ action: 'shopee.cycle.finish', data: {
        channel_account_id: a.account, lease_id: lease.lease_id, page,
        candidate_order_sn: candidate?.order_sn ?? null, outcome, code,
      } });
      // A missing checkpoint is an observable error, never a successful round.
      if (!completed?.ok) throw new Error('cycle_checkpoint_unavailable');
    }
  };
}

export const runShopeeMinimumCycle = createShopeeMinimumCycle();
