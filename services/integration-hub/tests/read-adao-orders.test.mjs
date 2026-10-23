import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { ADAO, readAdaoOrders } from '../src/read-adao-orders.mjs';
import { encryptShopeeToken } from '../src/shopee-token-crypto.mjs';
import { CORE_BRIDGE_URL } from '../src/core-bridge.mjs';

const NOW = Date.parse('2026-10-23T15:00:00Z');
const env = Object.freeze({ SHOPEE_LIVE_PARTNER_KEY: 'fixture-partner-key',
  SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY: 'fixture-encryption-key', CORE_BRIDGE_HMAC_SECRET: 'fixture-hmac',
  SHOPEE_LIVE_CHANNEL_ACCOUNT_ID: '8a8ad166-0317-4597-8be6-e43fb46b4d1b',
  SHOPEE_LIVE_PARTNER_ID: '999', CORE_BRIDGE_URL: 'https://must-not-use.invalid' });
const TOKEN = 'fixture-access-token';
const ID = '0123456789abcdef0123456789abcdef';
const environmentDigest = () => createHash('sha256').update(JSON.stringify(Object.entries(process.env).sort())).digest('hex');
const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status, headers: { 'content-type': 'application/json' },
});
async function fixture({ connection = {}, count = 2, list, detail, throwing = false } = {}) {
  const calls = [];
  const ciphertext = await encryptShopeeToken(TOKEN, env.SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY);
  const orders = Array.from({ length: count }, (_, i) => ({ order_sn: `FIXTURE${i}` }));
  const fetchImpl = async (input, init) => {
    const url = new URL(input);
    calls.push({ url, init });
    assert.equal(init.redirect, 'error');
    if (url.href === CORE_BRIDGE_URL) {
      assert.equal(init.method, 'POST');
      assert.deepEqual(JSON.parse(init.body), { action: 'shopee.oauth_connection.read',
        channel_account_id: ADAO.channel_account_id });
      return json({ request_id: init.headers['X-Integration-Hub-Request-Id'],
        partner_id: ADAO.partner_id, shop_id: ADAO.shop_id,
        access_token_ciphertext: ciphertext, refresh_token_ciphertext: 'never-decrypt-or-refresh',
        access_token_expires_at: new Date(NOW + 3600000).toISOString(), ...connection });
    }
    assert.equal(init.method ?? 'GET', 'GET');
    assert.equal(url.origin, 'https://partner.shopeemobile.com');
    assert.equal(url.searchParams.get('partner_id'), String(ADAO.partner_id));
    assert.equal(url.searchParams.get('shop_id'), String(ADAO.shop_id));
    assert.equal(url.searchParams.get('access_token'), TOKEN);
    if (throwing) throw new Error(`PRIVATE ${url.href} customer@example.invalid`);
    if (url.pathname.endsWith('/get_order_list')) {
      assert.equal(url.searchParams.get('time_from'), String(NOW / 1000 - 86400));
      assert.equal(url.searchParams.get('time_to'), String(NOW / 1000));
      assert.equal(url.searchParams.get('page_size'), '5');
      assert.equal(url.searchParams.get('time_range_field'), 'create_time');
      assert.equal(url.searchParams.has('cursor'), false);
      assert.equal(url.searchParams.has('order_status'), false);
      return json(list ?? { request_id: ID, response: { order_list: orders, more: true,
        next_cursor: 'PRIVATE-CURSOR' } });
    }
    assert.equal(url.pathname, '/api/v2/order/get_order_detail');
    assert.ok(url.searchParams.get('order_sn_list').split(',').length <= 5);
    assert.equal(url.searchParams.has('response_optional_fields'), false);
    return json(detail ?? { request_id: ID, response: { order_list: orders.map(order => ({ ...order,
      recipient_address: { name: 'PRIVATE CUSTOMER', phone: 'PRIVATE PHONE' } })) } });
  };
  return { calls, run: options => readAdaoOrders({ env, now: () => NOW, fetchImpl, ...options }) };
}

test('correct shop: one page and one detail GET, no writes, refresh, pagination or Viviane changes', async () => {
  const before = environmentDigest();
  const f = await fixture({ count: 5 });
  const report = await f.run();
  assert.equal(report.ok, true);
  assert.equal(report.listed_count, 5);
  assert.equal(report.detailed_count, 5);
  assert.deepEqual(report.identity, ADAO);
  assert.deepEqual(report.request_ids, { list: ID, detail: ID });
  assert.equal(f.calls.length, 3); // one Core READ POST, exactly two Shopee GETs
  assert.equal(environmentDigest(), before);
  const serialized = JSON.stringify(report);
  for (const secret of [TOKEN, ...Object.values(env), 'PRIVATE', 'FIXTURE0', 'recipient_address', 'next_cursor']) {
    assert.equal(serialized.includes(secret), false);
  }
});

test('empty page stops after list GET', async () => {
  const f = await fixture({ count: 0 });
  assert.equal((await f.run()).ok, true);
  assert.equal(f.calls.length, 2);
});

test('local account, partner and shop mismatch stop before any external request', async () => {
  for (const change of [{ channel_account_id: env.SHOPEE_LIVE_CHANNEL_ACCOUNT_ID }, { partner_id: 1 }, { shop_id: 531736366 }]) {
    const f = await fixture();
    assert.equal((await f.run({ identity: { ...ADAO, ...change } })).result, 'identity_mismatch');
    assert.equal(f.calls.length, 0);
  }
});

test('stored shop or partner mismatch stops after Core read, before Shopee', async () => {
  for (const connection of [{ shop_id: 531736366 }, { partner_id: 1 }]) {
    const f = await fixture({ connection });
    const report = await f.run();
    assert.equal(report.ok, false);
    assert.match(report.result, /^(shop|partner)_id_mismatch$/);
    assert.equal(f.calls.length, 1);
  }
});

test('expired, near expiry, boundary and missing tokens never refresh or call Shopee', async () => {
  for (const expiry of [NOW - 1, NOW + 59000, NOW + 60000, null]) {
    const f = await fixture({ connection: { access_token_expires_at: expiry === null ? null : new Date(expiry).toISOString() } });
    assert.equal((await f.run()).result, 'access_token_expired_no_refresh');
    assert.equal(f.calls.length, 1);
  }
});

test('oversized, malformed and duplicate pages fail before detail', async () => {
  for (const list of [
    { response: { order_list: Array.from({ length: 6 }, (_, i) => ({ order_sn: `FIXTURE${i}` })) } },
    { response: {} },
    { response: { order_list: [{ order_sn: 'FIXTURE0' }, { order_sn: 'FIXTURE0' }] } },
    { response: { order_list: [{ order_sn: '' }] } },
  ]) {
    const f = await fixture({ list });
    assert.equal((await f.run()).ok, false);
    assert.equal(f.calls.length, 2);
  }
});

test('unmatched or incomplete details fail and remain sanitized', async () => {
  for (const order_list of [[{ order_sn: 'OTHER' }], [{ order_sn: 'FIXTURE0' }]]) {
    const f = await fixture({ detail: { response: { order_list } } });
    const report = await f.run();
    assert.equal(report.ok, false);
    assert.equal(report.detailed_count, 0);
    assert.equal(f.calls.length, 3);
  }
});

test('exceptions and Shopee errors cannot leak URLs, payloads or credentials through logs or output', async () => {
  const logs = [];
  const original = console.info;
  console.info = (...args) => logs.push(args);
  try {
    for (const options of [{ throwing: true }, { list: { error: 'PRIVATE customer@example.invalid',
      message: TOKEN, request_id: 'https://private.invalid/?access_token=secret' } }]) {
      const f = await fixture(options);
      const report = await f.run();
      assert.equal(report.ok, false);
      assert.equal(/PRIVATE|customer@|https:|access_token|fixture-access-token/.test(JSON.stringify(report)), false);
    }
    assert.deepEqual(logs, []);
  } finally { console.info = original; }
});

test('missing secrets stop without network', async () => {
  const f = await fixture();
  assert.equal((await f.run({ env: {} })).result, 'configuration_missing');
  assert.equal(f.calls.length, 0);
});

test('CLI without explicit --live exits without network or secrets', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../src/read-adao-orders.mjs', import.meta.url))],
    { encoding: 'utf8', env: {} });
  assert.equal(result.status, 2);
  assert.match(result.stdout, /Usage:/);
  assert.equal(result.stderr, '');
});
