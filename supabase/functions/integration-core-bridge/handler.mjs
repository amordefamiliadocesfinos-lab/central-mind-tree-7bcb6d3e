const LEGACY_MAX_BODY_BYTES = 1024;
const LIVE_MAX_BODY_BYTES = 64 * 1024;
const JSON_CONTENT_TYPE = 'application/json';
const LIVE_CONTENT_TYPE = 'application/vnd.painel.shopee-live-v1+json';
const TIMESTAMP_TOLERANCE_SECONDS = 300;
const STATE_MAX_TTL_MS = 15 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIGNATURE = /^[0-9a-f]{64}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const POSITIVE_INTEGER_TEXT = /^[1-9]\d{0,18}$/;
const encoder = new TextEncoder();

const LIVE_ACTIONS = new Set([
  'shopee.oauth_state.create',
  'shopee.oauth_state.consume',
  'shopee.oauth_connection.upsert',
  'shopee.raw_shop_snapshot.upsert',
]);

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}

function hex(bytes) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Both inputs have already been constrained to 64 lowercase hex characters.
function constantTimeEqual(expected, received) {
  let difference = 0;
  for (let i = 0; i < 64; i += 1) difference |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  return difference === 0;
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value, required, optional = []) {
  if (!isObject(value)) return false;
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && keys.every((key) => allowed.has(key));
}

function isIsoTimestamp(value) {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));
}

function isOptionalIsoTimestamp(value) {
  return value === null || value === undefined || isIsoTimestamp(value);
}

function isNullablePositiveInteger(value) {
  return value === null || value === undefined || (Number.isSafeInteger(value) && value > 0);
}

function isBoundedText(value, max, { nullable = false } = {}) {
  if (nullable && (value === null || value === undefined)) return true;
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function validateActionPayload(payload, nowMs) {
  if (!isObject(payload) || typeof payload.action !== 'string') return false;

  if (payload.action === 'health') {
    return hasExactKeys(payload, ['action']);
  }

  if (!LIVE_ACTIONS.has(payload.action)) return false;

  if (payload.action === 'shopee.oauth_state.create') {
    if (!hasExactKeys(payload, ['action', 'channel_account_id', 'state_hash', 'expires_at'])) return false;
    const expiresAt = Date.parse(payload.expires_at);
    return UUID.test(payload.channel_account_id)
      && SHA256.test(payload.state_hash)
      && Number.isFinite(expiresAt)
      && expiresAt > nowMs
      && expiresAt <= nowMs + STATE_MAX_TTL_MS;
  }

  if (payload.action === 'shopee.oauth_state.consume') {
    return hasExactKeys(payload, ['action', 'state_hash']) && SHA256.test(payload.state_hash);
  }

  if (payload.action === 'shopee.oauth_connection.upsert') {
    const required = [
      'action',
      'channel_account_id',
      'partner_id',
      'shop_id',
      'access_token_ciphertext',
      'refresh_token_ciphertext',
      'access_token_expires_at',
      'refresh_token_expires_at',
      'last_authenticated_at',
    ];
    const optional = [
      'main_account_id',
      'merchant_id',
      'authorization_expires_at',
      'shop_name',
      'region',
      'shop_status',
      'last_refreshed_at',
    ];
    if (!hasExactKeys(payload, required, optional)) return false;
    return UUID.test(payload.channel_account_id)
      && Number.isSafeInteger(payload.partner_id) && payload.partner_id > 0
      && Number.isSafeInteger(payload.shop_id) && payload.shop_id > 0
      && isNullablePositiveInteger(payload.main_account_id)
      && isNullablePositiveInteger(payload.merchant_id)
      && isBoundedText(payload.access_token_ciphertext, 4096)
      && isBoundedText(payload.refresh_token_ciphertext, 4096)
      && isOptionalIsoTimestamp(payload.access_token_expires_at)
      && isOptionalIsoTimestamp(payload.refresh_token_expires_at)
      && isOptionalIsoTimestamp(payload.authorization_expires_at)
      && isIsoTimestamp(payload.last_authenticated_at)
      && isOptionalIsoTimestamp(payload.last_refreshed_at)
      && isBoundedText(payload.shop_name, 300, { nullable: true })
      && isBoundedText(payload.region, 64, { nullable: true })
      && isBoundedText(payload.shop_status, 128, { nullable: true });
  }

  if (payload.action === 'shopee.raw_shop_snapshot.upsert') {
    const required = [
      'action',
      'channel_account_id',
      'external_entity_id',
      'observed_at',
      'payload',
      'payload_hash',
    ];
    const optional = ['request_id'];
    if (!hasExactKeys(payload, required, optional)) return false;
    return UUID.test(payload.channel_account_id)
      && typeof payload.external_entity_id === 'string'
      && POSITIVE_INTEGER_TEXT.test(payload.external_entity_id)
      && isIsoTimestamp(payload.observed_at)
      && isObject(payload.payload)
      && SHA256.test(payload.payload_hash)
      && isBoundedText(payload.request_id, 300, { nullable: true });
  }

  return false;
}

async function readBody(request) {
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBodyBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

/**
 * @param {{
 *   getSecret: () => string | undefined,
 *   checkCore: () => Promise<boolean>,
 *   executeAction?: (payload: Record<string, unknown>, context: { requestId: string, nowMs: number }) => Promise<{ status: number, body: Record<string, unknown> }>,
 *   now?: () => number,
 *   logger?: (entry: Record<string, string | number | null>) => void
 * }} dependencies
 */
export function createBridgeHandler({
  getSecret,
  checkCore,
  executeAction = async () => ({ status: 400, body: { error: 'unsupported_action' } }),
  now = Date.now,
  logger = () => {},
}) {
  return async (request) => {
    const started = Date.now();
    let requestId = null;
    let authenticated = false;
    let action = null;

    const finish = (status, body) => {
      try {
        logger({
          request_id: requestId,
          action: authenticated ? action : null,
          version: 'v1',
          result: status === 200 ? 'ok' : 'rejected_or_unavailable',
          status,
          duration_ms: Date.now() - started,
        });
      } catch { /* Never propagate logger errors. */ }
      return json(status, body);
    };

    const invalid = () => finish(400, { error: 'invalid_request' });
    const unauthorized = () => finish(401, { error: 'unauthorized' });
    const unavailable = () => finish(503, {
      status: 'degraded',
      bridge: 'integration-core-bridge',
      core: 'unavailable',
      request_id: requestId,
    });

    if (request.method !== 'POST') return finish(405, { error: 'method_not_allowed' });
    const mediaType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
    if (mediaType !== JSON_CONTENT_TYPE && mediaType !== LIVE_CONTENT_TYPE) return invalid();
    const maxBodyBytes = mediaType === LIVE_CONTENT_TYPE ? LIVE_MAX_BODY_BYTES : LEGACY_MAX_BODY_BYTES;

    const version = request.headers.get('x-integration-hub-version');
    const timestamp = request.headers.get('x-integration-hub-timestamp') ?? '';
    const id = request.headers.get('x-integration-hub-request-id') ?? '';
    const signature = request.headers.get('x-integration-hub-signature') ?? '';

    if (version !== 'v1' || !/^(0|[1-9]\d{0,11})$/.test(timestamp) || !UUID.test(id) || !SIGNATURE.test(signature)) {
      return unauthorized();
    }

    const seconds = Number(timestamp);
    if (!Number.isSafeInteger(seconds) || Math.abs(Math.floor(now() / 1000) - seconds) > TIMESTAMP_TOLERANCE_SECONDS) {
      return unauthorized();
    }

    try {
      const bytes = await readBody(request, maxBodyBytes);
      if (bytes === null) return invalid();

      const secret = getSecret();
      if (!secret) return unavailable();

      const hash = hex(await crypto.subtle.digest('SHA-256', bytes));
      const canonical = `v1\n${timestamp}\n${id}\n${hash}`;
      const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const expected = hex(await crypto.subtle.sign('HMAC', key, encoder.encode(canonical)));
      if (!constantTimeEqual(expected, signature)) return unauthorized();

      authenticated = true;
      requestId = id;

      let payload;
      try {
        payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      } catch {
        return invalid();
      }

      const currentNow = now();
      if (!validateActionPayload(payload, currentNow)) return invalid();
      action = payload.action;

      if (action === 'health' && mediaType !== JSON_CONTENT_TYPE) return invalid();
      if (LIVE_ACTIONS.has(action) && mediaType !== LIVE_CONTENT_TYPE) return invalid();

      if (action === 'health') {
        if (await checkCore() !== true) return unavailable();
        return finish(200, {
          status: 'ok',
          bridge: 'integration-core-bridge',
          core: 'reachable',
          request_id: requestId,
        });
      }

      const outcome = await executeAction(payload, { requestId, nowMs: currentNow });
      const status = Number(outcome?.status);
      if (![200, 400, 409, 503].includes(status) || !isObject(outcome?.body)) return unavailable();
      return finish(status, { ...outcome.body, request_id: requestId });
    } catch {
      return unavailable();
    }
  };
}

export const BRIDGE_LIVE_ACTIONS = Object.freeze([...LIVE_ACTIONS]);
