const MAX_BODY_BYTES = 1024;
const TIMESTAMP_TOLERANCE_SECONDS = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIGNATURE = /^[0-9a-f]{64}$/;
const encoder = new TextEncoder();

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
      if (size > MAX_BODY_BYTES) {
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
 * @param {{ getSecret: () => string | undefined, checkCore: () => Promise<boolean>,
 * now?: () => number, logger?: (entry: Record<string, string | number | null>) => void }} dependencies
 */
export function createBridgeHandler({ getSecret, checkCore, now = Date.now, logger = () => {} }) {
  return async (request) => {
    const started = Date.now();
    let requestId = null;
    let authenticated = false;
    const finish = (status, body) => {
      try {
        logger({ request_id: requestId, action: authenticated ? 'health' : null, version: 'v1', result: status === 200 ? 'ok' : 'rejected_or_unavailable', status, duration_ms: Date.now() - started });
      } catch { /* Never propagate logger errors. */ }
      return json(status, body);
    };
    const invalid = () => finish(400, { error: 'invalid_request' });
    const unauthorized = () => finish(401, { error: 'unauthorized' });
    const unavailable = () => finish(503, { status: 'degraded', bridge: 'integration-core-bridge', core: 'unavailable', request_id: requestId });

    if (request.method !== 'POST') return finish(405, { error: 'method_not_allowed' });
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return invalid();
    const version = request.headers.get('x-integration-hub-version');
    const timestamp = request.headers.get('x-integration-hub-timestamp') ?? '';
    const id = request.headers.get('x-integration-hub-request-id') ?? '';
    const signature = request.headers.get('x-integration-hub-signature') ?? '';
    if (version !== 'v1' || !/^(0|[1-9]\d{0,11})$/.test(timestamp) || !UUID.test(id) || !SIGNATURE.test(signature)) return unauthorized();
    const seconds = Number(timestamp);
    if (!Number.isSafeInteger(seconds) || Math.abs(Math.floor(now() / 1000) - seconds) > TIMESTAMP_TOLERANCE_SECONDS) return unauthorized();
    // An authenticated request ID is returned only after signature verification.
    try {
      const bytes = await readBody(request);
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
      try { payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { return invalid(); }
      if (typeof payload !== 'object' || payload === null || Array.isArray(payload)
        || Object.keys(payload).length !== 1 || payload.action !== 'health') return invalid();
      if (await checkCore() !== true) return unavailable();
      return finish(200, { status: 'ok', bridge: 'integration-core-bridge', core: 'reachable', request_id: requestId });
    } catch { return unavailable(); }
  };
}
