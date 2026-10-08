import { createHash, createHmac, randomUUID } from 'node:crypto';

export const CORE_BRIDGE_URL = 'https://xkskyutmtlhivvpfxkjg.supabase.co/functions/v1/integration-core-bridge';
const HEALTH_BODY = '{"action":"health"}';
const TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 1024;

export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function hmacHex(secret, payload) {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function buildSignedHeaders({ secret, body, timestamp = Math.floor(Date.now() / 1000), requestId = randomUUID() }) {
  const canonical = `v1\n${timestamp}\n${requestId}\n${sha256Hex(body)}`;
  return {
    'Content-Type': 'application/json',
    'X-Integration-Hub-Version': 'v1',
    'X-Integration-Hub-Timestamp': String(timestamp),
    'X-Integration-Hub-Request-Id': requestId,
    'X-Integration-Hub-Signature': hmacHex(secret, canonical),
  };
}

async function readHealthResponse(response) {
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

// Only the health contract is supported. Never forward credentials or a raw response.
export async function probeCoreBridge({
  url = process.env.CORE_BRIDGE_URL,
  secret = process.env.CORE_BRIDGE_HMAC_SECRET,
  fetchImpl = globalThis.fetch,
  logger = (entry) => console.info(JSON.stringify(entry)),
} = {}) {
  const requestId = randomUUID();
  const started = Date.now();
  let available = false;
  let status = 503;
  try {
    if (url === CORE_BRIDGE_URL && typeof secret === 'string' && secret.length > 0) {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: buildSignedHeaders({ secret, body: HEALTH_BODY, requestId }),
        body: HEALTH_BODY,
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      status = response.status;
      if (status === 200) {
        const result = await readHealthResponse(response);
        available = result?.status === 'ok' && result.bridge === 'integration-core-bridge'
          && result.core === 'reachable' && result.request_id === requestId;
      } else {
        await response.body?.cancel();
      }
    }
  } catch {
    available = false;
  }
  try {
    logger({ request_id: requestId, action: 'health', version: 'v1', result: available ? 'ok' : 'unavailable', status, duration_ms: Date.now() - started });
  } catch { /* Logging must not affect health or expose an internal exception. */ }
  return available;
}
