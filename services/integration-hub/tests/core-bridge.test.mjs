import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { buildSignedHeaders, CORE_BRIDGE_URL, hmacHex, probeCoreBridge, sha256Hex, readLiveShopeeOrderIntakeBatch } from '../src/core-bridge.mjs';
import { handleRequest, routeRequest } from '../src/app.mjs';
import { createBridgeHandler } from '../../../supabase/functions/integration-core-bridge/handler.mjs';

const SECRET = 'synthetic-test-fixture-only-32-bytes-minimum';
const REQUEST_ID = '123e4567-e89b-42d3-a456-426614174000';
const BODY = '{"action":"health"}';
const quiet = () => {};

test('SHA256 and HMAC match published cryptographic vectors', () => {
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(hmacHex(Buffer.alloc(20, 0x0b), 'Hi There'), 'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');
});

test('signed headers are deterministic and bind exact body bytes, timestamp and request ID', () => {
  const input = { secret: SECRET, body: BODY, timestamp: 1700000000, requestId: REQUEST_ID };
  const headers = buildSignedHeaders(input);
  assert.deepEqual(headers, buildSignedHeaders(input));
  assert.match(headers['X-Integration-Hub-Signature'], /^[0-9a-f]{64}$/);
  for (const change of [{ body: '{ "action":"health"}' }, { timestamp: 1700000001 }, { requestId: '123e4567-e89b-42d3-a456-426614174001' }]) {
    assert.notEqual(headers['X-Integration-Hub-Signature'], buildSignedHeaders({ ...input, ...change })['X-Integration-Hub-Signature']);
  }
});

test('local /health stays identical and never invokes the Core dependency', async () => {
  const request = { method: 'GET', path: '/health' };
  const response = await handleRequest(request, { probeCore: () => { throw new Error('must not call Core'); } });
  assert.deepEqual(response, routeRequest(request));
  assert.equal(response.status, 200);
});

test('/health/core returns only the sanitized success contract', async () => {
  const response = await handleRequest({ method: 'GET', path: '/health/core' }, { probeCore: async () => true });
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), { status: 'ok', service: 'painel-central-integration-hub', core_bridge: 'ok' });
});

test('/health/core sanitizes unavailable results and thrown internal errors', async () => {
  for (const probeCore of [async () => false, async () => { throw new Error(SECRET); }, async () => ({ secret: SECRET })]) {
    const response = await handleRequest({ method: 'GET', path: '/health/core' }, { probeCore });
    assert.equal(response.status, 503);
    assert.deepEqual(JSON.parse(response.body), { status: 'degraded', service: 'painel-central-integration-hub', core_bridge: 'unavailable' });
    assert.ok(!response.body.includes(SECRET));
  }
});

test('/health/core rejects other methods before invoking the dependency', async () => {
  const response = await handleRequest({ method: 'POST', path: '/health/core' }, { probeCore: () => { throw new Error('must not call Core'); } });
  assert.equal(response.status, 405);
});

test('Hub and real Bridge handler interoperate with independent crypto and correlated sanitized logs', async () => {
  const hubLogs = [];
  const bridgeLogs = [];
  let requests = 0;
  let reads = 0;
  const bridge = createBridgeHandler({ getSecret: () => SECRET, checkCore: async () => { reads += 1; return true; }, logger: (entry) => bridgeLogs.push(entry) });
  const available = await probeCoreBridge({
    url: CORE_BRIDGE_URL, secret: SECRET, logger: (entry) => hubLogs.push(entry),
    fetchImpl: async (url, options) => {
      requests += 1;
      assert.equal(url, CORE_BRIDGE_URL);
      assert.equal(options.body, BODY);
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      assert.equal(options.headers.Authorization, undefined);
      return bridge(new Request(url, options));
    },
  });
  assert.equal(available, true);
  assert.equal(requests, 1);
  assert.equal(reads, 1);
  assert.equal(hubLogs[0].request_id, bridgeLogs[0].request_id);
  assert.equal(bridgeLogs[0].action, 'health');
  const logs = JSON.stringify([...hubLogs, ...bridgeLogs]);
  assert.ok(!logs.includes(SECRET));
  assert.ok(!logs.includes('Signature'));
  assert.ok(!logs.includes('Authorization'));
});

test('missing configuration and noncanonical destination fail closed without a network call', async () => {
  for (const config of [{ url: undefined, secret: SECRET }, { url: CORE_BRIDGE_URL, secret: '' }, { url: 'https://example.invalid/bridge', secret: SECRET }]) {
    assert.equal(await probeCoreBridge({ ...config, logger: quiet, fetchImpl: () => { throw new Error('must not fetch'); } }), false);
  }
});

test('Bridge failure makes one attempt and never logs the internal exception', async () => {
  const logs = [];
  let attempts = 0;
  assert.equal(await probeCoreBridge({ url: CORE_BRIDGE_URL, secret: SECRET, logger: (entry) => logs.push(entry), fetchImpl: async () => { attempts += 1; throw new Error(SECRET); } }), false);
  assert.equal(attempts, 1);
  assert.ok(!JSON.stringify(logs).includes(SECRET));
});

test('untrusted Bridge responses fail closed, including a mismatched request ID', async () => {
  const bodies = ['not json', JSON.stringify({ status: 'ok', bridge: 'integration-core-bridge', core: 'reachable', request_id: REQUEST_ID }), JSON.stringify({ status: 'degraded' })];
  for (const body of bodies) {
    assert.equal(await probeCoreBridge({ url: CORE_BRIDGE_URL, secret: SECRET, logger: quiet, fetchImpl: async () => new Response(body, { headers: { 'content-type': 'application/json' } }) }), false);
  }
  assert.equal(await probeCoreBridge({ url: CORE_BRIDGE_URL, secret: SECRET, logger: quiet, fetchImpl: async () => new Response(SECRET, { status: 503 }) }), false);
});

test('oversized Bridge response is cancelled without exposing its contents', async () => {
  let cancelled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1025)); }, cancel() { cancelled = true; } });
  assert.equal(await probeCoreBridge({ url: CORE_BRIDGE_URL, secret: SECRET, logger: quiet, fetchImpl: async () => new Response(body, { headers: { 'content-type': 'application/json' } }) }), false);
  assert.equal(cancelled, true);
});

test('a stalled HTTP response is aborted within the explicit timeout, without retry', { timeout: 10000 }, async () => {
  let received = 0;
  const upstream = createServer((_request, response) => {
    received += 1;
    response.writeHead(200, { 'content-type': 'application/json' });
    response.write('{'); // Keep the body open to verify that timeout covers body reading too.
  });
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  const localUrl = `http://127.0.0.1:${upstream.address().port}`;
  let attempts = 0;
  const started = Date.now();
  try {
    const available = await probeCoreBridge({ url: CORE_BRIDGE_URL, secret: SECRET, logger: quiet, fetchImpl: (_url, options) => { attempts += 1; return fetch(localUrl, options); } });
    assert.equal(available, false);
    assert.equal(attempts, 1);
    assert.equal(received, 1);
    assert.ok(Date.now() - started >= 4500);
    assert.ok(Date.now() - started < 8000);
  } finally {
    upstream.closeAllConnections();
    await new Promise((resolve) => upstream.close(resolve));
  }
});

test('real local server serves /health without secrets and degrades /health/core safely', { timeout: 10000 }, async () => {
  const reservation = createServer();
  await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const child = spawn(process.execPath, [fileURLToPath(new URL('../src/server.mjs', import.meta.url))], {
    env: { ...process.env, PORT: String(port), CORE_BRIDGE_URL: '', CORE_BRIDGE_HMAC_SECRET: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code) => reject(new Error(`local server exited: ${code}`)));
      child.stdout.once('data', resolve);
    });
    const local = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(local.status, 200);
    assert.deepEqual(await local.json(), { status: 'ok', service: 'painel-central-integration-hub', version: '0.1.0' });
    const integrated = await fetch(`http://127.0.0.1:${port}/health/core`);
    assert.equal(integrated.status, 503);
    assert.deepEqual(await integrated.json(), { status: 'degraded', service: 'painel-central-integration-hub', core_bridge: 'unavailable' });
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
  }
});


test('F6-O.2b HMAC Bridge accepts bounded label prepare/commit and rejects forged fields', async () => {
  const received = [];
  const handler = createBridgeHandler({
    getSecret: () => SECRET,
    checkCore: async () => true,
    executeAction: async payload => {
      received.push(payload.action);
      return { status: 200, body: { status: 'ok', action: payload.action } };
    },
  });
  const metadata = {
    channel_account_id: '8a8ad166-0317-4597-8be6-e43fb46b4d1b',
    shop_id: 531736366,
    order_sn: '261013HKHWK3V7',
    package_number: 'OFG245605119132474',
    sha256: 'a'.repeat(64),
    file_size: 1536,
  };
  const send = async payload => {
    const body = JSON.stringify(payload);
    return handler(new Request('https://core.example.test/', {
      method: 'POST',
      headers: buildSignedHeaders({
        secret: SECRET,
        body,
        contentType: 'application/vnd.painel.shopee-live-v1+json',
      }),
      body,
    }));
  };
  assert.equal((await send({ action: 'shopee.shipping_label.prepare', ...metadata })).status, 200);
  assert.equal((await send({ action: 'shopee.shipping_label.commit', ...metadata })).status, 200);
  assert.equal((await send({ action: 'shopee.shipping_label.commit', ...metadata, file_size: 5 * 1024 * 1024 })).status, 400);
  assert.equal((await send({ action: 'shopee.shipping_label.prepare', ...metadata, signed_upload_url: 'evil' })).status, 400);
  assert.deepEqual(received, ['shopee.shipping_label.prepare', 'shopee.shipping_label.commit']);
});


test('F6-O.2e.2c HMAC Core Bridge only accepts exact claim/resolve shapes', async () => {
  const accepted = [];
  const bridge = createBridgeHandler({
    getSecret: () => SECRET,
    checkCore: async () => true,
    executeAction: async payload => {
      accepted.push(payload.action);
      return { status: 200, body: { status: 'ok' } };
    },
  });
  const claim = {
    action: 'shopee.shipping_arrangement.claim',
    channel_account_id: '8a8ad166-0317-4597-8be6-e43fb46b4d1b',
    shop_id: 531736366,
    order_sn: '261014HX0XSUQU',
    package_number: 'OFG245605119132474',
    request_hash: 'a'.repeat(64),
  };
  const resolution = {
    action: 'shopee.shipping_arrangement.resolve',
    attempt_id: '123e4567-e89b-42d3-a456-426614174000',
    request_hash: 'a'.repeat(64),
    outcome: 'uncertain',
  };
  const send = async payload => {
    const body = JSON.stringify(payload);
    return bridge(new Request(CORE_BRIDGE_URL, {
      method: 'POST', body,
      headers: buildSignedHeaders({
        secret: SECRET, body,
        contentType: 'application/vnd.painel.shopee-live-v1+json',
      }),
    }));
  };
  assert.equal((await send(claim)).status, 200);
  assert.equal((await send(resolution)).status, 200);
  for (const bad of [
    { ...claim, shop_id: -1 },
    { ...claim, order_sn: '../unsafe' },
    { ...claim, package_number: null },
    { ...claim, request_hash: 'not-a-sha' },
    { ...claim, force: true },
    { ...resolution, outcome: 'retry' },
    { ...resolution, outcome: 'succeeded', proof: 'fabricated' },
    { ...resolution, attempt_id: 'abc' },
  ]) {
    assert.equal((await send(bad)).status, 400);
  }
  assert.deepEqual(accepted,
    ['shopee.shipping_arrangement.claim', 'shopee.shipping_arrangement.resolve']);
});

test('intake catalog accepts a bounded response over 64 KiB with matching request_id', async () => {
  const answer=await readLiveShopeeOrderIntakeBatch({channel_account_id:'b4027369-5abf-4ac1-ab24-862334fae892',limit:1},{
    url:CORE_BRIDGE_URL,secret:SECRET,logger:quiet,
    fetchImpl:async (_url,request)=>{
      const id=request.headers['X-Integration-Hub-Request-Id'];
      return new Response(JSON.stringify({request_id:id,mappings:[],padding:'x'.repeat(90*1024)}),{
        status:200,headers:{'content-type':'application/json'}});
    },
  });
  assert.equal(answer.ok,true);
  assert.equal(answer.status,200);
});
test('intake catalog above 256 KiB still fails closed',async()=>{
  const answer=await readLiveShopeeOrderIntakeBatch({channel_account_id:'b4027369-5abf-4ac1-ab24-862334fae892',limit:1},{
    url:CORE_BRIDGE_URL,secret:SECRET,logger:quiet,
    fetchImpl:async (_url,request)=>new Response(JSON.stringify({
      request_id:request.headers['X-Integration-Hub-Request-Id'],padding:'x'.repeat(257*1024),
    }),{status:200,headers:{'content-type':'application/json'}}),
  });
  assert.equal(answer.ok,false);
});
test('intake preserves request_id correlation on larger payloads',async()=>{
  const answer=await readLiveShopeeOrderIntakeBatch({channel_account_id:'b4027369-5abf-4ac1-ab24-862334fae892',limit:1},{
    url:CORE_BRIDGE_URL,secret:SECRET,logger:quiet,
    fetchImpl:async()=>new Response(JSON.stringify({request_id:'wrong-id',padding:'x'.repeat(90*1024)}),{
      status:200,headers:{'content-type':'application/json'}}),
  });
  assert.equal(answer.ok,false);
});
