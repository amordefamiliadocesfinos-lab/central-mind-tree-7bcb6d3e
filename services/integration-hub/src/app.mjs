import { HUB_SERVICE_NAME, HUB_VERSION } from './contracts.mjs';
import { probeCoreBridge } from './core-bridge.mjs';
import { handleShopeeLiveOauthRequest } from './shopee-live-oauth.mjs';

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
  { probeCore = probeCoreBridge, handleShopeeLive = handleShopeeLiveOauthRequest } = {},
) {
  const shopeeLiveResponse = await handleShopeeLive(request);
  if (shopeeLiveResponse) return shopeeLiveResponse;

  if (String(request.path ?? '/') !== '/health/core') return routeRequest(request);
  if (String(request.method ?? 'GET').toUpperCase() !== 'GET') {
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
