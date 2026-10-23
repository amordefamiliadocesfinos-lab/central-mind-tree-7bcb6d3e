import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ADAO } from '../src/read-adao-orders.mjs';
import { CORE_BRIDGE_URL } from '../src/core-bridge.mjs';
import { encryptShopeeToken } from '../src/shopee-token-crypto.mjs';
import { refreshAdaoTokenOnce } from '../src/refresh-adao-token-once.mjs';

const NOW = Date.parse('2026-10-23T19:26:00.000Z');
const env = Object.freeze({
  SHOPEE_LIVE_PARTNER_KEY: 'fixture-partner',
  SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY: 'fixture-encryption',
  CORE_BRIDGE_HMAC_SECRET: 'fixture-hmac',
  SHOPEE_LIVE_CHANNEL_ACCOUNT_ID: '8a8ad166-0317-4597-8be6-e43fb46b4d1b',
  SHOPEE_LIVE_PARTNER_ID: '999',
});
const response = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
});

async function setup({ shopId = ADAO.shop_id, accessExpiresAt = NOW - 1000,
  tokenRefreshExpiresAt = NOW + 60 * 60 * 1000, refreshShopId = null,
  coreWriteFailure = false, lostWriteResponse = false } = {}) {
  let stored = {
    partner_id: ADAO.partner_id,
    shop_id: shopId,
    access_token_ciphertext: await encryptShopeeToken('fixture-access', env.SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY),
    refresh_token_ciphertext: await encryptShopeeToken('fixture-refresh', env.SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY),
    access_token_expires_at: new Date(accessExpiresAt).toISOString(),
    refresh_token_expires_at: new Date(tokenRefreshExpiresAt).toISOString(),
  };
  const calls = [];
  const fetchImpl = async (input, init) => {
    const url = new URL(input);
    calls.push({ url: url.origin + url.pathname, method: init.method, redirect: init.redirect });
    assert.equal(init.redirect, 'error');
    if (url.href === CORE_BRIDGE_URL) {
      assert.equal(init.method, 'POST');
      const body = JSON.parse(init.body);
      assert.equal(body.channel_account_id, ADAO.channel_account_id);
      const rid = init.headers['X-Integration-Hub-Request-Id'];
      if (body.action === 'shopee.oauth_connection.read') {
        return response({ request_id: rid, ...stored });
      }
      assert.equal(body.action, 'shopee.oauth_connection.refresh');
      assert.equal(body.access_token_ciphertext.includes('fixture-access'), false);
      if (coreWriteFailure) return response({ request_id: rid, error: 'failed' }, 503);
      stored = { ...stored, ...body };
      if (lostWriteResponse) throw new Error('lost Core response');
      return response({ request_id: rid, status: 'ok' });
    }
    assert.equal(url.origin, 'https://partner.shopeemobile.com');
    assert.equal(url.pathname, '/api/v2/auth/access_token/get');
    assert.equal(url.searchParams.get('partner_id'), String(ADAO.partner_id));
    const body = JSON.parse(init.body);
    assert.equal(body.shop_id, ADAO.shop_id);
    assert.equal(body.partner_id, ADAO.partner_id);
    return response({ access_token: 'fixture-access-refreshed',
      refresh_token: 'fixture-refresh-refreshed', expire_in: 14400,
      ...(refreshShopId === null ? {} : { shop_id: refreshShopId }) });
  };
  return { calls, run: overrides => refreshAdaoTokenOnce({
    env, fetchImpl, now: () => NOW, confirmed: true, ...overrides,
  }) };
}

test('manual Adão refresh is gated before Core request', async () => {
  const f = await setup();
  const result = await f.run({ confirmed: false });
  assert.equal(result.code, 'confirmation_required');
  assert.equal(f.calls.length, 0);
});

test('valid token does not refresh or write', async () => {
  const f = await setup({ accessExpiresAt: NOW + 3 * 60 * 60 * 1000 });
  const result = await f.run();
  assert.deepEqual({ ok: result.ok, code: result.code }, { ok: true, code: 'already_valid' });
  assert.equal(f.calls.length, 1);
});

test('expired token refreshed exclusively for Adão and persisted once', async () => {
  const f = await setup();
  const result = await f.run();
  assert.equal(result.ok, true);
  assert.equal(result.code, 'refreshed');
  assert.equal(result.shop_id, ADAO.shop_id);
  assert.equal(f.calls.length, 4);
  assert.equal(f.calls.filter(x => x.url.includes('partner.shopeemobile.com')).length, 1);
  const output = JSON.stringify(result);
  for (const secret of ['fixture-access', 'fixture-refresh', 'fixture-partner', 'fixture-hmac']) {
    assert.equal(output.includes(secret), false);
  }
});

test('wrong stored shop rejects before Shopee refresh and Core write', async () => {
  const f = await setup({ shopId: 531736366 });
  const result = await f.run();
  assert.equal(result.code, 'stored_identity_mismatch');
  assert.equal(f.calls.length, 1);
});

test('refresh token expired rejects before external Shopee call', async () => {
  const f = await setup({ tokenRefreshExpiresAt: NOW - 1000 });
  const result = await f.run();
  assert.equal(result.code, 'refresh_token_expired');
  assert.equal(f.calls.length, 1);
});

test('Shopee refresh response with wrong shop rejects without token writes', async () => {
  const f = await setup({ refreshShopId: 531736366 });
  const result = await f.run();
  assert.equal(result.code, 'token_refresh_rejected');
  assert.equal(f.calls.length, 2);
});

test('Core rejection or lost write response never triggers retry', async () => {
  for (const spec of [{ coreWriteFailure: true }, { lostWriteResponse: true }]) {
    const f = await setup(spec);
    const result = await f.run();
    assert.equal(result.ok, false);
    assert.equal(result.code, 'token_refresh_persistence_failed');
    assert.equal(f.calls.length, 3);
  }
});

test('missing secrets short-circuit without network', async () => {
  const f = await setup();
  const result = await f.run({ env: {} });
  assert.equal(result.code, 'configuration_missing');
  assert.equal(f.calls.length, 0);
});

test('CLI refuses execution without explicit confirmation', () => {
  const script = fileURLToPath(new URL('../src/refresh-adao-token-once.mjs', import.meta.url));
  for (const args of [[], ['--refresh-once'], ['--refresh-once', '--confirm=WRONG']]) {
    const x = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: {} });
    assert.equal(x.status, 2);
    assert.match(x.stdout, /Usage/);
    assert.equal(x.stderr, '');
  }
});
