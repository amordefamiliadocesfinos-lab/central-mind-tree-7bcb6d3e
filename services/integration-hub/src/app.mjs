import { HUB_SERVICE_NAME, HUB_VERSION } from './contracts.mjs';

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
