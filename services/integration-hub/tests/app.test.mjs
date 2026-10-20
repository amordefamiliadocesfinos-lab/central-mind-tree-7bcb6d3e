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


test('F6-L recurring intake route is disabled by default', async () => {
  let calls = 0;
  const response = await handleRequest(
    { method: 'POST', path: '/internal/shopee/live/orders/intake/run', query: {}, headers: {} },
    {
      handleShopeeLive: async () => null,
      getEnv: (name) => name === 'SHOPEE_LIVE_CHANNEL_ACCOUNT_ID' ? 'account-123' : undefined,
      runShopeeCommit: async () => {
        calls += 1;
        return { ok: true };
      },
      logEvent: () => {},
    },
  );

  assert.equal(response.status, 503);
  assert.deepEqual(JSON.parse(response.body), { error: 'auto_commit_not_enabled' });
  assert.equal(calls, 0);
});

test('F6-L recurring intake route rejects query controls', async () => {
  let calls = 0;
  const response = await handleRequest(
    {
      method: 'POST',
      path: '/internal/shopee/live/orders/intake/run',
      query: { limit: '20' },
      headers: {},
    },
    {
      handleShopeeLive: async () => null,
      getEnv: () => 'true',
      runShopeeCommit: async () => {
        calls += 1;
        return { ok: true };
      },
      logEvent: () => {},
    },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(JSON.parse(response.body), { error: 'query_not_allowed' });
  assert.equal(calls, 0);
});

test('F6-L recurring intake route uses frozen policy and emits sanitized round audit', async () => {
  let observed;
  const logs = [];
  let tick = 0;

  const response = await handleRequest(
    { method: 'POST', path: '/internal/shopee/live/orders/intake/run', query: {}, headers: {} },
    {
      handleShopeeLive: async () => null,
      getEnv: (name) => ({
        SHOPEE_LIVE_CHANNEL_ACCOUNT_ID: 'account-123',
        SHOPEE_LIVE_AUTO_COMMIT_ENABLED: 'true',
      })[name],
      makeRunId: () => 'run-1',
      now: () => (++tick === 1 ? '2026-10-14T10:00:00.000Z' : '2026-10-14T10:00:01.000Z'),
      logEvent: (event) => logs.push(event),
      runShopeeCommit: async (input) => {
        observed = input;
        return {
          ok: true,
          selected: 2,
          ready: 2,
          blocked: 0,
          written: 1,
          roundStopped: false,
          stopReason: null,
          results: [
            {
              orderSn: 'ORDER-1',
              status: 'written',
              blockers: [],
              write: { alreadyRegistered: false, secret: 'do-not-log' },
            },
            {
              orderSn: 'ORDER-2',
              status: 'already_registered',
              blockers: [],
              write: { alreadyRegistered: true, secret: 'do-not-log' },
            },
          ],
        };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(observed, {
    channelAccountId: 'account-123',
    limit: 5,
    mode: 'commit',
  });

  const body = JSON.parse(response.body);
  assert.equal(body.status, 'ok');
  assert.equal(body.runId, 'run-1');
  assert.equal(body.selected, 2);
  assert.equal(body.ready, 2);
  assert.equal(body.written, 1);
  assert.equal(body.success, 2);
  assert.equal(body.retryable, 0);
  assert.deepEqual(body.results, [
    { orderSn: 'ORDER-1', status: 'written', blockers: [], alreadyRegistered: false },
    { orderSn: 'ORDER-2', status: 'already_registered', blockers: [], alreadyRegistered: true },
  ]);

  assert.equal(logs.length, 1);
  assert.deepEqual(logs[0], {
    event: 'shopee_intake_round',
    runId: 'run-1',
    startedAt: '2026-10-14T10:00:00.000Z',
    finishedAt: '2026-10-14T10:00:01.000Z',
    channelAccountId: 'account-123',
    ok: true,
    roundStopped: false,
    stopReason: null,
    summary: {
      selected: 2,
      ready: 2,
      blocked: 0,
      written: 1,
      success: 2,
      retryable: 0,
      unknown: 0,
      statuses: { written: 1, already_registered: 1 },
    },
  });
});

test('F6-L recurring intake route returns 503 when policy stops the round', async () => {
  const logs = [];
  const response = await handleRequest(
    { method: 'POST', path: '/internal/shopee/live/orders/intake/run', query: {}, headers: {} },
    {
      handleShopeeLive: async () => null,
      getEnv: (name) => ({
        SHOPEE_LIVE_CHANNEL_ACCOUNT_ID: 'account-123',
        SHOPEE_LIVE_AUTO_COMMIT_ENABLED: 'TRUE',
      })[name],
      makeRunId: () => 'run-stop',
      now: () => '2026-10-14T10:00:00.000Z',
      logEvent: (event) => logs.push(event),
      runShopeeCommit: async () => ({
        ok: true,
        selected: 2,
        ready: 1,
        blocked: 0,
        written: 0,
        roundStopped: true,
        stopReason: 'writer_exception',
        results: [{
          orderSn: 'ORDER-1',
          status: 'write_failed',
          blockers: ['writer_exception'],
          write: null,
        }],
      }),
    },
  );

  assert.equal(response.status, 503);
  const body = JSON.parse(response.body);
  assert.equal(body.status, 'degraded');
  assert.equal(body.roundStopped, true);
  assert.equal(body.stopReason, 'writer_exception');
  assert.equal(body.retryable, 1);
  assert.equal(logs.length, 1);
});

test('F6-L recurring intake route reports business blockers without infrastructure retry', async () => {
  const response = await handleRequest(
    { method: 'POST', path: '/internal/shopee/live/orders/intake/run', query: {}, headers: {} },
    {
      handleShopeeLive: async () => null,
      getEnv: (name) => ({
        SHOPEE_LIVE_CHANNEL_ACCOUNT_ID: 'account-123',
        SHOPEE_LIVE_AUTO_COMMIT_ENABLED: 'true',
      })[name],
      makeRunId: () => 'run-attention',
      now: () => '2026-10-14T10:00:00.000Z',
      logEvent: () => {},
      runShopeeCommit: async () => ({
        ok: true,
        selected: 2,
        ready: 1,
        blocked: 1,
        written: 1,
        roundStopped: false,
        stopReason: null,
        results: [
          { orderSn: 'ORDER-1', status: 'written', blockers: [], write: { alreadyRegistered: false } },
          { orderSn: 'ORDER-2', status: 'blocked', blockers: ['mapping_needs_mapping'], write: null },
        ],
      }),
    },
  );

  assert.equal(response.status, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.status, 'attention');
  assert.equal(body.blocked, 1);
  assert.equal(body.written, 1);
});


test('F6-O.1b private logistics inspect route uses only server-side order target', async () => {
  let observed;
  const response = await handleRequest(
    { method: 'POST', path: '/internal/shopee/live/logistics/inspect', query: {}, headers: {} },
    {
      handleShopeeLive: async () => null,
      getEnv: (name) => name === 'SHOPEE_LIVE_LOGISTICS_PROBE_ORDER_SN' ? '261013HKHWK3V7' : undefined,
      inspectShopeeLogistics: async (input) => {
        observed = input;
        return {
          ok: true,
          order: {
            order_sn: '261013HKHWK3V7',
            order_status: 'PROCESSED',
            shipping_carrier: 'SPX',
            package_number: 'PKG-1',
            package_logistics_status: 'LOGISTICS_READY',
            invoice_status: 'valid',
            invoice_pending_reason: null,
          },
          shipping_parameter: {
            ok: true,
            error: null,
            info_needed: { pickup: ['address_id', 'pickup_time_id'] },
          },
          shipping_document_parameter: {
            ok: true,
            error: null,
            results: [{
              order_sn: '261013HKHWK3V7',
              package_number: 'PKG-1',
              suggested_shipping_document_type: 'NORMAL_AIR_WAYBILL',
              selectable_shipping_document_type: ['NORMAL_AIR_WAYBILL'],
            }],
          },
        };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(observed, { orderSn: '261013HKHWK3V7' });
  const body = JSON.parse(response.body);
  assert.equal(body.mode, 'read_only');
  assert.equal(body.order.order_sn, '261013HKHWK3V7');
  assert.equal(body.order.package_logistics_status, 'LOGISTICS_READY');
  assert.deepEqual(body.shipping_parameter.info_needed, {
    pickup: ['address_id', 'pickup_time_id'],
  });
  assert.equal(body.shipping_document_parameter.results[0].suggested_shipping_document_type, 'NORMAL_AIR_WAYBILL');
});

test('F6-O.1b logistics inspect route rejects caller-controlled query and missing target', async () => {
  let calls = 0;
  const queryResponse = await handleRequest(
    {
      method: 'POST',
      path: '/internal/shopee/live/logistics/inspect',
      query: { orderSn: 'attacker-controlled' },
      headers: {},
    },
    {
      handleShopeeLive: async () => null,
      getEnv: () => '261013HKHWK3V7',
      inspectShopeeLogistics: async () => {
        calls += 1;
        return { ok: true };
      },
    },
  );
  assert.equal(queryResponse.status, 400);
  assert.deepEqual(JSON.parse(queryResponse.body), { error: 'query_not_allowed' });

  const missingResponse = await handleRequest(
    { method: 'POST', path: '/internal/shopee/live/logistics/inspect', query: {}, headers: {} },
    {
      handleShopeeLive: async () => null,
      getEnv: () => undefined,
      inspectShopeeLogistics: async () => {
        calls += 1;
        return { ok: true };
      },
    },
  );
  assert.equal(missingResponse.status, 503);
  assert.deepEqual(JSON.parse(missingResponse.body), { error: 'logistics_probe_not_configured' });
  assert.equal(calls, 0);
});

test('F6-O.1b logistics inspect route sanitizes upstream failure', async () => {
  const response = await handleRequest(
    { method: 'POST', path: '/internal/shopee/live/logistics/inspect', query: {}, headers: {} },
    {
      handleShopeeLive: async () => null,
      getEnv: () => '261013HKHWK3V7',
      inspectShopeeLogistics: async () => ({
        ok: false,
        code: 'order_detail_rejected',
        payload: { secret: 'must-not-leak' },
      }),
    },
  );

  assert.equal(response.status, 503);
  assert.deepEqual(JSON.parse(response.body), {
    status: 'degraded',
    mode: 'read_only',
    orderSn: '261013HKHWK3V7',
    code: 'order_detail_rejected',
  });
});


test('F6-O.1R OAuth refresh-once route is disabled by default', async () => {
  let calls = 0;
  const response = await handleRequest(
    { method: 'POST', path: '/internal/shopee/live/oauth/refresh-once', query: {}, headers: {} },
    {
      handleShopeeLive: async () => null,
      getEnv: () => undefined,
      refreshShopeeOauth: async () => {
        calls += 1;
        return { ok: true };
      },
    },
  );

  assert.equal(response.status, 503);
  assert.deepEqual(JSON.parse(response.body), { error: 'oauth_refresh_not_enabled' });
  assert.equal(calls, 0);
});

test('F6-O.1R OAuth refresh-once route rejects caller-controlled query', async () => {
  let calls = 0;
  const response = await handleRequest(
    {
      method: 'POST',
      path: '/internal/shopee/live/oauth/refresh-once',
      query: { shopId: 'attacker-controlled' },
      headers: {},
    },
    {
      handleShopeeLive: async () => null,
      getEnv: () => 'true',
      refreshShopeeOauth: async () => {
        calls += 1;
        return { ok: true };
      },
    },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(JSON.parse(response.body), { error: 'query_not_allowed' });
  assert.equal(calls, 0);
});

test('F6-O.1R OAuth refresh-once route exposes only sanitized metadata', async () => {
  let calls = 0;
  const response = await handleRequest(
    { method: 'POST', path: '/internal/shopee/live/oauth/refresh-once', query: {}, headers: {} },
    {
      handleShopeeLive: async () => null,
      getEnv: (name) => name === 'SHOPEE_LIVE_OAUTH_REFRESH_ENABLED' ? 'TRUE' : undefined,
      refreshShopeeOauth: async () => {
        calls += 1;
        return {
          ok: true,
          code: 'oauth_refreshed',
          before: {
            channel_account_id: 'account-1',
            partner_id: 2047685,
            shop_id: 531736366,
            access_token_expires_at: 'before-access',
            refresh_token_expires_at: 'before-refresh',
            last_refreshed_at: 'before-last',
          },
          after: {
            channel_account_id: 'account-1',
            partner_id: 2047685,
            shop_id: 531736366,
            access_token_expires_at: 'after-access',
            refresh_token_expires_at: 'after-refresh',
            last_refreshed_at: 'after-last',
          },
          secret: 'must-not-leak',
        };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  const body = JSON.parse(response.body);
  assert.equal(body.status, 'ok');
  assert.equal(body.mode, 'oauth_refresh_once');
  assert.equal(body.code, 'oauth_refreshed');
  assert.equal(body.before.shop_id, 531736366);
  assert.equal(body.after.shop_id, 531736366);
  assert.equal(Object.hasOwn(body, 'secret'), false);
});

test('F6-O.1R OAuth refresh-once route reports expired refresh token without token data', async () => {
  const response = await handleRequest(
    { method: 'POST', path: '/internal/shopee/live/oauth/refresh-once', query: {}, headers: {} },
    {
      handleShopeeLive: async () => null,
      getEnv: (name) => name === 'SHOPEE_LIVE_OAUTH_REFRESH_ENABLED' ? 'true' : undefined,
      refreshShopeeOauth: async () => ({
        ok: false,
        code: 'refresh_token_expired',
        before: {
          channel_account_id: 'account-1',
          partner_id: 2047685,
          shop_id: 531736366,
          access_token_expires_at: 'expired',
          refresh_token_expires_at: 'expired',
          last_refreshed_at: null,
        },
        access_token: 'must-not-leak',
      }),
    },
  );

  assert.equal(response.status, 503);
  const body = JSON.parse(response.body);
  assert.equal(body.code, 'refresh_token_expired');
  assert.equal(body.mode, 'oauth_refresh_once');
  assert.equal(Object.hasOwn(body, 'access_token'), false);
});
