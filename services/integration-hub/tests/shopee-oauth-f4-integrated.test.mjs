import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createUniversalShopeeStartHandler } from '../src/shopee-oauth-universal-start.mjs';
import { createShopeeLiveOauthHandler } from '../src/shopee-live-oauth.mjs';

const ACCOUNT = 'd26c7a30-aa4a-4441-8012-600d70453689';
const ACTOR = '11111111-1111-4111-8111-111111111111';
const SHOP = 1357031949;
const PARTNER = 2047685;
const CALLBACK = 'https://integration-hub-oauth-bh4c23q1.ue.gateway.dev/shopee/live/oauth/callback';
const TICKET = 'A'.repeat(43);
const digest = x => createHash('sha256').update(x).digest('hex');

function fixture({ expectedShop = SHOP, boundAccount = ACCOUNT, callbackEnabled = true, revokeAfterStart = false } = {}) {
  const states = new Map();
  const saves = [];
  const calls = { consumedTickets: 0, consumedStates: 0, exchanges: 0, reads: 0 };
  const env = n => ({
    SHOPEE_OAUTH_UNIVERSAL_START_ENABLED: 'true',
    SHOPEE_OAUTH_UNIVERSAL_CALLBACK_ENABLED: callbackEnabled ? 'true' : 'false',
    SHOPEE_LIVE_PARTNER_ID: String(PARTNER),
    SHOPEE_LIVE_PARTNER_KEY: 'synthetic-partner-key',
    SHOPEE_LIVE_REDIRECT_URI: CALLBACK,
    SHOPEE_LIVE_CHANNEL_ACCOUNT_ID: '8a8ad166-0317-4597-8be6-e43fb46b4d1b',
    SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY: 'synthetic-encryption-key',
    SHOPEE_LIVE_CELIVIO_OAUTH_ENABLED: 'false',
  })[n];
  const start = createUniversalShopeeStartHandler({
    getEnv: env, makeState: () => 'synthetic-state',
    now: () => 1795000000000,
    consumeHandoff: async ({ ticket_hash }) => {
      assert.equal(ticket_hash, digest(TICKET));
      calls.consumedTickets++;
      return calls.consumedTickets === 1
        ? { ok: true, payload: {
          auth_user_id: ACTOR, channel_account_id: boundAccount,
          partner_id: PARTNER, shop_id: expectedShop,
        } } : { ok: false, status: 409 };
    },
    createState: async record => {
      states.set(record.state_hash, { ...record, used: false });
      return { ok: true };
    },
    sign: async () => ({ timestamp: 1795000000, sign: 'a'.repeat(64) }),
  });
  const callback = createShopeeLiveOauthHandler({
    getEnv: env, now: () => 1795000000000,
    consumeState: async ({ state_hash }) => {
      const state = states.get(state_hash);
      if (!state || state.used) return { ok: false, status: 409 };
      state.used = true;
      calls.consumedStates++;
      return { ok: true, payload: { channel_account_id: state.channel_account_id } };
    },
    resolveUniversalState: async ({ state_hash }) => {
      const state = states.get(state_hash);
      if (!state?.used || revokeAfterStart) return { ok: false, status: 409 };
      return { ok: true, payload: {
        auth_user_id: state.auth_user_id,
        channel_account_id: state.channel_account_id,
        partner_id: state.partner_id, shop_id: state.shop_id,
      } };
    },
    exchange: async () => {
      calls.exchanges++;
      return { response: { ok: true, status: 200 }, payload: {
        access_token: 'raw-access-one', refresh_token: 'raw-refresh-one',
        shop_id: SHOP, expire_in: 14400,
      } };
    },
    readShop: async () => {
      calls.reads++;
      return { response: { ok: true, status: 200 },
        payload: { shop_id: SHOP, shop_name: 'Celivio synthetic' },
        rawText: '{"shop_id":1357031949}' };
    },
    persistSnapshot: async () => ({ ok: true }),
    persistConnection: async record => { saves.push(record); return { ok: true }; },
    refresh: async () => ({ response: { ok: true, status: 200 },
      payload: { shop_id: SHOP, access_token: 'raw-access-two',
        refresh_token: 'raw-refresh-two', expire_in: 14400 } }),
  });
  async function begin() {
    const result = await start({
      method: 'GET', path: '/shopee/live/oauth/universal/start',
      query: { ticket: TICKET },
    });
    return result;
  }
  async function finish(startResult, shopId = SHOP) {
    const cookie = startResult.headers?.['Set-Cookie']?.split(';', 1)[0] ?? '';
    return callback({
      method: 'GET', path: '/shopee/live/oauth/callback',
      headers: { cookie },
      query: { code: 'synthetic-code', shop_id: String(shopId) },
    });
  }
  return { begin, finish, calls, saves, states };
}

test('F4 simulated handoff → signed Shopee consent → consumed state → Core-bound shop → encrypted persistence', async () => {
  const f = fixture();
  const start = await f.begin();
  assert.equal(start.status, 302);
  assert.equal(new URL(start.headers.Location).searchParams.get('redirect'), CALLBACK);
  assert.match(start.headers['Set-Cookie'], /Secure; SameSite=Lax/);
  const done = await f.finish(start);
  assert.equal(done.status, 200);
  assert.equal(f.calls.consumedTickets, 1);
  assert.equal(f.calls.consumedStates, 1);
  assert.equal(f.calls.exchanges, 1);
  assert.equal(f.calls.reads, 2);
  assert.equal(f.saves.length, 2);
  assert.ok(f.saves.every(x => x.channel_account_id === ACCOUNT && x.shop_id === SHOP));
  assert.ok(f.saves.every(x => x.access_token_ciphertext !== 'raw-access-one' &&
    x.refresh_token_ciphertext !== 'raw-refresh-two'));
  assert.equal((await f.finish(start)).status, 409);
  assert.equal(f.saves.length, 2);
  assert.equal((await f.begin()).status, 409);
});

test('F4 swapped destination cannot exchange or save tokens', async () => {
  const f = fixture({ expectedShop: 531736366 });
  const start = await f.begin();
  assert.equal(start.status, 302);
  const response = await f.finish(start);
  assert.equal(response.status, 409);
  assert.equal(f.calls.exchanges, 0);
  assert.equal(f.saves.length, 0);
});

test('F4 revoked binding blocks token exchange after state is consumed', async () => {
  const f = fixture({ revokeAfterStart: true });
  const start = await f.begin();
  assert.equal(start.status, 302);
  assert.equal((await f.finish(start)).status, 409);
  assert.equal(f.calls.exchanges, 0);
});

test('F4 universal callback remains default-off independently of start', async () => {
  const f = fixture({ callbackEnabled: false });
  const start = await f.begin();
  assert.equal(start.status, 302);
  assert.equal((await f.finish(start)).status, 503);
  assert.equal(f.calls.consumedStates, 0);
  assert.equal(f.calls.exchanges, 0);
});
