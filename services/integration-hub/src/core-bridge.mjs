import { createHash, createHmac, randomUUID } from 'node:crypto';

export const CORE_BRIDGE_URL = 'https://xkskyutmtlhivvpfxkjg.supabase.co/functions/v1/integration-core-bridge';
export const CORE_BRIDGE_LIVE_CONTENT_TYPE = 'application/vnd.painel.shopee-live-v1+json';
const JSON_CONTENT_TYPE = 'application/json';
const TIMEOUT_MS = 5000;
// Core Bridge responses remain small and sanitized, including Shopee Live actions.
// Keep the original F3 response ceiling so oversized upstream responses fail closed.
const MAX_RESPONSE_BYTES = 1024;

export const CORE_BRIDGE_ACTIONS = Object.freeze({
  HEALTH: 'health',
  SHOPEE_OAUTH_STATE_CREATE: 'shopee.oauth_state.create',
  SHOPEE_OAUTH_STATE_CONSUME: 'shopee.oauth_state.consume',
  SHOPEE_OAUTH_CONNECTION_UPSERT: 'shopee.oauth_connection.upsert',
  SHOPEE_RAW_SHOP_SNAPSHOT_UPSERT: 'shopee.raw_shop_snapshot.upsert',
});

export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function hmacHex(secret, payload) {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function buildSignedHeaders({
  secret,
  body,
  timestamp = Math.floor(Date.now() / 1000),
  requestId = randomUUID(),
  contentType = JSON_CONTENT_TYPE,
}) {
  const canonical = `v1\n${timestamp}\n${requestId}\n${sha256Hex(body)}`;
  return {
    'Content-Type': contentType,
    'X-Integration-Hub-Version': 'v1',
    'X-Integration-Hub-Timestamp': String(timestamp),
    'X-Integration-Hub-Request-Id': requestId,
    'X-Integration-Hub-Signature': hmacHex(secret, canonical),
  };
}

async function readJsonResponse(response) {
  if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return null;
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = Buffer.concat(chunks, size);
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

export async function callCoreBridgeAction({
  action,
  data = {},
  url = process.env.CORE_BRIDGE_URL,
  secret = process.env.CORE_BRIDGE_HMAC_SECRET,
  fetchImpl = globalThis.fetch,
  logger = (entry) => console.info(JSON.stringify(entry)),
  timeoutMs = TIMEOUT_MS,
} = {}) {
  const requestId = randomUUID();
  const started = Date.now();
  let status = 503;
  let payload = null;

  try {
    if (
      url !== CORE_BRIDGE_URL
      || typeof secret !== 'string'
      || secret.length === 0
      || typeof action !== 'string'
      || !data
      || typeof data !== 'object'
      || Array.isArray(data)
      || Object.prototype.hasOwnProperty.call(data, 'action')
    ) {
      return { ok: false, status, payload: null, requestId };
    }

    const body = JSON.stringify({ action, ...data });
    const contentType = action === CORE_BRIDGE_ACTIONS.HEALTH
      ? JSON_CONTENT_TYPE
      : CORE_BRIDGE_LIVE_CONTENT_TYPE;
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: buildSignedHeaders({ secret, body, requestId, contentType }),
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
    status = response.status;
    payload = await readJsonResponse(response);
    const responseRequestId = payload && typeof payload === 'object' ? payload.request_id : null;
    const ok = status === 200 && responseRequestId === requestId;

    try {
      logger({
        request_id: requestId,
        action,
        version: 'v1',
        result: ok ? 'ok' : 'unavailable',
        status,
        duration_ms: Date.now() - started,
      });
    } catch { /* Logging must not affect the request. */ }

    return { ok, status, payload, requestId };
  } catch {
    try {
      logger({
        request_id: requestId,
        action: typeof action === 'string' ? action : null,
        version: 'v1',
        result: 'unavailable',
        status,
        duration_ms: Date.now() - started,
      });
    } catch { /* Never expose an internal exception through logging. */ }
    return { ok: false, status, payload: null, requestId };
  }
}

export async function probeCoreBridge(options = {}) {
  const result = await callCoreBridgeAction({
    ...options,
    action: CORE_BRIDGE_ACTIONS.HEALTH,
    data: {},
  });
  return result.ok
    && result.payload?.status === 'ok'
    && result.payload?.bridge === 'integration-core-bridge'
    && result.payload?.core === 'reachable';
}

export function createLiveShopeeOauthState(data, options = {}) {
  return callCoreBridgeAction({
    ...options,
    action: CORE_BRIDGE_ACTIONS.SHOPEE_OAUTH_STATE_CREATE,
    data,
  });
}

export function consumeLiveShopeeOauthState(data, options = {}) {
  return callCoreBridgeAction({
    ...options,
    action: CORE_BRIDGE_ACTIONS.SHOPEE_OAUTH_STATE_CONSUME,
    data,
  });
}

export function upsertLiveShopeeOauthConnection(data, options = {}) {
  return callCoreBridgeAction({
    ...options,
    action: CORE_BRIDGE_ACTIONS.SHOPEE_OAUTH_CONNECTION_UPSERT,
    data,
  });
}

export function upsertLiveShopeeShopSnapshot(data, options = {}) {
  return callCoreBridgeAction({
    ...options,
    action: CORE_BRIDGE_ACTIONS.SHOPEE_RAW_SHOP_SNAPSHOT_UPSERT,
    data,
  });
}
