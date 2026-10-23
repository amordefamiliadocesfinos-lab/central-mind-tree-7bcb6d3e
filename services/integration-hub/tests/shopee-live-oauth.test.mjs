import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { sha256Hex } from '../src/core-bridge.mjs';

import { createShopeeLiveOauthHandler } from '../src/shopee-live-oauth.mjs';

const CONFIG = {
  SHOPEE_LIVE_PARTNER_ID: '2047685',
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
      assert.equal(partnerId, 2047685);
      assert.equal(path, '/api/v2/shop/auth_partner');
      return { timestamp: 1700000000, sign: createHmac('sha256', CONFIG.SHOPEE_LIVE_PARTNER_KEY).update('fixture').digest('hex') };
    },
  });

  const response = await handler({ method: 'GET', path: '/shopee/live/oauth/start', headers: {}, query: {} });
  assert.equal(response.status, 302);
  assert.match(response.headers.Location, /^https:\/\/partner\.shopeemobile\.com\/api\/v2\/shop\/auth_partner\?/);
  const url = new URL(response.headers.Location);
  assert.equal(url.searchParams.get('partner_id'), '2047685');
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
      assert.equal(args.shopId, 531736366);
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
      assert.equal(args.shopId, 531736366);
      return okResponse({ access_token: 'raw-access-2', refresh_token: 'raw-refresh-2', expire_in: 14400 });
    },
  });

  const response = await handler({
    method: 'GET',
    path: '/shopee/live/oauth/callback',
    headers: { cookie: '__Host-pc_shopee_live_state=fixed-state' },
    query: { code: 'auth-code', shop_id: '531736366' },
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
    query: { code: 'auth-code', shop_id: '531736366' },
  });

  assert.equal(response.status, 409);
  assert.equal(exchanged, false);
});

test('Live OAuth routes fail closed when required runtime config is absent', async () => {
  const handler = createShopeeLiveOauthHandler({ getEnv: () => undefined, logger: () => {} });
  const response = await handler({ method: 'GET', path: '/shopee/live/oauth/start', headers: {}, query: {} });
  assert.equal(response.status, 503);
});

const ADAO_ACCOUNT = 'b4027369-5abf-4ac1-ab24-862334fae892';
const ADAO_SHOP = 1156446003;
const ADAO_START = '/shopee/live/oauth/adao/start';
const CALLBACK = '/shopee/live/oauth/callback';
const adaoEnv = name => name === 'SHOPEE_LIVE_ADAO_OAUTH_ENABLED' ? 'true' : env(name);

function oauthFixture(overrides = {}) {
  const states = new Map();
  const snapshots = [], connections = [], exchanges = [], reads = [];
  let sequence = 0, currentTime = 1700000000000;
  const handler = createShopeeLiveOauthHandler({
    getEnv: adaoEnv, now: () => currentTime, logger: () => {}, makeState: () => `nonce-${++sequence}`,
    sign: async () => ({ timestamp: 1700000000, sign: 'synthetic-signature' }),
    createState: async data => { states.set(data.state_hash, { ...data, used: false }); return { ok: true }; },
    consumeState: async ({ state_hash }) => {
      const record = states.get(state_hash);
      if (!record || record.used || Date.parse(record.expires_at) <= currentTime) return { ok: false, status: 409 };
      record.used = true;
      return { ok: true, payload: { channel_account_id: record.channel_account_id } };
    },
    exchange: async args => { exchanges.push(args); return okResponse({ access_token: 'raw-access', refresh_token: 'raw-refresh', shop_id_list: [args.shopId] }); },
    refresh: async ({ shopId }) => okResponse({ access_token: 'refreshed-access', refresh_token: 'refreshed-refresh', shop_id_list: [shopId] }),
    readShop: async args => { reads.push(args); return okResponse({ shop_id: args.shopId, region: 'BR', status: 'NORMAL' }); },
    persistSnapshot: async data => { snapshots.push(data); return { ok: true }; },
    persistConnection: async data => { connections.push(data); return { ok: true }; },
    ...overrides,
  });
  const start = async (path = ADAO_START, query = {}) => {
    const response = await handler({ method: 'GET', path, query });
    const cookie = response.headers['Set-Cookie']?.split(';')[0];
    return { response, cookie, state: cookie ? decodeURIComponent(cookie.split('=')[1]) : null };
  };
  const callback = (cookie, query = { code: 'synthetic-code', shop_id: String(ADAO_SHOP) }) => handler({ method: 'GET', path: CALLBACK, headers: { cookie }, query });
  return { handler, start, callback, states, snapshots, connections, exchanges, reads, advance: ms => { currentTime += ms; } };
}

test('Adao start is opt-in, fixes all destination identifiers and preserves official redirect', async () => {
  const disabled = oauthFixture({ getEnv: env });
  assert.equal((await disabled.start()).response.status, 503);
  assert.equal(disabled.states.size, 0);
  const f = oauthFixture();
  const { response, state } = await f.start();
  assert.equal(response.status, 302);
  assert.equal(f.states.get(sha256Hex(state)).channel_account_id, ADAO_ACCOUNT);
  assert.equal(f.states.get(sha256Hex(state)).expires_at, new Date(1700000600000).toISOString());
  const auth = new URL(response.headers.Location);
  assert.equal(auth.searchParams.get('partner_id'), '2047685');
  assert.equal(auth.searchParams.get('redirect'), CONFIG.SHOPEE_LIVE_REDIRECT_URI);
  assert.match(response.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Lax/);
  for (const key of ['channel_account_id', 'shop_id', 'partner_id', 'target']) {
    assert.equal((await f.start(ADAO_START, { [key]: 'arbitrary' })).response.status, 400);
  }
});

test('independent states authorize each fixed shop without replacing Viviane tokens', async () => {
  const f = oauthFixture();
  const viviane = await f.start('/shopee/live/oauth/start');
  const adao = await f.start();
  assert.notEqual(viviane.state, adao.state);
  assert.equal((await f.callback(viviane.cookie, { code: 'v-code', shop_id: '531736366' })).status, 200);
  const before = structuredClone(f.connections);
  assert.equal((await f.callback(adao.cookie)).status, 200);
  assert.deepEqual(f.connections.slice(0, 2), before);
  assert.equal(f.connections.length, 4);
  for (const connection of f.connections.slice(2)) {
    assert.equal(connection.channel_account_id, ADAO_ACCOUNT);
    assert.equal(connection.shop_id, ADAO_SHOP);
    assert.equal(connection.partner_id, 2047685);
    assert.match(connection.access_token_ciphertext, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    assert.notEqual(connection.refresh_token_ciphertext, 'raw-refresh');
  }
  assert.deepEqual(f.snapshots.map(s => s.channel_account_id), [CONFIG.SHOPEE_LIVE_CHANNEL_ACCOUNT_ID, CONFIG.SHOPEE_LIVE_CHANNEL_ACCOUNT_ID, ADAO_ACCOUNT, ADAO_ACCOUNT]);
});

for (const reason of ['expired', 'reused', 'invalid', 'missing-cookie', 'query-state', 'swapped-account', 'wrong-shop', 'public-target']) {
  test(`Adao rejects ${reason} before token exchange or persistence`, async () => {
    const f = oauthFixture();
    const { cookie, state } = await f.start();
    let chosenCookie = cookie;
    const query = { code: 'synthetic-code', shop_id: String(ADAO_SHOP) };
    if (reason === 'expired') f.advance(600001);
    if (reason === 'reused') f.states.get(sha256Hex(state)).used = true;
    if (reason === 'invalid') chosenCookie = '__Host-pc_shopee_live_state=adao.unknown';
    if (reason === 'missing-cookie') chosenCookie = '';
    if (reason === 'query-state') query.state = 'other-browser-state';
    if (reason === 'swapped-account') f.states.get(sha256Hex(state)).channel_account_id = CONFIG.SHOPEE_LIVE_CHANNEL_ACCOUNT_ID;
    if (reason === 'wrong-shop') query.shop_id = '531736366';
    if (reason === 'public-target') query.channel_account_id = ADAO_ACCOUNT;
    assert.ok([400, 409].includes((await f.callback(chosenCookie, query)).status));
    assert.equal(f.exchanges.length, 0);
    assert.equal(f.snapshots.length, 0);
    assert.equal(f.connections.length, 0);
  });
}

for (const payload of [
  { shop_id_list: [ADAO_SHOP, 531736366] }, { shop_id_list: [] },
  { shop_id_list: [ADAO_SHOP, 'invalid'] }, { shop_id_list: 'invalid' },
  { shop_id: 531736366 }, { shop_id_list: [531736366] },
]) {
  test(`Adao rejects inconsistent token identity ${JSON.stringify(payload)}`, async () => {
    const f = oauthFixture({ exchange: async () => okResponse({ access_token: 'synthetic', refresh_token: 'synthetic', ...payload }) });
    const { cookie } = await f.start();
    assert.equal((await f.callback(cookie)).status, 409);
    assert.equal(f.snapshots.length + f.connections.length, 0);
  });
}

test('Adao requires sufficient official identity before the first snapshot or token write', async () => {
  for (const shopInfo of [{}, { shop_id: 531736366 }]) {
    const f = oauthFixture({ exchange: async () => okResponse({ access_token: 'synthetic', refresh_token: 'synthetic' }), readShop: async () => okResponse(shopInfo) });
    const { cookie } = await f.start();
    assert.equal((await f.callback(cookie)).status, 409);
    assert.equal(f.snapshots.length + f.connections.length, 0);
  }
});

test('Adao accepts a matching token identity plus successful scoped shop read without redundant shop_id', async () => {
  const f = oauthFixture({ readShop: async () => okResponse({ region: 'BR', status: 'NORMAL' }) });
  const { cookie } = await f.start();
  assert.equal((await f.callback(cookie)).status, 200);
  assert.equal(f.connections.length, 2);
});

test('main account callback rejects ambiguous selection and accepts only the expected single shop', async () => {
  for (const ids of [[ADAO_SHOP], [ADAO_SHOP, 531736366]]) {
    const f = oauthFixture({ exchange: async () => okResponse({ access_token: 'synthetic', refresh_token: 'synthetic', shop_id_list: ids }) });
    const { cookie } = await f.start();
    assert.equal((await f.callback(cookie, { code: 'synthetic', main_account_id: '123' })).status, ids.length === 1 ? 200 : 409);
    if (ids.length > 1) assert.equal(f.snapshots.length + f.connections.length, 0);
  }
});

test('Core duplicate rejection never falls back to another destination', async () => {
  const calls = [];
  const f = oauthFixture({ persistConnection: async data => { calls.push(data); return { ok: false, status: 409 }; } });
  const { cookie } = await f.start();
  assert.equal((await f.callback(cookie)).status, 503);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].channel_account_id, ADAO_ACCOUNT);
  assert.equal(calls[0].shop_id, ADAO_SHOP);
});

test('original start and shared callback retain routing and method guards', async () => {
  const f = oauthFixture();
  for (const path of ['/shopee/live/oauth/start', ADAO_START, CALLBACK]) {
    assert.equal((await f.handler({ method: 'POST', path })).status, 405);
  }
  assert.equal(await f.handler({ method: 'GET', path: '/shopee/live/oauth/unknown/start' }), null);
});

test('Adao rejects swapped Viviane cookie with Adao callback before exchange', async () => {
  const f = oauthFixture();
  const { cookie } = await f.start('/shopee/live/oauth/start');
  assert.equal((await f.callback(cookie)).status, 409);
  assert.equal(f.exchanges.length + f.snapshots.length + f.connections.length, 0);
});

test('Adao refuses invalid partner configuration and disabled destination at callback', async () => {
  const wrong = oauthFixture({ getEnv: name => name === 'SHOPEE_LIVE_PARTNER_ID' ? '999' : adaoEnv(name) });
  assert.equal((await wrong.start()).response.status, 503);
  const disabled = oauthFixture({ getEnv: env });
  assert.equal((await disabled.callback('__Host-pc_shopee_live_state=adao.nonce')).status, 409);
  assert.equal(disabled.exchanges.length, 0);
});

test('refresh identity mismatch never persists the renewed token or renewed snapshot', async () => {
  for (const mismatch of ['token', 'read', 'absent']) {
    let reads = 0;
    const f = oauthFixture({
      refresh: async () => okResponse({ access_token: 'bad-renewed', refresh_token: 'bad-renewed', ...(mismatch === 'token' ? { shop_id: 531736366 } : mismatch === 'read' ? { shop_id: ADAO_SHOP } : {}) }),
      readShop: async () => { reads++; return okResponse(reads === 1 ? { shop_id: ADAO_SHOP } : mismatch === 'read' ? { shop_id: 531736366 } : {}); },
    });
    const { cookie } = await f.start();
    assert.equal((await f.callback(cookie)).status, 409);
    assert.equal(f.connections.length, 1);
    assert.equal(f.snapshots.length, 1);
    assert.equal(f.connections[0].channel_account_id, ADAO_ACCOUNT);
  }
});
