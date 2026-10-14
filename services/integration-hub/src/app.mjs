import { HUB_SERVICE_NAME, HUB_VERSION } from './contracts.mjs';
import { probeCoreBridge } from './core-bridge.mjs';
import { handleShopeeLiveOauthRequest } from './shopee-live-oauth.mjs';
import { runShopeeControlledAutoIntake } from './shopee-order-auto-intake.mjs';
import { inspectShopeeLiveLogistics } from './shopee-live-logistics.mjs';
import { refreshShopeeOauthOnce } from './shopee-oauth-refresh-once.mjs';
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
    probeCore = probeCoreBridge,
    handleShopeeLive = handleShopeeLiveOauthRequest,
    runShopeePreview = runShopeeControlledAutoIntake,
    runShopeeCommit = runShopeeControlledAutoIntake,
    inspectShopeeLogistics = inspectShopeeLiveLogistics,
    refreshShopeeOauth = refreshShopeeOauthOnce,
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
