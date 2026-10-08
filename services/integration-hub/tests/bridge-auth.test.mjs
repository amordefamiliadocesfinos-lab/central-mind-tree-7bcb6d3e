import test from 'node:test';
import assert from 'node:assert/strict';
import { createBridgeHandler } from '../../../supabase/functions/integration-core-bridge/handler.mjs';
import { buildSignedHeaders } from '../src/core-bridge.mjs';

const SECRET = 'synthetic-test-fixture-only-32-bytes-minimum';
const REQUEST_ID = '123e4567-e89b-42d3-a456-426614174000';
const SECONDS = 1700000000;
const BODY = '{"action":"health"}';
const URL = 'https://bridge.test/health';

function signed(body = BODY, { timestamp = SECONDS, headers = {} } = {}) {
  return new Request(URL, { method: 'POST', body, headers: { ...buildSignedHeaders({ secret: SECRET, body, timestamp, requestId: REQUEST_ID }), ...headers } });
}

function fixture(overrides = {}) {
  let calls = 0;
  const logs = [];
  const handler = createBridgeHandler({ getSecret: () => SECRET, checkCore: async () => { calls += 1; return true; }, now: () => SECONDS * 1000, logger: (entry) => logs.push(entry), ...overrides });
  return { handler, logs, calls: () => calls };
}

test('Bridge accepts a valid signature, calls Core once and returns no database record', async () => {
  const f = fixture();
  const response = await f.handler(signed());
  assert.equal(response.status, 200);
  assert.equal(f.calls(), 1);
  assert.deepEqual(await response.json(), { status: 'ok', bridge: 'integration-core-bridge', core: 'reachable', request_id: REQUEST_ID });
  assert.equal(f.logs[0].request_id, REQUEST_ID);
});

test('Bridge rejects missing HMAC before accessing Core or secret', async () => {
  const f = fixture({ getSecret: () => { throw new Error('must not read secret'); } });
  const response = await f.handler(new Request(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: BODY }));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'unauthorized' });
  assert.equal(f.calls(), 0);
});

test('Bridge rejects an incorrect well-formed signature without accessing Core', async () => {
  const f = fixture();
  assert.equal((await f.handler(signed(BODY, { headers: { 'X-Integration-Hub-Signature': '0'.repeat(64) } }))).status, 401);
  assert.equal(f.calls(), 0);
});

test('Bridge binds exact raw bytes, so even whitespace tampering fails', async () => {
  const headers = buildSignedHeaders({ secret: SECRET, body: BODY, timestamp: SECONDS, requestId: REQUEST_ID });
  const f = fixture();
  assert.equal((await f.handler(new Request(URL, { method: 'POST', headers, body: '{ "action":"health"}' }))).status, 401);
  assert.equal(f.calls(), 0);
});

test('Bridge accepts the exact timestamp boundaries and rejects expired or future timestamps beyond 300 seconds', async () => {
  for (const offset of [-300, 300]) assert.equal((await fixture().handler(signed(BODY, { timestamp: SECONDS + offset }))).status, 200);
  for (const offset of [-301, 301]) {
    const f = fixture();
    assert.equal((await f.handler(signed(BODY, { timestamp: SECONDS + offset }))).status, 401);
    assert.equal(f.calls(), 0);
  }
});

test('Bridge rejects unsupported version, malformed timestamp, UUID and hex signature', async () => {
  for (const headers of [
    { 'X-Integration-Hub-Version': 'v2' },
    { 'X-Integration-Hub-Timestamp': '1e9' },
    { 'X-Integration-Hub-Timestamp': '01700000000' },
    { 'X-Integration-Hub-Request-Id': 'not-a-uuid' },
    { 'X-Integration-Hub-Signature': 'x'.repeat(64) },
    { 'X-Integration-Hub-Signature': 'a'.repeat(63) },
  ]) {
    const f = fixture();
    assert.equal((await f.handler(signed(BODY, { headers }))).status, 401);
    assert.equal(f.calls(), 0);
  }
});

test('Bridge rejects methods other than POST', async () => {
  const f = fixture();
  for (const method of ['GET', 'PUT', 'OPTIONS']) assert.equal((await f.handler(new Request(URL, { method }))).status, 405);
  assert.equal(f.calls(), 0);
});

test('Bridge rejects non-JSON content type', async () => {
  const f = fixture();
  assert.equal((await f.handler(signed(BODY, { headers: { 'Content-Type': 'text/plain' } }))).status, 400);
  assert.equal(f.calls(), 0);
});

test('Bridge permits only the exact health action, rejecting arbitrary actions and extra fields', async () => {
  for (const body of ['{"action":"query"}', '{"action":"health","table":"users"}', '{}', '[]', 'null', 'invalid json']) {
    const f = fixture();
    const response = await f.handler(signed(body));
    assert.equal(response.status, 400);
    assert.equal(f.calls(), 0);
    assert.deepEqual(await response.json(), { error: 'invalid_request' });
  }
});

test('Bridge enforces a byte limit without trusting Content-Length', async () => {
  const f = fixture();
  assert.equal((await f.handler(signed('x'.repeat(1025)))).status, 400);
  assert.equal((await f.handler(signed('á'.repeat(600)))).status, 400);
  assert.equal((await f.handler(signed(BODY, { headers: { 'Content-Length': '1025' } }))).status, 400);
  assert.equal(f.calls(), 0);
});

test('missing server configuration fails closed with no configuration details', async () => {
  const response = await fixture({ getSecret: () => undefined }).handler(signed());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'degraded', bridge: 'integration-core-bridge', core: 'unavailable', request_id: null });
});

test('Core failure and internal exceptions return only a sanitized 503', async () => {
  for (const checkCore of [async () => false, async () => { throw new Error(`SQL private-id ${SECRET}`); }, async () => ({ id: 'private-id' })]) {
    const f = fixture({ checkCore });
    const response = await f.handler(signed());
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'degraded', bridge: 'integration-core-bridge', core: 'unavailable', request_id: REQUEST_ID });
    const logs = JSON.stringify(f.logs);
    for (const forbidden of [SECRET, 'SQL', 'private-id', 'signature', 'Authorization']) assert.ok(!logs.includes(forbidden));
  }
});

test('logging failures do not change the authenticated health result', async () => {
  const response = await fixture({ logger: () => { throw new Error(SECRET); } }).handler(signed());
  assert.equal(response.status, 200);
  assert.ok(!(await response.text()).includes(SECRET));
});
