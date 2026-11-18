import test from 'node:test';
import assert from 'node:assert/strict';
import { createUniversalShopeeStartHandler } from './shopee-oauth-universal-start.mjs';

const ticket = 'A'.repeat(43);
const account = 'd26c7a30-aa4a-4441-8012-600d70453689';
function deps(overrides = {}) {
  let consumed = 0, states = 0;
  const d = {
    getEnv: name => ({
      SHOPEE_OAUTH_UNIVERSAL_START_ENABLED: 'true',
      SHOPEE_LIVE_PARTNER_ID: '2047685',
      SHOPEE_LIVE_PARTNER_KEY: 'dummy-test-key',
      SHOPEE_LIVE_REDIRECT_URI: 'https://integration-hub-oauth-bh4c23q1.ue.gateway.dev/shopee/live/oauth/callback',
    })[name],
    consumeHandoff: async () => {
      consumed += 1;
      return { ok: true, payload: { channel_account_id: account, auth_user_id: '11111111-1111-4111-8111-111111111111', shop_id: 1357031949, partner_id: 2047685 } };
    },
    createState: async () => { states += 1; return { ok: true }; },
    sign: async () => ({ timestamp: 1795000000, sign: 'a'.repeat(64) }),
    makeState: () => 'randomstate',
    now: () => 1795000000000,
    ...overrides,
  };
  return { handler: createUniversalShopeeStartHandler(d), counts: () => ({ consumed, states }) };
}
const req = { path: '/shopee/live/oauth/universal/start', method: 'GET', query: { ticket } };

test('universal route is default-off and consumes no ticket', async () => {
  const f = deps({ getEnv: () => undefined });
  assert.equal((await f.handler(req)).status, 503);
  assert.deepEqual(f.counts(), { consumed: 0, states: 0 });
});

test('accepts signed authorized ticket, stores state, redirects with secure cookie', async () => {
  const f = deps();
  const res = await f.handler(req);
  assert.equal(res.status, 302);
  assert.equal(new URL(res.headers.Location).pathname, '/api/v2/shop/auth_partner');
  assert.match(res.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Lax/);
  assert.match(res.headers['Set-Cookie'], /universal\.randomstate/);
  assert.deepEqual(f.counts(), { consumed: 1, states: 1 });
});

test('rejects malformed ticket, parameter injection and invalid route before consume', async () => {
  const f = deps();
  for (const request of [
    { ...req, query: { ticket: 'invalid' } },
    { ...req, query: { ticket, channel_account_id: account } },
    { ...req, query: { ticket, partner_id: '2047685' } },
  ]) assert.equal((await f.handler(request)).status, 400);
  assert.equal(await f.handler({ ...req, path: '/different' }), null);
  assert.equal((await f.handler({ ...req, method: 'POST' })).status, 405);
  assert.deepEqual(f.counts(), { consumed: 0, states: 0 });
});

test('rejects consumed/unapproved ticket without state creation or redirect', async () => {
  for (const result of [{ ok: false }, { ok: true, payload: { channel_account_id: account, auth_user_id: '11111111-1111-4111-8111-111111111111', shop_id: 1357031949, partner_id: 900 } }]) {
    const f = deps({ consumeHandoff: async () => result });
    assert.equal((await f.handler(req)).status, 409);
    assert.equal(f.counts().states, 0);
  }
});

test('does not consume ticket with incorrect partner/callback config', async () => {
  const f = deps({ getEnv: name => name === 'SHOPEE_OAUTH_UNIVERSAL_START_ENABLED' ? 'true' :
    name === 'SHOPEE_LIVE_PARTNER_ID' ? '2047685' : 'invalid' });
  assert.equal((await f.handler(req)).status, 503);
  assert.equal(f.counts().consumed, 0);
});

test('fails closed when state cannot be persisted', async () => {
  const f = deps({ createState: async () => ({ ok: false }) });
  assert.equal((await f.handler(req)).status, 503);
});
