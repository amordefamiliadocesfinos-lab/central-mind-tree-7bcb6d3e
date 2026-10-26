import { previewPortoGelVivianeMappings } from './shopee-porto-gel-mapping-diagnostic.mjs';
import { runShopeeMinimumCycle } from './shopee-minimum-cycle.mjs';
import { readAdaoLogisticsReadOnly } from './shopee-adao-logistics-readonly.mjs';
import { HUB_SERVICE_NAME, HUB_VERSION } from './contracts.mjs';
import { probeCoreBridge, callCoreBridgeAction } from './core-bridge.mjs';
import { handleShopeeLiveOauthRequest } from './shopee-live-oauth.mjs';
import { runShopeeControlledAutoIntake } from './shopee-order-auto-intake.mjs';
import { inspectShopeeLiveLogistics } from './shopee-live-logistics.mjs';
import { refreshShopeeOauthOnce } from './shopee-oauth-refresh-once.mjs';
import { syncReadyShopeeLabel } from './shopee-live-label.mjs';
import { inspectShopeeShippingPreflight } from './shopee-shipping-preflight.mjs';
import { guardedShopeeShipOrder } from './shopee-ship-order-guard.mjs';
import { prepareShopeeLabelOnce } from './shopee-label-preparation.mjs';
import {
  SHOPEE_OPERATIONAL_COMMIT_POLICY,
  summarizeShopeeControlledRound,
} from './shopee-intake-policy.mjs';
import { randomUUID } from 'node:crypto';

const JSON_HEADERS = Object.freeze({
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
});

function json(status, body) {
  return {
    status,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  };
}

export async function handleRequest(
  request,
  {
    runMinimumCycle = runShopeeMinimumCycle,
    readAdaoLogistics = readAdaoLogisticsReadOnly,
    syncCore = callCoreBridgeAction,
    probeCore = probeCoreBridge,
    handleShopeeLive = handleShopeeLiveOauthRequest,
    runShopeePreview = runShopeeControlledAutoIntake,
    runShopeeCommit = runShopeeControlledAutoIntake,
    inspectShopeeLogistics = inspectShopeeLiveLogistics,
    refreshShopeeOauth = refreshShopeeOauthOnce,
    syncShopeeLabel = syncReadyShopeeLabel,
    inspectShippingPreflight = inspectShopeeShippingPreflight,
    shipShopeeOrderOnce = guardedShopeeShipOrder,
    prepareShopeeLabel = prepareShopeeLabelOnce,
    getEnv = (name) => process.env[name],
    makeRunId = randomUUID,
    now = () => new Date().toISOString(),
    logEvent = (event) => console.log(JSON.stringify(event)),
  } = {},
) {
  const shopeeLiveResponse = await handleShopeeLive(request);
  if (shopeeLiveResponse) return shopeeLiveResponse;

  const normalizedPath = String(request.path ?? '/');
  const normalizedMethod = String(request.method ?? 'GET').toUpperCase();

  // IAM-only Cloud Run route. Never expose this endpoint through public frontend
  // until a user-authenticated server proxy is installed.
  if (normalizedPath === '/internal/shopee/live/logistics/adao/sync-once') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (Object.keys(request.query ?? {}).length || Number(request.headers?.['content-length'] ?? 0) !== 0 || request.headers?.['transfer-encoding'] || request.body) return json(400, { error: 'body_or_query_not_allowed' });
    if (getEnv('SHOPEE_ADAO_LOGISTICS_SYNC_ENABLED') !== 'true') return json(503, { error: 'sync_disabled' });
    const raw = String(getEnv('SHOPEE_ADAO_LOGISTICS_ORDER_SNS') ?? '');
    const orderSns = raw.split(',').map(sn => sn.trim());
    if (!raw || orderSns.length > 20 || orderSns.length !== new Set(orderSns).size || orderSns.some(sn => !/^[A-Za-z0-9]{8,100}$/.test(sn))) return json(503, { error: 'invalid_scope' });
    try {
      const result = await readAdaoLogistics(orderSns);
      if (!result?.ok || result.account !== 'adao' || !Array.isArray(result.selected) || result.selected.length !== orderSns.length
          || result.selected.some(entry => !orderSns.includes(entry.order_sn) || entry.auto_arrangement_authorized !== false || entry.create_shipping_document_authorized !== false || entry.inventory_mutation_authorized !== false)) return json(503, { error: 'classification_unavailable' });
      const entries = result.selected.map(entry => ({
        order_sn: entry.order_sn, state: entry.state,
        reason: typeof entry.reason === 'string' && /^[A-Za-z0-9_:-]{1,100}$/.test(entry.reason) ? entry.reason : null,
      }));
      const pushed = await syncCore({ action: 'shopee.logistics_classification.sync',
        data: { channel_account_id: 'b4027369-5abf-4ac1-ab24-862334fae892', entries } });
      return pushed?.ok && pushed.payload?.status === 'ok' ? json(200, { status: 'ok', count: entries.length }) : json(503, { error: 'sync_unavailable' });
    } catch { return json(503, { error: 'sync_unavailable' }); }
  }

  if (normalizedPath === '/internal/shopee/live/logistics/adao/read-only') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if ((request.query && Object.keys(request.query).length)
      || Number(request.headers?.['content-length'] ?? 0) !== 0 || request.headers?.['transfer-encoding']
      || (request.body != null && request.body !== '')) return json(400, { error: 'body_or_query_not_allowed' });
    if (String(getEnv('SHOPEE_ADAO_LOGISTICS_READ_ENABLED') ?? '').toLowerCase() !== 'true') {
      return json(503, { status: 'blocked', code: 'adao_logistics_read_disabled' });
    }
    const raw = String(getEnv('SHOPEE_ADAO_LOGISTICS_ORDER_SNS') ?? '').trim();
    const orderSns = raw.split(',').map(sn => sn.trim());
    if (!raw || orderSns.length > 20 || new Set(orderSns).size !== orderSns.length
      || orderSns.some(sn => !/^[A-Za-z0-9]{8,100}$/.test(sn))) {
      return json(503, { status: 'blocked', code: 'adao_logistics_read_scope_invalid' });
    }
    try {
      const result = await readAdaoLogistics(orderSns);
      if (!result?.ok || !Array.isArray(result.selected)) {
        return json(503, { status: 'blocked', code: result?.code ?? 'adao_logistics_read_unavailable' });
      }
      return json(200, { status: 'ok', mode: 'read_only', account: 'adao',
        selected: result.selected.map(entry => ({
          order_sn: entry.order_sn, state: entry.state, reason: entry.reason ?? null,
          package_count: entry.package_count ?? null,
          auto_arrangement_authorized: false,
          create_shipping_document_authorized: false,
          inventory_mutation_authorized: false,
        })) });
    } catch {
      return json(503, { status: 'blocked', code: 'adao_logistics_read_unavailable' });
    }
  }

  if (normalizedPath === '/internal/shopee/live/logistics/label/prepare-once') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (request.query && Object.keys(request.query).length) return json(400, { error: 'query_not_allowed' });
    if (Number(request.headers?.['content-length'] ?? 0) !== 0 || request.headers?.['transfer-encoding']
        || (request.body != null && request.body !== '')) return json(400, { error: 'body_not_allowed' });
    if (String(getEnv('SHOPEE_LIVE_LABEL_CREATE_ENABLED') ?? '').trim().toLowerCase() !== 'true') {
      return json(503, { error: 'label_create_not_enabled' });
    }
    if (String(getEnv('SHOPEE_LIVE_LABEL_SYNC_ENABLED') ?? '').trim().toLowerCase() !== 'true') {
      return json(503, { error: 'label_sync_not_enabled' });
    }
    try {
      const result = await prepareShopeeLabel();
      // Never serialize arbitrary connector exceptions or raw upstream payloads.
      return json(result?.ok === true ? 200 : 503, {
        status: result?.ok === true ? 'ok' : 'blocked', mode: 'label_prepare_once',
        code: result?.code ?? 'label_preparation_unavailable',
        document_id: result?.ok === true ? result.document_id ?? null : null,
      });
    } catch { return json(503, { error: 'label_preparation_unavailable' }); }
  }

  if (normalizedPath === '/internal/shopee/live/oauth/refresh-once') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (request.query && Object.keys(request.query).length > 0) {
      return json(400, { error: 'query_not_allowed' });
    }

    const enabled = String(getEnv('SHOPEE_LIVE_OAUTH_REFRESH_ENABLED') ?? '')
      .trim()
      .toLowerCase() === 'true';
    if (!enabled) return json(503, { error: 'oauth_refresh_not_enabled' });

    try {
      const result = await refreshShopeeOauth();
      if (!result?.ok) {
        return json(503, {
          status: 'degraded',
          mode: 'oauth_refresh_once',
          code: result?.code ?? 'unknown_error',
          shopee_status: Number(result?.shopee_status ?? 0) || null,
          shopee_error: result?.shopee_error ?? null,
          before: result?.before ?? null,
        });
      }

      return json(200, {
        status: 'ok',
        mode: 'oauth_refresh_once',
        code: result.code,
        before: result.before ?? null,
        after: result.after ?? null,
      });
    } catch {
      return json(503, {
        status: 'degraded',
        mode: 'oauth_refresh_once',
        code: 'runtime_exception',
      });
    }
  }



  // Diagnóstico fiscal/logístico read-only do pedido piloto: desligado por padrão.
  // Não chama ship_order, create_shipping_document ou escritores do Core.
  if (normalizedPath === '/internal/shopee/live/logistics/shipping/preflight-once') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (request.query && Object.keys(request.query).length > 0) {
      return json(400, { error: 'query_not_allowed' });
    }
    const enabled = String(getEnv('SHOPEE_LIVE_SHIPPING_PREFLIGHT_ENABLED') ?? '')
      .trim().toLowerCase() === 'true';
    if (!enabled) return json(503, { error: 'shipping_preflight_not_enabled' });
    const orderSn = String(getEnv('SHOPEE_LIVE_SHIPPING_PREFLIGHT_ORDER_SN') ?? '').trim();
    const fiscalMode = String(getEnv('SHOPEE_LIVE_SHIPPING_FISCAL_MODE') ?? '').trim();
    if (!orderSn || !['pj_shopee_issuer', 'cpf_no_invoice_step'].includes(fiscalMode)) {
      return json(503, { error: 'shipping_preflight_not_configured' });
    }
    try {
      const result = await inspectShippingPreflight();
      const response = {
        status: result?.ok === true ? 'ok' : 'blocked',
        mode: 'read_only',
        code: result?.code ?? 'unknown_error',
        order_status: result?.order_status ?? null,
        fiscal: result?.fiscal ?? null,
        modes: Array.isArray(result?.modes) ? result.modes : [],
        auto_arrangement_authorized: false,
      };
      return json(result?.ok === true ? 200 : 409, response);
    } catch {
      return json(503, { status: 'degraded', mode: 'read_only', code: 'runtime_exception' });
    }
  }


  // F6-O.2e.2d: private IAM one-pilot shipping. Never a scheduler or browser action.
  // Requires two independent OFF-by-default flags plus an expiring scope
  // rechecked in the guarded executor before Core claim / external POST.
  if (normalizedPath === '/internal/shopee/live/logistics/shipping/ship-once') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (request.query && Object.keys(request.query).length > 0) {
      return json(400, { error: 'query_not_allowed' });
    }
    const headers = request.headers ?? {};
    const length = headers['content-length'];
    if (headers['transfer-encoding'] !== undefined
        || (length !== undefined && length !== '0')) {
      return json(400, { error: 'body_not_allowed' });
    }
    const routeEnabled = String(getEnv('SHOPEE_LIVE_SHIP_ORDER_ROUTE_ENABLED') ?? '')
      .trim().toLowerCase() === 'true';
    const writerEnabled = String(getEnv('SHOPEE_LIVE_SHIP_ORDER_ENABLED') ?? '')
      .trim().toLowerCase() === 'true';
    if (!routeEnabled || !writerEnabled) {
      return json(503, { error: 'ship_order_not_enabled' });
    }
    const runId = makeRunId();
    const startedAt = now();
    // Only allow known, non-sensitive result codes. Never include Shopee response,
    // token, request payload, invoice, buyer details, or package address in logs.
    const knownCodes = new Set([
      'ship_order_api_acknowledged_not_collected',
      'ship_order_disabled', 'ship_order_pilot_not_configured',
      'ship_order_pilot_scope_mismatch', 'ship_order_window_inactive',
      'partner_not_configured', 'preflight_unavailable',
      'preflight_not_eligible', 'preflight_shop_missing',
      'connection_identity_mismatch', 'access_token_expired_no_refresh',
      'token_unavailable', 'shipping_claim_not_acquired',
      'already_claimed', 'already_succeeded', 'uncertain_requires_reconciliation',
      'claim_fingerprint_mismatch', 'account_or_shop_mismatch',
      'order_not_unique_or_missing', 'invalid_request',
      'ship_order_uncertain_requires_reconciliation',
      'sent_but_core_confirmation_missing',
    ]);
    let code = 'runtime_exception';
    let success = false;
    try {
      const result = await shipShopeeOrderOnce();
      code = knownCodes.has(result?.code) ? result.code : 'runtime_exception';
      success = result?.ok === true && code === 'ship_order_api_acknowledged_not_collected';
    } catch { /* Sanitized, no retry. */ }
    const status = success ? 200
      : ['runtime_exception','ship_order_pilot_not_configured','ship_order_window_inactive',
          'partner_not_configured','preflight_unavailable','shipping_claim_not_acquired',
          'sent_but_core_confirmation_missing'].includes(code) ? 503 : 409;
    try {
      logEvent({
        event: 'shopee_ship_order_once',
        runId, startedAt, finishedAt: now(),
        status: success ? 'api_acknowledged' : 'blocked',
        code,
      });
    } catch { /* Logging never changes the request outcome. */ }
    return json(status, {
      status: success ? 'ok' : 'blocked',
      mode: 'single_pilot_ship_order',
      code,
      // This is NOT proof of physical posting or stock movement.
      physical_handoff_confirmed: false,
    });
  }

  // Ação restrita ao pedido piloto configurado no runtime. Desabilitada por padrão.
  if (normalizedPath === '/internal/shopee/live/logistics/label/sync-once') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (request.query && Object.keys(request.query).length > 0) {
      return json(400, { error: 'query_not_allowed' });
    }
    const enabled = String(getEnv('SHOPEE_LIVE_LABEL_SYNC_ENABLED') ?? '').trim().toLowerCase() === 'true';
    if (!enabled) return json(503, { error: 'label_sync_not_enabled' });
    if (!String(getEnv('SHOPEE_LIVE_LABEL_ORDER_SN') ?? '').trim()) {
      return json(503, { error: 'label_target_not_configured' });
    }
    try {
      const result = await syncShopeeLabel();
      if (!result?.ok) {
        return json(503, { status: 'degraded', mode: 'label_sync_once', code: result?.code ?? 'unknown_error' });
      }
      return json(200, {
        status: 'ok', mode: 'label_sync_once', code: result.code,
        document_type: result.document_type ?? 'shipping_label',
        document_id: result.document_id ?? null,
      });
    } catch {
      return json(503, { status: 'degraded', mode: 'label_sync_once', code: 'runtime_exception' });
    }
  }

  if (normalizedPath === '/internal/shopee/live/logistics/inspect') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (request.query && Object.keys(request.query).length > 0) {
      return json(400, { error: 'query_not_allowed' });
    }

    const orderSn = String(getEnv('SHOPEE_LIVE_LOGISTICS_PROBE_ORDER_SN') ?? '').trim();
    if (!orderSn) return json(503, { error: 'logistics_probe_not_configured' });

    try {
      const result = await inspectShopeeLogistics({ orderSn });
      if (!result?.ok) {
        return json(503, {
          status: 'degraded',
          mode: 'read_only',
          orderSn,
          code: result?.code ?? 'unknown_error',
        });
      }

      return json(200, {
        status: 'ok',
        mode: 'read_only',
        order: result.order ?? null,
        shipping_parameter: result.shipping_parameter ?? null,
        shipping_document_parameter: result.shipping_document_parameter ?? null,
      });
    } catch {
      return json(503, {
        status: 'degraded',
        mode: 'read_only',
        orderSn,
        code: 'runtime_exception',
      });
    }
  }

  if (normalizedPath === '/internal/shopee/live/cycle/run') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if ((request.query && Object.keys(request.query).length) || Number(request.headers?.['content-length'] ?? 0) !== 0
      || request.headers?.['transfer-encoding'] || (request.body != null && request.body !== '')) return json(400, { error: 'body_or_query_not_allowed' });
    if (String(getEnv('SHOPEE_LIVE_CYCLE_ENABLED') ?? '').trim().toLowerCase() !== 'true') return json(503, { error: 'cycle_not_enabled' });
    try {
      const result = await runMinimumCycle();
      logEvent({ event: 'shopee_minimum_cycle', runId: makeRunId(), ...result });
      return json(result?.ok ? 200 : 503, result);
    } catch {
      logEvent({ event: 'shopee_minimum_cycle', code: 'cycle_checkpoint_or_runtime_failure' });
      return json(503, { ok: false, code: 'cycle_checkpoint_or_runtime_failure' });
    }
  }

  if (normalizedPath === '/internal/shopee/live/orders/intake/run') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (request.query && Object.keys(request.query).length > 0) {
      return json(400, { error: 'query_not_allowed' });
    }

    const channelAccountId = String(getEnv('SHOPEE_LIVE_CHANNEL_ACCOUNT_ID') ?? '').trim();
    const autoCommitEnabled = String(getEnv('SHOPEE_LIVE_AUTO_COMMIT_ENABLED') ?? '')
      .trim()
      .toLowerCase() === 'true';

    if (!channelAccountId || !autoCommitEnabled) {
      return json(503, { error: 'auto_commit_not_enabled' });
    }

    const runId = makeRunId();
    const startedAt = now();

    try {
      const result = await runShopeeCommit({
        channelAccountId,
        limit: SHOPEE_OPERATIONAL_COMMIT_POLICY.batchLimit,
        mode: 'commit',
      });
      const finishedAt = now();
      const summary = summarizeShopeeControlledRound(result);

      logEvent({
        event: 'shopee_intake_round',
        runId,
        startedAt,
        finishedAt,
        channelAccountId,
        ok: result?.ok === true,
        roundStopped: result?.roundStopped === true,
        stopReason: result?.stopReason ?? null,
        summary,
      });

      const sanitizedResults = Array.isArray(result?.results)
        ? result.results.map((entry) => ({
          orderSn: entry?.orderSn ?? null,
          status: entry?.status ?? null,
          blockers: Array.isArray(entry?.blockers) ? entry.blockers : [],
          alreadyRegistered: entry?.write?.alreadyRegistered === true,
        }))
        : [];

      if (!result?.ok || result?.roundStopped === true) {
        return json(503, {
          status: 'degraded',
          mode: 'commit',
          runId,
          ...summary,
          roundStopped: result?.roundStopped === true,
          stopReason: result?.stopReason ?? null,
          results: sanitizedResults,
        });
      }

      return json(200, {
        status: summary.blocked > 0 || summary.retryable > 0 ? 'attention' : 'ok',
        mode: 'commit',
        runId,
        ...summary,
        roundStopped: false,
        stopReason: null,
        results: sanitizedResults,
      });
    } catch {
      const finishedAt = now();
      logEvent({
        event: 'shopee_intake_round',
        runId,
        startedAt,
        finishedAt,
        channelAccountId,
        ok: false,
        roundStopped: true,
        stopReason: 'runtime_exception',
      });
      return json(503, {
        status: 'degraded',
        mode: 'commit',
        runId,
        selected: 0,
        ready: 0,
        blocked: 0,
        written: 0,
        success: 0,
        retryable: 0,
        unknown: 0,
        statuses: {},
        roundStopped: true,
        stopReason: 'runtime_exception',
        results: [],
      });
    }
  }

  if (normalizedPath === '/internal/shopee/live/orders/intake/commit-one') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (request.query && Object.keys(request.query).length > 0) {
      return json(400, { error: 'query_not_allowed' });
    }

    const channelAccountId = String(getEnv('SHOPEE_LIVE_CHANNEL_ACCOUNT_ID') ?? '').trim();
    const expectedOrderSn = String(getEnv('SHOPEE_LIVE_COMMIT_ORDER_SN') ?? '').trim();
    const commitEnabled = String(getEnv('SHOPEE_LIVE_COMMIT_ENABLED') ?? '').trim().toLowerCase() === 'true';

    if (!channelAccountId || !expectedOrderSn || !commitEnabled) {
      return json(503, { error: 'commit_not_enabled' });
    }

    try {
      const result = await runShopeeCommit({
        channelAccountId,
        limit: 5,
        mode: 'commit',
        expectedOrderSn,
      });

      const entry = Array.isArray(result?.results) ? result.results[0] : null;
      const acceptableStatus = entry?.status === 'written' || entry?.status === 'already_registered';
      const exactTarget = entry?.orderSn === expectedOrderSn;

      if (!result?.ok
        || Number(result.selected ?? 0) !== 1
        || Number(result.ready ?? 0) !== 1
        || Number(result.blocked ?? 0) !== 0
        || !entry
        || !acceptableStatus
        || !exactTarget) {
        return json(409, {
          status: 'blocked',
          mode: 'commit',
          targetOrderSn: expectedOrderSn,
          selected: Number(result?.selected ?? 0),
          ready: Number(result?.ready ?? 0),
          blocked: Number(result?.blocked ?? 0),
          written: Number(result?.written ?? 0),
          result: entry
            ? {
              orderSn: entry.orderSn ?? null,
              status: entry.status ?? null,
              blockers: Array.isArray(entry.blockers) ? entry.blockers : [],
            }
            : null,
        });
      }

      return json(200, {
        status: 'ok',
        mode: 'commit',
        targetOrderSn: expectedOrderSn,
        selected: 1,
        ready: 1,
        blocked: 0,
        written: Number(result.written ?? 0),
        result: {
          orderSn: entry.orderSn,
          status: entry.status,
          alreadyRegistered: entry?.write?.alreadyRegistered === true,
          orderId: typeof entry?.write?.orderId === 'string' ? entry.write.orderId : null,
          separationId: typeof entry?.write?.separationId === 'string' ? entry.write.separationId : null,
        },
      });
    } catch {
      return json(503, {
        status: 'degraded',
        mode: 'commit',
        selected: 0,
        ready: 0,
        blocked: 0,
        written: 0,
        result: null,
      });
    }
  }

  // Private IAM-only fixed-scope mapping diagnostic. No writes or external Shopee calls.
  if (normalizedPath === '/internal/shopee/live/mappings/porto-gel-viviane/preview') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (request.query && Object.keys(request.query).length > 0) return json(400, { error: 'query_not_allowed' });
    if (request.headers?.['transfer-encoding']
      || (request.headers?.['content-length'] !== undefined && request.headers['content-length'] !== '0')
      || (request.body != null && request.body !== '')) return json(400, { error: 'body_not_allowed' });
    try {
      const result = await previewPortoGelVivianeMappings();
      return json(result.ok ? 200 : 503, result.ok ? { status: 'ok', ...result }
        : { status: 'blocked', code: result.code, written: 0 });
    } catch {
      return json(503, { status: 'blocked', code: 'mapping_diagnostic_unavailable', written: 0 });
    }
  }

  if (normalizedPath === '/internal/shopee/live/orders/intake/preview') {
    if (normalizedMethod !== 'POST') return json(405, { error: 'method_not_allowed' });

    const channelAccountId = String(getEnv('SHOPEE_LIVE_CHANNEL_ACCOUNT_ID') ?? '').trim();
    if (!channelAccountId) return json(503, { error: 'runtime_not_configured' });

    try {
      const result = await runShopeePreview({
        channelAccountId,
        limit: 5,
        mode: 'preview',
      });

      if (!result?.ok) {
        return json(503, {
          status: 'degraded',
          mode: 'preview',
          selected: Number(result?.selected ?? 0),
          ready: Number(result?.ready ?? 0),
          blocked: Number(result?.blocked ?? 0),
          written: 0,
          results: [],
        });
      }

      return json(200, {
        status: 'ok',
        mode: 'preview',
        marketplaceAccount: result.marketplaceAccount ?? null,
        selected: Number(result.selected ?? 0),
        ready: Number(result.ready ?? 0),
        blocked: Number(result.blocked ?? 0),
        written: 0,
        sourceCounts: result.sourceCounts ?? null,
        results: Array.isArray(result.results)
          ? result.results.map((entry) => ({
            orderSn: entry?.orderSn ?? null,
            status: entry?.status ?? null,
            blockers: Array.isArray(entry?.blockers) ? entry.blockers : [],
          }))
          : [],
      });
    } catch {
      return json(503, {
        status: 'degraded',
        mode: 'preview',
        selected: 0,
        ready: 0,
        blocked: 0,
        written: 0,
        results: [],
      });
    }
  }

  if (normalizedPath !== '/health/core') return routeRequest(request);
  if (normalizedMethod !== 'GET') {
    return json(405, { error: 'method_not_allowed' });
  }
  let available = false;
  try { available = await probeCore() === true; } catch { /* Sanitized response below. */ }
  return json(available ? 200 : 503, {
    status: available ? 'ok' : 'degraded',
    service: HUB_SERVICE_NAME,
    core_bridge: available ? 'ok' : 'unavailable',
  });
}

export function routeRequest({ method, path }) {
  const normalizedMethod = String(method ?? 'GET').toUpperCase();
  const normalizedPath = String(path ?? '/');

  if (normalizedPath === '/health') {
    if (normalizedMethod !== 'GET') {
      return json(405, { error: 'method_not_allowed' });
    }

    return json(200, {
      status: 'ok',
      service: HUB_SERVICE_NAME,
      version: HUB_VERSION,
    });
  }

  if (normalizedPath === '/') {
    if (normalizedMethod !== 'GET') {
      return json(405, { error: 'method_not_allowed' });
    }

    return json(200, {
      service: HUB_SERVICE_NAME,
      version: HUB_VERSION,
      role: 'external-integration-runtime',
    });
  }

  return json(404, { error: 'route_not_found' });
}
