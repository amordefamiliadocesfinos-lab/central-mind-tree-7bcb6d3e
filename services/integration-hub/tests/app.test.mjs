import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, routeRequest } from '../src/app.mjs';
import { defineConnectorDescriptor } from '../src/contracts.mjs';

test('GET /health exposes only minimal runtime metadata', () => {
  const response = routeRequest({ method: 'GET', path: '/health' });
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), {
    status: 'ok',
    service: 'painel-central-integration-hub',
    version: '0.1.0',
  });
});

test('health endpoint rejects unsupported methods', () => {
  const response = routeRequest({ method: 'POST', path: '/health' });
  assert.equal(response.status, 405);
  assert.deepEqual(JSON.parse(response.body), { error: 'method_not_allowed' });
});

test('unknown routes fail closed', () => {
  const response = routeRequest({ method: 'GET', path: '/unknown' });
  assert.equal(response.status, 404);
  assert.deepEqual(JSON.parse(response.body), { error: 'route_not_found' });
});

test('connector descriptor is provider-agnostic and capability constrained', () => {
  const descriptor = defineConnectorDescriptor({
    provider: 'example-provider',
    environment: 'sandbox',
    capabilities: ['health', 'pull', 'health'],
  });

  assert.deepEqual(descriptor, {
    provider: 'example-provider',
    environment: 'sandbox',
    capabilities: ['health', 'pull'],
  });

  assert.throws(
    () => defineConnectorDescriptor({ provider: 'x', environment: 'live', capabilities: ['database-admin'] }),
    /unsupported connector capability/,
  );
});


test('authorized Shopee Live OAuth paths are delegated without exposing new generic routes', async () => {
  const response = await handleRequest(
    { method: 'GET', path: '/shopee/live/oauth/start', query: {}, headers: {} },
    {
      handleShopeeLive: async (request) => request.path === '/shopee/live/oauth/start'
        ? { status: 302, headers: { Location: 'https://partner.shopeemobile.com/' }, body: '' }
        : null,
      probeCore: async () => true,
    },
  );

  assert.equal(response.status, 302);
  assert.equal(response.headers.Location, 'https://partner.shopeemobile.com/');
});


test('private Shopee intake preview route is POST-only and hard-wires preview mode', async () => {
  let observed;
  const response = await handleRequest(
    {
      method: 'POST',
      path: '/internal/shopee/live/orders/intake/preview',
      query: {},
      headers: {},
    },
    {
      handleShopeeLive: async () => null,
      getEnv: (name) => name === 'SHOPEE_LIVE_CHANNEL_ACCOUNT_ID' ? 'account-123' : undefined,
      runShopeePreview: async (input) => {
        observed = input;
        return {
          ok: true,
          marketplaceAccount: 'SHOPEE VIVIANE',
          selected: 2,
          ready: 2,
          blocked: 0,
          written: 0,
          sourceCounts: {
            selected: 2,
            skipped_existing: 1,
            skipped_status: 0,
            skipped_malformed: 0,
          },
          results: [
            { orderSn: 'A', status: 'ready', blockers: [], write: { forbidden: true } },
            { orderSn: 'B', status: 'ready', blockers: [], write: null },
          ],
        };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(observed, {
    channelAccountId: 'account-123',
    limit: 5,
    mode: 'preview',
  });
  assert.deepEqual(JSON.parse(response.body), {
    status: 'ok',
    mode: 'preview',
    marketplaceAccount: 'SHOPEE VIVIANE',
    selected: 2,
    ready: 2,
    blocked: 0,
    written: 0,
    sourceCounts: {
      selected: 2,
      skipped_existing: 1,
      skipped_status: 0,
      skipped_malformed: 0,
    },
    results: [
      { orderSn: 'A', status: 'ready', blockers: [] },
      { orderSn: 'B', status: 'ready', blockers: [] },
    ],
  });

  const getResponse = await handleRequest(
    { method: 'GET', path: '/internal/shopee/live/orders/intake/preview', query: {}, headers: {} },
    {
      handleShopeeLive: async () => null,
      getEnv: () => 'account-123',
      runShopeePreview: async () => {
        throw new Error('must not run');
      },
    },
  );
  assert.equal(getResponse.status, 405);
});

test('private Shopee intake preview route fails closed when runtime account is missing', async () => {
  let calls = 0;
  const response = await handleRequest(
    { method: 'POST', path: '/internal/shopee/live/orders/intake/preview', query: {}, headers: {} },
    {
      handleShopeeLive: async () => null,
      getEnv: () => undefined,
      runShopeePreview: async () => {
        calls += 1;
        return { ok: true };
      },
    },
  );

  assert.equal(response.status, 503);
  assert.deepEqual(JSON.parse(response.body), { error: 'runtime_not_configured' });
  assert.equal(calls, 0);
});

test('private Shopee intake preview route sanitizes failures and never exposes writer payloads', async () => {
  const response = await handleRequest(
    { method: 'POST', path: '/internal/shopee/live/orders/intake/preview', query: {}, headers: {} },
    {
      handleShopeeLive: async () => null,
      getEnv: () => 'account-123',
      runShopeePreview: async () => ({
        ok: false,
        selected: 3,
        ready: 0,
        blocked: 3,
        written: 9,
        payload: { secret: 'forbidden' },
      }),
    },
  );

  assert.equal(response.status, 503);
  assert.deepEqual(JSON.parse(response.body), {
    status: 'degraded',
    mode: 'preview',
    selected: 3,
    ready: 0,
    blocked: 3,
    written: 0,
    results: [],
  });
});


test('F6-K commit-one route is disabled unless all server-side guards are present', async () => {
  let calls = 0;
  const response = await handleRequest(
    { method: 'POST', path: '/internal/shopee/live/orders/intake/commit-one', query: {}, headers: {} },
    {
      handleShopeeLive: async () => null,
      getEnv: (name) => {
        if (name === 'SHOPEE_LIVE_CHANNEL_ACCOUNT_ID') return 'account-123';
        if (name === 'SHOPEE_LIVE_COMMIT_ORDER_SN') return 'ORDER-1';
        return undefined;
      },
      runShopeeCommit: async () => {
        calls += 1;
        return { ok: true };
      },
    },
  );

  assert.equal(response.status, 503);
  assert.deepEqual(JSON.parse(response.body), { error: 'commit_not_enabled' });
  assert.equal(calls, 0);
});

test('F6-K commit-one route hard-wires one exact server-side target and commit mode', async () => {
  let observed;
  const response = await handleRequest(
    { method: 'POST', path: '/internal/shopee/live/orders/intake/commit-one', query: {}, headers: {} },
    {
      handleShopeeLive: async () => null,
      getEnv: (name) => ({
        SHOPEE_LIVE_CHANNEL_ACCOUNT_ID: 'account-123',
        SHOPEE_LIVE_COMMIT_ORDER_SN: 'ORDER-1',
        SHOPEE_LIVE_COMMIT_ENABLED: 'true',
      })[name],
      runShopeeCommit: async (input) => {
        observed = input;
        return {
          ok: true,
          selected: 1,
          ready: 1,
          blocked: 0,
          written: 1,
          results: [{
            orderSn: 'ORDER-1',
            status: 'written',
            blockers: [],
            write: {
              alreadyRegistered: false,
              orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              separationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              forbidden: 'do-not-forward',
            },
          }],
        };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(observed, {
    channelAccountId: 'account-123',
    limit: 5,
    mode: 'commit',
    expectedOrderSn: 'ORDER-1',
  });
  assert.deepEqual(JSON.parse(response.body), {
    status: 'ok',
    mode: 'commit',
    targetOrderSn: 'ORDER-1',
    selected: 1,
    ready: 1,
    blocked: 0,
    written: 1,
    result: {
      orderSn: 'ORDER-1',
      status: 'written',
      alreadyRegistered: false,
      orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      separationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    },
  });
});

test('F6-K commit-one route rejects query controls before executor runs', async () => {
  let calls = 0;
  const response = await handleRequest(
    {
      method: 'POST',
      path: '/internal/shopee/live/orders/intake/commit-one',
      query: { orderSn: 'attacker-controlled' },
      headers: {},
    },
    {
      handleShopeeLive: async () => null,
      getEnv: () => 'true',
      runShopeeCommit: async () => {
        calls += 1;
        return { ok: true };
      },
    },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(JSON.parse(response.body), { error: 'query_not_allowed' });
  assert.equal(calls, 0);
});

test('F6-K commit-one route fails closed when executor returns the wrong target or shape', async () => {
  const response = await handleRequest(
    { method: 'POST', path: '/internal/shopee/live/orders/intake/commit-one', query: {}, headers: {} },
    {
      handleShopeeLive: async () => null,
      getEnv: (name) => ({
        SHOPEE_LIVE_CHANNEL_ACCOUNT_ID: 'account-123',
        SHOPEE_LIVE_COMMIT_ORDER_SN: 'ORDER-1',
        SHOPEE_LIVE_COMMIT_ENABLED: 'true',
      })[name],
      runShopeeCommit: async () => ({
        ok: true,
        selected: 1,
        ready: 1,
        blocked: 0,
        written: 1,
        results: [{
          orderSn: 'ORDER-2',
          status: 'written',
          blockers: [],
          write: { alreadyRegistered: false },
        }],
      }),
    },
  );

  assert.equal(response.status, 409);
  const body = JSON.parse(response.body);
  assert.equal(body.status, 'blocked');
  assert.equal(body.targetOrderSn, 'ORDER-1');
  assert.equal(body.result.orderSn, 'ORDER-2');
});

test('F6-K commit-one route accepts idempotent already-registered replay with zero new writes', async () => {
  const response = await handleRequest(
    { method: 'POST', path: '/internal/shopee/live/orders/intake/commit-one', query: {}, headers: {} },
    {
      handleShopeeLive: async () => null,
      getEnv: (name) => ({
        SHOPEE_LIVE_CHANNEL_ACCOUNT_ID: 'account-123',
        SHOPEE_LIVE_COMMIT_ORDER_SN: 'ORDER-1',
        SHOPEE_LIVE_COMMIT_ENABLED: 'TRUE',
      })[name],
      runShopeeCommit: async () => ({
        ok: true,
        selected: 1,
        ready: 1,
        blocked: 0,
        written: 0,
        results: [{
          orderSn: 'ORDER-1',
          status: 'already_registered',
          blockers: [],
          write: {
            alreadyRegistered: true,
            orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            separationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          },
        }],
      }),
    },
  );

  assert.equal(response.status, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.written, 0);
  assert.equal(body.result.status, 'already_registered');
  assert.equal(body.result.alreadyRegistered, true);
});
