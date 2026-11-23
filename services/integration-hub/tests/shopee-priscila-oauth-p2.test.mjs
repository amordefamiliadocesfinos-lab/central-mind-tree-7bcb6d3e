import assert from 'node:assert/strict';
import test from 'node:test';
import { sha256Hex } from '../src/core-bridge.mjs';
import { createShopeeLiveOauthHandler } from '../src/shopee-live-oauth.mjs';

// Synthetic-only P2 contract: no network access, live authorization, database or real tokens.
const accounts = Object.freeze({
  viviane: { path: '/shopee/live/oauth/start', account: '8a8ad166-0317-4597-8be6-e43fb46b4d1b', shop: 531736366 },
  adao: { path: '/shopee/live/oauth/adao/start', account: 'b4027369-5abf-4ac1-ab24-862334fae892', shop: 1156446003 },
  celivio: { path: '/shopee/live/oauth/celivio/start', account: 'd26c7a30-aa4a-4441-8012-600d70453689', shop: 1357031949 },
  priscila: { path: '/shopee/live/oauth/priscila/start', account: 'f81cb160-badf-4382-863e-b8fd78bdfe7a', shop: 255964662 },
});
const baseEnv = Object.freeze({
  SHOPEE_LIVE_PARTNER_ID: '2047685',
  SHOPEE_LIVE_PARTNER_KEY: 'synthetic-partner-key',
  SHOPEE_LIVE_REDIRECT_URI: 'https://example.invalid/shopee/live/oauth/callback',
  SHOPEE_LIVE_CHANNEL_ACCOUNT_ID: accounts.viviane.account,
  SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY: 'synthetic-encryption-key',
  SHOPEE_LIVE_ADAO_OAUTH_ENABLED: 'true',
  SHOPEE_LIVE_CELIVIO_OAUTH_ENABLED: 'true',
  SHOPEE_LIVE_CELIVIO_SHOP_ID: String(accounts.celivio.shop),
  SHOPEE_LIVE_PRISCILA_OAUTH_ENABLED: 'true',
  SHOPEE_LIVE_PRISCILA_SHOP_ID: String(accounts.priscila.shop),
});
const success = payload => ({ response: { ok: true, status: 200 }, payload, rawText: JSON.stringify(payload) });

function fixture(envOverrides = {}, overrides = {}) {
  let now = 1700000000000;
  let sequence = 0;
  const states = new Map();
  const actions = { create: [], consume: [], exchange: [], refresh: [], read: [], snapshots: [], connections: [] };
  const config = { ...baseEnv, ...envOverrides };
  const handler = createShopeeLiveOauthHandler({
    getEnv: k => config[k],
    now: () => now,
    makeState: () => 'synthetic-nonce-' + (++sequence),
    sign: async () => ({ timestamp: 1700000000, sign: 'synthetic-sign' }),
    createState: async data => {
      actions.create.push(data);
      states.set(data.state_hash, { ...data, used: false });
      return { ok: true };
    },
    consumeState: async ({ state_hash }) => {
      actions.consume.push(state_hash);
      const record = states.get(state_hash);
      if (!record || record.used || Date.parse(record.expires_at) <= now) return { ok: false, status: 409 };
      record.used = true;
      return { ok: true, payload: { channel_account_id: record.channel_account_id } };
    },
    exchange: async data => {
      actions.exchange.push(data);
      return success({ access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', shop_id_list: [data.shopId] });
    },
    refresh: async data => {
      actions.refresh.push(data);
      return success({ access_token: 'synthetic-renewed-access', refresh_token: 'synthetic-renewed-refresh', shop_id_list: [data.shopId] });
    },
    readShop: async data => {
      actions.read.push(data);
      return success({ shop_id: data.shopId, shop_name: 'Synthetic store', status: 'NORMAL' });
    },
    persistSnapshot: async data => {
      actions.snapshots.push(data);
      return { ok: true };
    },
    persistConnection: async data => {
      actions.connections.push(data);
      return { ok: true };
    },
    logger: () => {},
    ...overrides,
  });
  const start = async (key = 'priscila', query = {}) => {
    const response = await handler({ method: 'GET', path: accounts[key].path, query, headers: {} });
    const cookie = response.headers['Set-Cookie']?.split(';')[0];
    return { response, cookie, state: cookie ? decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1)) : null };
  };
  const callback = (cookie, query = { code: 'synthetic-code', shop_id: String(accounts.priscila.shop) }) =>
    handler({ method: 'GET', path: '/shopee/live/oauth/callback', headers: { cookie }, query });
  return { handler, actions, states, start, callback, advance: ms => { now += ms; } };
}
function assertNoWrites(f) {
  assert.equal(f.actions.exchange.length, 0);
  assert.equal(f.actions.refresh.length, 0);
  assert.equal(f.actions.read.length, 0);
  assert.equal(f.actions.snapshots.length, 0);
  assert.equal(f.actions.connections.length, 0);
}

test('Priscila default-OFF start cannot create state or exchange tokens', async () => {
  for (const flags of [{ SHOPEE_LIVE_PRISCILA_OAUTH_ENABLED: undefined }, { SHOPEE_LIVE_PRISCILA_OAUTH_ENABLED: 'false' },
    { SHOPEE_LIVE_PRISCILA_OAUTH_ENABLED: 'true', SHOPEE_LIVE_PRISCILA_SHOP_ID: undefined },
    { SHOPEE_LIVE_PRISCILA_OAUTH_ENABLED: 'true', SHOPEE_LIVE_PRISCILA_SHOP_ID: String(accounts.adao.shop) },
    { SHOPEE_LIVE_PRISCILA_OAUTH_ENABLED: 'true', SHOPEE_LIVE_CELIVIO_SHOP_ID: String(accounts.priscila.shop) }]) {
    const f = fixture(flags);
    assert.equal((await f.start()).response.status, 503);
    assert.equal(f.actions.create.length, 0);
    assertNoWrites(f);
  }
});

test('Priscila synthetic start binds immutable identity and secure 10-minute state', async () => {
  const f = fixture();
  const { response, cookie, state } = await f.start();
  assert.equal(response.status, 302);
  assert.match(state, /^priscila\.synthetic-nonce-1$/);
  assert.match(response.headers['Set-Cookie'], /Path=\/; Max-Age=600; HttpOnly; Secure; SameSite=Lax/);
  assert.equal(f.states.get(sha256Hex(state)).channel_account_id, accounts.priscila.account);
  assert.equal(f.states.get(sha256Hex(state)).expires_at, new Date(1700000600000).toISOString());
  const authorization = new URL(response.headers.Location);
  assert.equal(authorization.origin, 'https://open.shopee.com.br');
  assert.equal(authorization.pathname, '/auth');
  assert.equal(authorization.searchParams.get('partner_id'), '2047685');
  assert.equal(authorization.searchParams.get('auth_type'), 'seller');
  assert.equal(authorization.searchParams.get('redirect_uri'), baseEnv.SHOPEE_LIVE_REDIRECT_URI);
  assert.equal(authorization.searchParams.get('response_type'), 'code');
  assert.equal(authorization.searchParams.get('state'), state);
  assert.match(cookie, /^__Host-pc_shopee_live_state=/);
});

test('Legacy account entrypoints remain on signed partner path, without changing their callback contract', async () => {
  const f = fixture();
  for (const key of ['viviane', 'adao', 'celivio']) {
    const { response, state } = await f.start(key);
    assert.equal(response.status, 302);
    const url = new URL(response.headers.Location);
    assert.equal(url.origin, 'https://partner.shopeemobile.com');
    assert.equal(url.pathname, '/api/v2/shop/auth_partner');
    assert.equal(url.searchParams.get('redirect'), baseEnv.SHOPEE_LIVE_REDIRECT_URI);
    assert.equal(url.searchParams.get('sign'), 'synthetic-sign');
    assert.ok(state);
  }
});

test('Priscila synthetic callback produces isolated encrypted writes and never selects other accounts', async () => {
  const f = fixture();
  for (const key of ['viviane', 'adao', 'celivio', 'priscila']) {
    const { response, cookie } = await f.start(key);
    assert.equal(response.status, 302);
    const result = await f.callback(cookie, { code: 'synthetic-code', shop_id: String(accounts[key].shop) });
    assert.equal(result.status, 200, key);
  }
  assert.deepEqual(f.actions.connections.map(x => x.channel_account_id), Object.values(accounts).flatMap(x => [x.account, x.account]));
  assert.deepEqual(f.actions.snapshots.map(x => x.channel_account_id), Object.values(accounts).flatMap(x => [x.account, x.account]));
  assert.deepEqual(f.actions.connections.map(x => x.shop_id), Object.values(accounts).flatMap(x => [x.shop, x.shop]));
  assert.ok(f.actions.connections.every(x => x.access_token_ciphertext !== 'synthetic-access'));
});

for (const reason of ['expired', 'reused', 'missing-cookie', 'swapped-account', 'wrong-shop', 'public-target', 'state-query', 'unknown-prefix']) {
  test('Priscila rejects ' + reason + ' before exchange or any persistence', async () => {
    const f = fixture();
    const { cookie, state } = await f.start();
    let attemptedCookie = cookie;
    const query = { code: 'synthetic-code', shop_id: String(accounts.priscila.shop) };
    if (reason === 'expired') f.advance(600001);
    if (reason === 'reused') f.states.get(sha256Hex(state)).used = true;
    if (reason === 'missing-cookie') attemptedCookie = '';
    if (reason === 'swapped-account') f.states.get(sha256Hex(state)).channel_account_id = accounts.viviane.account;
    if (reason === 'wrong-shop') query.shop_id = String(accounts.adao.shop);
    if (reason === 'public-target') query.target = 'priscila';
    if (reason === 'state-query') query.state = 'incorrect-query-state';
    if (reason === 'unknown-prefix') attemptedCookie = '__Host-pc_shopee_live_state=unknown.synthetic';
    assert.ok([400, 409].includes((await f.callback(attemptedCookie, query)).status));
    assertNoWrites(f);
  });
}

test('Unknown prefixes are rejected without consuming legacy Viviane state or exchanging a token', async () => {
  const f = fixture();
  assert.equal((await f.callback('__Host-pc_shopee_live_state=unknown.synthetic')).status, 409);
  assert.equal(f.actions.consume.length, 0);
  assertNoWrites(f);
  const legacy = await f.start('viviane');
  assert.match(legacy.state, /^synthetic-nonce-/);
  assert.equal((await f.callback(legacy.cookie, { code: 'synthetic-code', shop_id: String(accounts.viviane.shop) })).status, 200);
});

test('Priscila disabled callback is rejected before consuming an existing synthetic state', async () => {
  const f = fixture({ SHOPEE_LIVE_PRISCILA_OAUTH_ENABLED: 'false' });
  assert.equal((await f.callback('__Host-pc_shopee_live_state=priscila.synthetic')).status, 409);
  assert.equal(f.actions.consume.length, 0);
  assertNoWrites(f);
});

test('Priscila token shop mismatch and scoped shop read mismatch block all writes', async () => {
  for (const injected of [
    { exchange: async () => success({ access_token: 'synthetic', refresh_token: 'synthetic', shop_id_list: [accounts.viviane.shop] }) },
    { readShop: async () => success({ shop_id: accounts.adao.shop }) },
  ]) {
    const f = fixture({}, injected);
    const { cookie } = await f.start();
    assert.equal((await f.callback(cookie)).status, 409);
    assert.equal(f.actions.snapshots.length, 0);
    assert.equal(f.actions.connections.length, 0);
  }
});

test('Priscila never accepts caller-selected account in start or callback', async () => {
  const f = fixture();
  for (const param of ['account', 'target', 'channel_account_id', 'partner_id', 'shop_id']) {
    assert.equal((await f.start('priscila', { [param]: 'synthetic' })).response.status, 400);
  }
  assert.equal(f.actions.create.length, 0);
  const { cookie } = await f.start();
  assert.equal((await f.callback(cookie, { code: 'synthetic', shop_id: String(accounts.priscila.shop), account: 'priscila' })).status, 400);
  assertNoWrites(f);
});

test('Priscila method guard and unmatched paths do not mutate state', async () => {
  const f = fixture();
  assert.equal((await f.handler({ method: 'POST', path: accounts.priscila.path })).status, 405);
  assert.equal(await f.handler({ method: 'GET', path: '/shopee/live/oauth/other/start' }), null);
  assert.equal(f.actions.create.length, 0);
});
