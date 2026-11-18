import assert from 'node:assert/strict';
import test from 'node:test';
import { createShopeeLiveOauthHandler } from '../src/shopee-live-oauth.mjs';
import { sha256Hex } from '../src/core-bridge.mjs';

const acct = 'd26c7a30-aa4a-4441-8012-600d70453689';
const actor = '11111111-1111-4111-8111-111111111111';
const shop = 1357031949;
const cookie = '__Host-pc_shopee_live_state=universal.synthetic';
const env = key => ({
  SHOPEE_LIVE_PARTNER_ID: '2047685',
  SHOPEE_LIVE_PARTNER_KEY: 'synthetic-partner-key',
  SHOPEE_LIVE_REDIRECT_URI: 'https://example.org/shopee/live/oauth/callback',
  SHOPEE_LIVE_CHANNEL_ACCOUNT_ID: '8a8ad166-0317-4597-8be6-e43fb46b4d1b',
  SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY: 'synthetic-strong-token-encryption-key',
  SHOPEE_OAUTH_UNIVERSAL_CALLBACK_ENABLED: 'true',
})[key];
const result = payload => ({
  response: { ok: true, status: 200 },
  payload, rawText: JSON.stringify(payload),
});
function setup(overrides = {}) {
  const calls = { exchange: 0, snapshot: 0, connection: [] };
  const deps = {
    getEnv: env,
    now: () => 1_795_000_000_000,
    consumeState: async ({ state_hash }) => {
      assert.equal(state_hash, sha256Hex('universal.synthetic'));
      return { ok: true, payload: { channel_account_id: acct } };
    },
    resolveUniversalState: async () => ({ ok: true, payload: {
      auth_user_id: actor, channel_account_id: acct, partner_id: 2047685, shop_id: shop,
    } }),
    exchange: async () => { calls.exchange++; return result({
      access_token: 'access-one', refresh_token: 'refresh-one',
      shop_id: shop, expire_in: 14400,
    }); },
    readShop: async () => result({ shop_id: shop, shop_name: 'Approved Test Seller', region: 'BR' }),
    persistSnapshot: async () => { calls.snapshot++; return { ok: true }; },
    persistConnection: async input => {
      calls.connection.push(input);
      return { ok: true };
    },
    refresh: async () => result({ access_token: 'access-two', refresh_token: 'refresh-two',
      shop_id: shop, expire_in: 14400 }),
    ...overrides,
  };
  const handler = createShopeeLiveOauthHandler(deps);
  const request = (shop_id = String(shop)) => ({
    method: 'GET', path: '/shopee/live/oauth/callback',
    headers: { cookie }, query: { code: 'synthetic-code', shop_id },
  });
  return { handler, request, calls };
}

test('authorized universal state resolves approved shop and stores only encrypted tokens', async () => {
  const { handler, request, calls } = setup();
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.equal(calls.exchange, 1);
  assert.equal(calls.snapshot, 2);
  assert.equal(calls.connection.length, 2);
  for (const row of calls.connection) {
    assert.equal(row.channel_account_id, acct);
    assert.equal(row.shop_id, shop);
    assert.notEqual(row.access_token_ciphertext, 'access-one');
    assert.notEqual(row.refresh_token_ciphertext, 'refresh-one');
  }
});

test('universal state rejects wrong callback shop before token exchange', async () => {
  const { handler, request, calls } = setup();
  assert.equal((await handler(request('531736366'))).status, 409);
  assert.equal(calls.exchange, 0);
});

test('universal state rejects different Core account and missing binding', async () => {
  for (const resolveUniversalState of [
    async () => ({ ok: true, payload: {
      auth_user_id: actor, channel_account_id: 'b4027369-5abf-4ac1-ab24-862334fae892',
      partner_id: 2047685, shop_id: shop,
    } }),
    async () => ({ ok: false, status: 409 }),
    async () => ({ ok: true, payload: {
      auth_user_id: actor, channel_account_id: acct,
      partner_id: 900, shop_id: shop,
    } }),
  ]) {
    const { handler, request, calls } = setup({ resolveUniversalState });
    assert.equal((await handler(request())).status, 409);
    assert.equal(calls.exchange, 0);
  }
});

test('universal state is disabled unless callback gate explicitly true', async () => {
  const { handler, request, calls } = setup({ getEnv: key =>
    key === 'SHOPEE_OAUTH_UNIVERSAL_CALLBACK_ENABLED' ? undefined : env(key) });
  assert.equal((await handler(request())).status, 503);
  assert.equal(calls.exchange, 0);
});

test('replayed/expired state cannot resolve or exchange tokens', async () => {
  let resolved = false;
  const { handler, request, calls } = setup({
    consumeState: async () => ({ ok: false, status: 409 }),
    resolveUniversalState: async () => { resolved = true; throw Error('must not resolve'); },
  });
  assert.equal((await handler(request())).status, 409);
  assert.equal(resolved, false);
  assert.equal(calls.exchange, 0);
});

test('shop_info mismatch and refreshed token shop mismatch fail closed', async () => {
  for (const overrides of [
    { readShop: async () => result({ shop_id: 531736366 }) },
    { refresh: async () => result({ access_token: 'x', refresh_token: 'y', shop_id: 531736366 }) },
  ]) {
    const { handler, request, calls } = setup(overrides);
    assert.equal((await handler(request())).status, 409);
    assert.ok(calls.connection.length <= 1);
  }
});
