import { HUB_SERVICE_NAME, HUB_VERSION } from './contracts.mjs';
import { probeCoreBridge } from './core-bridge.mjs';
import { handleShopeeLiveOauthRequest } from './shopee-live-oauth.mjs';
import { runShopeeControlledAutoIntake } from './shopee-order-auto-intake.mjs';

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
    getEnv = (name) => process.env[name],
  } = {},
) {
  const shopeeLiveResponse = await handleShopeeLive(request);
  if (shopeeLiveResponse) return shopeeLiveResponse;

  const normalizedPath = String(request.path ?? '/');
  const normalizedMethod = String(request.method ?? 'GET').toUpperCase();

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
