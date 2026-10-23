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
async function fixture({ connection = {}, count = 2, list, detail, throwing = false,
  writeFailureAt = null, responseLostAt = null, itemMode = false } = {}) {
  const calls = [];
  const writes = [];
  const ciphertext = await encryptShopeeToken(TOKEN, env.SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY);
  const orders = Array.from({ length: count }, (_, i) => ({ order_sn: `FIXTURE${i}` }));
  const fetchImpl = async (input, init) => {
    const url = new URL(input);
    calls.push({ url, init });
    assert.equal(init.redirect, 'error');
    if (url.href === CORE_BRIDGE_URL) {
      assert.equal(init.method, 'POST');
      const body = JSON.parse(init.body);
      if (body.action === 'shopee.oauth_connection.read') {
        assert.deepEqual(body, { action: 'shopee.oauth_connection.read',
          channel_account_id: ADAO.channel_account_id });
        return json({ request_id: init.headers['X-Integration-Hub-Request-Id'],
          partner_id: ADAO.partner_id, shop_id: ADAO.shop_id,
          access_token_ciphertext: ciphertext, refresh_token_ciphertext: 'never-decrypt-or-refresh',
          access_token_expires_at: new Date(NOW + 3600000).toISOString(), ...connection });
      }
      assert.ok(['shopee.raw_order_list_snapshot.upsert',
        'shopee.raw_order_snapshot.upsert'].includes(body.action));
      assert.equal(body.channel_account_id, ADAO.channel_account_id);
      assert.ok(body.external_entity_id);
      assert.match(body.payload_hash, /^[a-f0-9]{64}$/);
      assert.ok(Buffer.byteLength(init.body, 'utf8') <= 64 * 1024);
      writes.push(body);
      if (responseLostAt === writes.length) throw new Error('lost network response');
      if (writeFailureAt === writes.length) return json({ error: 'synthetic_failure' }, 503);
      return json({ request_id: init.headers['X-Integration-Hub-Request-Id'], ok: true });
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
    if (itemMode) {
      assert.equal(url.searchParams.get('response_optional_fields'), 'item_list,total_amount,payment_method');
    } else {
      assert.equal(url.searchParams.has('response_optional_fields'), false);
    }
    return json(detail ?? { request_id: ID, response: { order_list: orders.map(order => ({ ...order,
      ...(itemMode ? { order_status: 'PROCESSED', create_time: NOW / 1000, total_amount: 12.50,
        payment_method: 'PIX', item_list: [{ item_id: 123456789, model_id: 0,
          item_name: 'Produto de teste', model_quantity_purchased: 2,
          model_discounted_price: 6.25 }] } : {}),
      recipient_address: { name: 'PRIVATE CUSTOMER', phone: 'PRIVATE PHONE' } })) } });
  };
  return { calls, writes, run: options => readAdaoOrders({ env, now: () => NOW, fetchImpl, ...options }) };
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

const RAW = { persistRaw: true, confirmation: 'CONFIRM_ADAO_RAW_SNAPSHOTS' };

test('raw mode refuses execution without exact confirmation before network', async () => {
  const f = await fixture();
  const result = await f.run({ persistRaw: true });
  assert.equal(result.result, 'raw_confirmation_required');
  assert.equal(f.calls.length, 0);
  assert.equal(f.writes.length, 0);
});

test('explicit raw mode stores one list and two details after full validated read', async () => {
  const f = await fixture({ count: 2 });
  const result = await f.run(RAW);
  assert.equal(result.ok, true);
  assert.equal(result.result, 'raw_persisted');
  assert.deepEqual(result.raw, { expected: 3, attempted: 3, confirmed: 3 });
  assert.equal(f.calls.length, 6); // one Core read, two Shopee GET, three Core writes
  assert.deepEqual(f.writes.map(item => item.action), [
    'shopee.raw_order_list_snapshot.upsert',
    'shopee.raw_order_snapshot.upsert',
    'shopee.raw_order_snapshot.upsert',
  ]);
  assert.deepEqual(f.writes.slice(1).map(item => item.external_entity_id), ['FIXTURE0', 'FIXTURE1']);
  assert.equal(JSON.stringify(result).includes('PRIVATE CUSTOMER'), false);
  assert.equal(JSON.stringify(result).includes(TOKEN), false);
});

test('raw mode accepts an empty page, storing only the list snapshot', async () => {
  const f = await fixture({ count: 0 });
  const result = await f.run(RAW);
  assert.equal(result.ok, true);
  assert.equal(result.raw.confirmed, 1);
  assert.equal(f.writes.length, 1);
});

test('raw rerun is safe with Core idempotent upsert contract', async () => {
  const f = await fixture({ count: 2 });
  assert.equal((await f.run(RAW)).ok, true);
  assert.equal((await f.run(RAW)).ok, true);
  assert.equal(f.writes.length, 6);
  assert.equal(f.writes[0].payload_hash, f.writes[3].payload_hash);
  assert.equal(f.writes[1].payload_hash, f.writes[4].payload_hash);
  assert.equal(f.writes[2].payload_hash, f.writes[5].payload_hash);
});

test('raw mode blocks wrong local identity and mismatching stored shop before writes', async () => {
  const f = await fixture();
  assert.equal((await f.run({ ...RAW, identity: { ...ADAO, shop_id: 531736366 } })).result, 'identity_mismatch');
  assert.equal(f.calls.length, 0);
  const g = await fixture({ connection: { shop_id: 531736366 } });
  assert.equal((await g.run(RAW)).ok, false);
  assert.equal(g.calls.length, 1);
  assert.equal(g.writes.length, 0);
});

test('raw mode validates all detail responses before any Core snapshot write', async () => {
  const f = await fixture({ detail: { response: { order_list: [{ order_sn: 'OTHER' }] } } });
  const result = await f.run(RAW);
  assert.equal(result.ok, false);
  assert.equal(f.writes.length, 0);
});

test('raw mode preflights every 64-KiB Core payload before first write', async () => {
  const bulky = 'x'.repeat(66000);
  const f = await fixture({ detail: { response: { order_list: [
    { order_sn: 'FIXTURE0' }, { order_sn: 'FIXTURE1', note: bulky },
  ] } } });
  const result = await f.run(RAW);
  assert.equal(result.result, 'raw_snapshot_oversized');
  assert.equal(result.raw.confirmed, 0);
  assert.equal(f.writes.length, 0);
});

test('Core rejection stops subsequent raw writes without creating internal orders', async () => {
  const f = await fixture({ writeFailureAt: 2 });
  const result = await f.run(RAW);
  assert.equal(result.ok, false);
  assert.equal(result.result, 'raw_persistence_unconfirmed');
  assert.deepEqual(result.raw, { expected: 3, attempted: 2, confirmed: 1 });
  assert.equal(f.writes.length, 2);
});

test('lost Core response leaves outcome unconfirmed and never auto retries', async () => {
  const f = await fixture({ responseLostAt: 1 });
  const result = await f.run(RAW);
  assert.equal(result.ok, false);
  assert.equal(result.raw.confirmed, 0);
  assert.equal(result.raw.attempted, 1);
  assert.equal(f.writes.length, 1);
  assert.equal(JSON.stringify(result).includes('network'), false);
});

test('raw mode also refuses expired token and avoids Shopee and Core writes', async () => {
  const f = await fixture({ connection: { access_token_expires_at: new Date(NOW - 1).toISOString() } });
  assert.equal((await f.run(RAW)).result, 'access_token_expired_no_refresh');
  assert.equal(f.calls.length, 1);
  assert.equal(f.writes.length, 0);
});

test('CLI cannot enable raw writes without exact two-argument confirmation', () => {
  const script = fileURLToPath(new URL('../src/read-adao-orders.mjs', import.meta.url));
  for (const args of [['--persist-raw'], ['--persist-raw', '--confirm=WRONG'], ['--live', '--persist-raw']]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: {} });
    assert.equal(result.status, 2);
    assert.equal(result.stderr, '');
  }
});

const ITEMS = { includeItems: true };
const PERSIST_ITEMS = { includeItems: true, persistRaw: true, confirmation: 'CONFIRM_ADAO_ORDER_ITEMS' };

test('F6-Q.6A preview requests exactly three optional fields without writes or secret leaks', async () => {
  const f = await fixture({ itemMode: true, count: 3 });
  const result = await f.run(ITEMS);
  assert.equal(result.ok, true);
  assert.deepEqual(result.items, { eligible_orders: 3, item_lines: 3, missing_or_invalid: 0 });
  assert.equal(f.calls.length, 3);
  assert.equal(f.writes.length, 0);
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
  assert.equal(JSON.stringify(result).includes('FIXTURE0'), false);
  assert.equal(JSON.stringify(result).includes(TOKEN), false);
});

test('F6-Q.6A persists list and item-enriched details with explicit confirmation', async () => {
  const f = await fixture({ itemMode: true, count: 2 });
  const result = await f.run(PERSIST_ITEMS);
  assert.equal(result.ok, true);
  assert.equal(result.result, 'raw_persisted');
  assert.deepEqual(result.raw, { confirmed: 3, attempted: 3, expected: 3 });
  assert.equal(f.writes.length, 3);
  for (const snapshot of f.writes.slice(1)) {
    const order = snapshot.payload.response.order_list[0];
    assert.equal(order.item_list[0].item_id, 123456789);
    assert.equal(order.item_list[0].model_quantity_purchased, 2);
    assert.equal(order.payment_method, 'PIX');
    assert.equal(order.total_amount, 12.50);
  }
});

test('F6-Q.6A eligible order without item_list fails before any persistence', async () => {
  const f = await fixture({ itemMode: true, count: 1, detail: {
    response: { order_list: [{ order_sn: 'FIXTURE0', order_status: 'READY_TO_SHIP' }] },
  } });
  const result = await f.run(PERSIST_ITEMS);
  assert.equal(result.result, 'order_items_missing_or_invalid');
  assert.equal(result.items.missing_or_invalid, 1);
  assert.equal(f.writes.length, 0);
  assert.equal(f.calls.length, 3);
});

test('F6-Q.6A malformed item id or quantity blocks the entire page', async () => {
  for (const item of [{ item_id: null, model_quantity_purchased: 2 },
    { item_id: 99, model_quantity_purchased: 0 },
    { item_id: 99, model_quantity_purchased: 1.5 }]) {
    const f = await fixture({ itemMode: true, count: 1, detail: {
      response: { order_list: [{ order_sn: 'FIXTURE0', order_status: 'PROCESSED', item_list: [item] }] },
    } });
    assert.equal((await f.run(PERSIST_ITEMS)).result, 'order_items_missing_or_invalid');
    assert.equal(f.writes.length, 0);
  }
});

test('F6-Q.6A canceled order may lack items while eligible order requires them', async () => {
  const f = await fixture({ itemMode: true, count: 2, detail: {
    response: { order_list: [
      { order_sn: 'FIXTURE0', order_status: 'CANCELLED' },
      { order_sn: 'FIXTURE1', order_status: 'READY_TO_SHIP',
        item_list: [{ item_id: 135, model_id: 0, model_quantity_purchased: 4 }] },
    ] },
  } });
  const result = await f.run(PERSIST_ITEMS);
  assert.equal(result.ok, true);
  assert.equal(result.items.eligible_orders, 1);
  assert.equal(result.items.item_lines, 1);
  assert.equal(result.raw.confirmed, 3);
});

test('F6-Q.6A second eligible detail missing items prevents all Core writes', async () => {
  const f = await fixture({ itemMode: true, count: 2, detail: {
    response: { order_list: [
      { order_sn: 'FIXTURE0', order_status: 'PROCESSED', item_list: [{ item_id: 135, model_quantity_purchased: 1 }] },
      { order_sn: 'FIXTURE1', order_status: 'READY_TO_SHIP', item_list: [] },
    ] },
  } });
  assert.equal((await f.run(PERSIST_ITEMS)).result, 'order_items_missing_or_invalid');
  assert.equal(f.writes.length, 0);
});

test('F6-Q.6A refuses wrong confirmation, including generic raw confirmation', async () => {
  const f = await fixture({ itemMode: true, count: 1 });
  for (const confirmation of [null, 'CONFIRM_ADAO_RAW_SNAPSHOTS', 'WRONG']) {
    const result = await f.run({ includeItems: true, persistRaw: true, confirmation });
    assert.equal(result.result, 'raw_confirmation_required');
    assert.equal(f.calls.length, 0);
  }
});

test('F6-Q.6A item persistence does not retry a lost response', async () => {
  const f = await fixture({ itemMode: true, count: 2, responseLostAt: 2 });
  const result = await f.run(PERSIST_ITEMS);
  assert.equal(result.ok, false);
  assert.equal(result.raw.attempted, 2);
  assert.equal(result.raw.confirmed, 1);
  assert.equal(f.writes.length, 2);
});

test('F6-Q.6A expired access token prevents Shopee GETs and Core writes', async () => {
  const f = await fixture({ itemMode: true, connection: {
    access_token_expires_at: new Date(NOW - 1).toISOString(),
  } });
  assert.equal((await f.run(PERSIST_ITEMS)).result, 'access_token_expired_no_refresh');
  assert.equal(f.calls.length, 1);
  assert.equal(f.writes.length, 0);
});

test('F6-Q.6A CLI blocks unconfirmed item persistence', () => {
  const script = fileURLToPath(new URL('../src/read-adao-orders.mjs', import.meta.url));
  for (const args of [['--persist-items'], ['--persist-items', '--confirm=WRONG'],
    ['--live', '--persist-items'], ['--preview-items', '--persist-items']]) {
    const res = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: {} });
    assert.equal(res.status, 2);
    assert.equal(res.stderr, '');
  }
});

test('F6-Q.6A: missing order status blocks item snapshot writes even with item_list', async () => {
  const f = await fixture({ itemMode: true, count: 1, detail: {
    response: { order_list: [{ order_sn: 'FIXTURE0',
      item_list: [{ item_id: 123, model_quantity_purchased: 1 }] }] },
  } });
  const result = await f.run(PERSIST_ITEMS);
  assert.equal(result.result, 'order_items_missing_or_invalid');
  assert.equal(result.items.missing_or_invalid, 1);
  assert.equal(f.writes.length, 0);
});
