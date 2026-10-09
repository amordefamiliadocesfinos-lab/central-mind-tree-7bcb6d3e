import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import { createShopeeLiveOauthHandler } from '../src/shopee-live-oauth.mjs';

const CONFIG = {
  SHOPEE_LIVE_PARTNER_ID: '244714',
  SHOPEE_LIVE_PARTNER_KEY: 'synthetic-live-partner-key',
  SHOPEE_LIVE_REDIRECT_URI: 'https://integration-hub-oauth.example/shopee/live/oauth/callback',
  SHOPEE_LIVE_CHANNEL_ACCOUNT_ID: '8a8ad166-0317-4597-8be6-e43fb46b4d1b',
  SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY: 'synthetic-token-encryption-key',
};

function env(name) {
  return CONFIG[name];
}

function okResponse(payload) {
  return {
    response: { ok: true, status: 200 },
    payload,
    rawText: JSON.stringify(payload),
  };
}

test('Live start persists one-time state, signs auth_partner and sets secure state cookie', async () => {
  let stateRecord;
  const handler = createShopeeLiveOauthHandler({
    getEnv: env,
    now: () => 1_700_000_000_000,
    makeState: () => 'fixed-state',
    createState: async (data) => { stateRecord = data; return { ok: true, status: 200, payload: {} }; },
    sign: async ({ partnerId, path }) => {
      assert.equal(partnerId, 244714);
      assert.equal(path, '/api/v2/shop/auth_partner');
      return { timestamp: 1700000000, sign: createHmac('sha256', CONFIG.SHOPEE_LIVE_PARTNER_KEY).update('fixture').digest('hex') };
    },
  });

  const response = await handler({ method: 'GET', path: '/shopee/live/oauth/start', headers: {}, query: {} });
  assert.equal(response.status, 302);
  assert.match(response.headers.Location, /^https:\/\/partner\.shopeemobile\.com\/api\/v2\/shop\/auth_partner\?/);
  const url = new URL(response.headers.Location);
  assert.equal(url.searchParams.get('partner_id'), '244714');
  assert.equal(url.searchParams.get('redirect'), CONFIG.SHOPEE_LIVE_REDIRECT_URI);
  assert.equal(url.searchParams.get('timestamp'), '1700000000');
  assert.ok(url.searchParams.get('sign'));
  assert.match(response.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Lax/);
  assert.equal(stateRecord.channel_account_id, CONFIG.SHOPEE_LIVE_CHANNEL_ACCOUNT_ID);
  assert.match(stateRecord.state_hash, /^[0-9a-f]{64}$/);
});

test('Live callback consumes state, performs read-refresh-reread and persists only encrypted tokens', async () => {
  const snapshots = [];
  const connections = [];
  const reads = [];
  let refreshCalls = 0;
  const handler = createShopeeLiveOauthHandler({
    getEnv: env,
    now: (() => {
      let current = 1_700_000_000_000;
      return () => (current += 1000);
    })(),
    consumeState: async () => ({
      ok: true,
      status: 200,
      payload: { channel_account_id: CONFIG.SHOPEE_LIVE_CHANNEL_ACCOUNT_ID },
    }),
    exchange: async (args) => {
      assert.equal(args.apiBaseUrl, 'https://partner.shopeemobile.com');
      assert.equal(args.tokenPath, '/api/v2/auth/token/get');
      assert.equal(args.code, 'auth-code');
      assert.equal(args.shopId, 99887766);
      return okResponse({ access_token: 'raw-access-1', refresh_token: 'raw-refresh-1', expire_in: 14400 });
    },
    readShop: async (args) => {
      reads.push(args.accessToken);
      return okResponse({
        shop_name: 'Viviane',
        region: 'BR',
        status: 'NORMAL',
        merchant_id: 12345,
        expire_time: 1_800_000_000,
        request_id: `req-${reads.length}`,
      });
    },
    persistSnapshot: async (data) => { snapshots.push(data); return { ok: true, status: 200, payload: {} }; },
    persistConnection: async (data) => { connections.push(data); return { ok: true, status: 200, payload: {} }; },
    refresh: async (args) => {
      refreshCalls += 1;
      assert.equal(args.refreshToken, 'raw-refresh-1');
      assert.equal(args.shopId, 99887766);
      return okResponse({ access_token: 'raw-access-2', refresh_token: 'raw-refresh-2', expire_in: 14400 });
    },
  });

  const response = await handler({
    method: 'GET',
    path: '/shopee/live/oauth/callback',
    headers: { cookie: '__Host-pc_shopee_live_state=fixed-state' },
    query: { code: 'auth-code', shop_id: '99887766' },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(reads, ['raw-access-1', 'raw-access-2']);
  assert.equal(refreshCalls, 1);
  assert.equal(snapshots.length, 2);
  assert.equal(connections.length, 2);
  assert.equal(connections[0].channel_account_id, CONFIG.SHOPEE_LIVE_CHANNEL_ACCOUNT_ID);
  assert.notEqual(connections[0].access_token_ciphertext, 'raw-access-1');
  assert.notEqual(connections[0].refresh_token_ciphertext, 'raw-refresh-1');
  assert.notEqual(connections[1].access_token_ciphertext, 'raw-access-2');
  assert.match(connections[1].access_token_ciphertext, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.match(response.body, /Nenhuma projeção em Pedido, Estoque, Financeiro ou CRM/);
  assert.match(response.headers['Set-Cookie'], /Max-Age=0/);
});

test('Live callback fails closed when one-time state is invalid or already consumed', async () => {
  let exchanged = false;
  const handler = createShopeeLiveOauthHandler({
    getEnv: env,
    consumeState: async () => ({ ok: false, status: 409, payload: { error: 'oauth_state_invalid_or_consumed' } }),
    exchange: async () => { exchanged = true; throw new Error('must not execute'); },
  });

  const response = await handler({
    method: 'GET',
    path: '/shopee/live/oauth/callback',
    headers: { cookie: '__Host-pc_shopee_live_state=fixed-state' },
    query: { code: 'auth-code', shop_id: '99887766' },
  });

  assert.equal(response.status, 409);
  assert.equal(exchanged, false);
});

test('Live OAuth routes fail closed when required runtime config is absent', async () => {
  const handler = createShopeeLiveOauthHandler({ getEnv: () => undefined, logger: () => {} });
  const response = await handler({ method: 'GET', path: '/shopee/live/oauth/start', headers: {}, query: {} });
  assert.equal(response.status, 503);
});
