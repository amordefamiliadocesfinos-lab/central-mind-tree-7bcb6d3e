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
