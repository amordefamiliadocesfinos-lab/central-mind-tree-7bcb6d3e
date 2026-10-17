import test from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { createShopeeLiveOrdersReader } from '../src/shopee-live-orders.mjs';
import { decryptShopeeToken, encryptShopeeToken } from '../src/shopee-token-crypto.mjs';

const CHANNEL_ACCOUNT_ID = '8a8ad166-0317-4597-8be6-e43fb46b4d1b';
const PARTNER_ID = '2047685';
const SHOP_ID = 531736366;
const SECRET = 'synthetic-token-encryption-key';

function env(name) {
  const values = {
    SHOPEE_LIVE_PARTNER_ID: PARTNER_ID,
    SHOPEE_LIVE_PARTNER_KEY: 'synthetic-partner-key',
    SHOPEE_LIVE_CHANNEL_ACCOUNT_ID: CHANNEL_ACCOUNT_ID,
    SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY: SECRET,
  };
  return values[name];
}

function encryptTokenForTest(token) {
  const iv = randomBytes(12);
  const key = createHash('sha256').update(SECRET).digest();
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return `${iv.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function response(payload, status = 200) {
  return {
    response: { ok: status >= 200 && status < 300, status },
    payload,
    rawText: JSON.stringify(payload),
  };
}

const NOW = Date.parse('2026-10-12T16:00:00.000Z');
const WINDOW = { timeFrom: 1760270400, timeTo: 1760274000 };

function refreshFixture({ connection = {}, result, persistOk = true } = {}) {
  const events = [];
  const logs = [];
  let persisted;
  const reader = createShopeeLiveOrdersReader({
    getEnv: env,
    now: () => NOW,
    readConnection: async () => {
      events.push('read');
      return { ok: true, payload: {
        partner_id: Number(PARTNER_ID), shop_id: SHOP_ID,
        access_token_ciphertext: encryptTokenForTest('synthetic-old-access'),
        refresh_token_ciphertext: encryptTokenForTest('synthetic-old-refresh'),
        access_token_expires_at: new Date(NOW - 1).toISOString(),
        refresh_token_expires_at: new Date(NOW + 86400000).toISOString(),
        last_authenticated_at: '2026-10-10T16:00:00.000Z',
        ...connection,
      } };
    },
    decryptToken: async (value, key) => {
      const token = await decryptShopeeToken(value, key);
      events.push(token === 'synthetic-old-refresh' ? 'decrypt-refresh' : 'decrypt-access');
      return token;
    },
    encryptToken: async (value, key) => {
      events.push(value === 'synthetic-new-access' ? 'encrypt-access' : 'encrypt-refresh');
      return encryptShopeeToken(value, key);
    },
    refreshAccessToken: async (args) => {
      events.push('refresh');
      assert.equal(args.refreshToken, 'synthetic-old-refresh');
      assert.equal(args.partnerId, Number(PARTNER_ID));
      assert.equal(args.shopId, SHOP_ID);
      assert.equal(args.refreshPath, '/api/v2/auth/access_token/get');
      return result ?? response({
        access_token: 'synthetic-new-access', refresh_token: 'synthetic-new-refresh', expire_in: 3600,
      });
    },
    persistRefreshedConnection: async (payload) => {
      events.push('persist-refresh');
      persisted = payload;
      return { ok: persistOk };
    },
    readOrderList: async (args) => {
      events.push('list');
      assert.equal(args.accessToken, events.includes('refresh') ? 'synthetic-new-access' : 'synthetic-old-access');
      assert.equal(args.pageSize, 5);
      assert.equal(args.cursor, null);
      return response({ response: { order_list: [], more: true, next_cursor: 'synthetic-next-page' } });
    },
    readOrderDetail: async () => { throw new Error('empty list must not request details'); },
    persistOrderListSnapshot: async () => { events.push('persist-list'); return { ok: true }; },
    persistOrderSnapshot: async () => { throw new Error('empty list must not persist details'); },
    logger: (entry) => logs.push(entry),
  });
  return { reader, events, logs, persisted: () => persisted };
}

test('valid access decrypts only access and reads exactly one page without refresh', async () => {
  const fixture = refreshFixture({ connection: { access_token_expires_at: new Date(NOW + 3600000).toISOString() } });
  assert.equal((await fixture.reader(WINDOW)).ok, true);
  assert.deepEqual(fixture.events, ['read', 'decrypt-access', 'list', 'persist-list']);
  assert.equal(fixture.persisted(), undefined);
});

for (const expiration of [NOW - 1, NOW + 60000]) {
  test(`expired or safety-margin access refreshes and persists before orders (${expiration})`, async () => {
    const fixture = refreshFixture({ connection: { access_token_expires_at: new Date(expiration).toISOString() } });
    assert.equal((await fixture.reader(WINDOW)).ok, true);
    assert.deepEqual(fixture.events, [
      'read', 'decrypt-refresh', 'refresh', 'encrypt-access', 'encrypt-refresh',
      'persist-refresh', 'list', 'persist-list',
    ]);
    const payload = fixture.persisted();
    assert.deepEqual(Object.keys(payload).sort(), [
      'channel_account_id', 'access_token_ciphertext', 'refresh_token_ciphertext',
      'access_token_expires_at', 'refresh_token_expires_at', 'last_refreshed_at',
    ].sort());
    assert.equal(await decryptShopeeToken(payload.access_token_ciphertext, SECRET), 'synthetic-new-access');
    assert.equal(await decryptShopeeToken(payload.refresh_token_ciphertext, SECRET), 'synthetic-new-refresh');
    assert.equal(payload.access_token_expires_at, new Date(NOW + 3600000).toISOString());
    assert.equal(payload.refresh_token_expires_at, new Date(NOW + 30 * 86400000).toISOString());
    assert.equal(payload.last_refreshed_at, new Date(NOW).toISOString());
    assert.deepEqual(fixture.logs, []);
  });
}

test('expired refresh fails before decrypt, refresh or orders', async () => {
  const fixture = refreshFixture({ connection: { refresh_token_expires_at: new Date(NOW).toISOString() } });
  assert.equal((await fixture.reader(WINDOW)).code, 'refresh_token_expired');
  assert.deepEqual(fixture.events, ['read']);
});

for (const result of [response({ error: 'error_auth', message: 'synthetic rejection' }), response({}, 401)]) {
  test(`Shopee refresh rejection prevents persistence and orders (HTTP ${result.response.status})`, async () => {
    const fixture = refreshFixture({ result });
    assert.equal((await fixture.reader(WINDOW)).code, 'token_refresh_rejected');
    assert.deepEqual(fixture.events, ['read', 'decrypt-refresh', 'refresh']);
    assert.equal(fixture.persisted(), undefined);
    const output = JSON.stringify(fixture.logs);
    for (const sensitive of ['synthetic-old-refresh', 'synthetic-new-access', 'synthetic-new-refresh', 'ciphertext']) {
      assert.equal(output.includes(sensitive), false);
    }
  });
}

for (const missing of ['access_token', 'refresh_token']) {
  test(`incomplete refresh without ${missing} prevents encryption, persistence and orders`, async () => {
    const tokens = { access_token: 'synthetic-new-access', refresh_token: 'synthetic-new-refresh' };
    delete tokens[missing];
    const fixture = refreshFixture({ result: response(tokens) });
    assert.equal((await fixture.reader(WINDOW)).code, 'token_refresh_incomplete');
    assert.deepEqual(fixture.events, ['read', 'decrypt-refresh', 'refresh']);
  });
}

test('failed refreshed-pair persistence fails closed before any order request or Raw write', async () => {
  const fixture = refreshFixture({ persistOk: false });
  assert.equal((await fixture.reader(WINDOW)).code, 'token_refresh_persistence_failed');
  assert.deepEqual(fixture.events, [
    'read', 'decrypt-refresh', 'refresh', 'encrypt-access', 'encrypt-refresh', 'persist-refresh',
  ]);
});

test('partner identity mismatch fails before decrypt or Shopee', async () => {
  const fixture = refreshFixture({ connection: { partner_id: 999 } });
  assert.equal((await fixture.reader(WINDOW)).code, 'partner_id_mismatch');
  assert.deepEqual(fixture.events, ['read']);
});

for (const expireIn of [undefined, 0, -1, 'invalid', 604801]) {
  test(`invalid refresh expire_in uses four-hour fallback (${expireIn})`, async () => {
    const fixture = refreshFixture({ result: response({
      access_token: 'synthetic-new-access', refresh_token: 'synthetic-new-refresh', expire_in: expireIn,
    }) });
    assert.equal((await fixture.reader(WINDOW)).ok, true);
    assert.equal(fixture.persisted().access_token_expires_at, new Date(NOW + 4 * 3600000).toISOString());
  });
}

test('token crypto round-trip uses the F5 IV/ciphertext/tag wire format', async () => {
  const plaintext = 'synthetic-round-trip-only';
  const encrypted = await encryptShopeeToken(plaintext, SECRET);
  const [ivPart, payloadPart] = encrypted.split('.');
  const iv = Buffer.from(ivPart, 'base64url');
  const payload = Buffer.from(payloadPart, 'base64url');
  assert.equal(iv.length, 12);
  assert.equal(payload.length, Buffer.byteLength(plaintext) + 16);
  assert.equal(await decryptShopeeToken(encrypted, SECRET), plaintext);
  assert.equal(await decryptShopeeToken(encryptTokenForTest(plaintext), SECRET), plaintext);
  const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(SECRET).digest(), iv);
  decipher.setAuthTag(payload.subarray(-16));
  assert.equal(Buffer.concat([decipher.update(payload.subarray(0, -16)), decipher.final()]).toString(), plaintext);
  await assert.rejects(decryptShopeeToken(encrypted, 'synthetic-wrong-key'), /token_decryption_failed/);
});

for (const detailed of [
  [{ order_sn: '260101AAA' }, { order_sn: 'NOTLISTED' }],
  [{ order_sn: '260101AAA' }, { order_sn: '260101AAA' }],
]) {
  test('unexpected or duplicate detail identity rejects the whole batch before Raw detail writes', async () => {
    let detailWrites = 0;
    const reader = createShopeeLiveOrdersReader({
      getEnv: env, now: () => NOW,
      readConnection: async () => ({ ok: true, payload: {
        partner_id: Number(PARTNER_ID), shop_id: SHOP_ID,
        access_token_ciphertext: encryptTokenForTest('synthetic-access'),
        access_token_expires_at: new Date(NOW + 3600000).toISOString(),
      } }),
      readOrderList: async () => response({ response: { order_list: [{ order_sn: '260101AAA' }] } }),
      readOrderDetail: async () => response({ response: { order_list: detailed } }),
      persistOrderListSnapshot: async () => ({ ok: true }),
      persistOrderSnapshot: async () => { detailWrites += 1; return { ok: true }; },
      logger: () => {},
    });
    assert.equal((await reader(WINDOW)).code, 'order_detail_identity_mismatch');
    assert.equal(detailWrites, 0);
  });
}

test('fails closed before Shopee when access and refresh token are expired or absent', async () => {
  let listCalls = 0;
  const reader = createShopeeLiveOrdersReader({
    getEnv: env,
    now: () => Date.parse('2026-10-12T16:00:00.000Z'),
    readConnection: async () => ({
      ok: true,
      payload: {
        partner_id: Number(PARTNER_ID),
        shop_id: SHOP_ID,
        access_token_ciphertext: encryptTokenForTest('expired-access'),
        access_token_expires_at: '2026-10-11T03:41:05.073Z',
      },
    }),
    readOrderList: async () => { listCalls += 1; throw new Error('must not call Shopee'); },
  });

  const result = await reader({
    timeFrom: 1760270400,
    timeTo: 1760274000,
    pageSize: 5,
  });

  assert.deepEqual(result, {
    ok: false,
    code: 'refresh_token_expired',
    shop_id: SHOP_ID,
  });
  assert.equal(listCalls, 0);
});

test('reads one small Live order window and persists only Raw list/detail snapshots', async () => {
  const listSnapshots = [];
  const orderSnapshots = [];
  let detailArgs;

  const reader = createShopeeLiveOrdersReader({
    getEnv: env,
    now: (() => {
      let value = Date.parse('2026-10-12T16:00:00.000Z');
      return () => (value += 10);
    })(),
    readConnection: async () => ({
      ok: true,
      payload: {
        partner_id: Number(PARTNER_ID),
        shop_id: SHOP_ID,
        access_token_ciphertext: encryptTokenForTest('live-access-token'),
        access_token_expires_at: '2026-10-12T20:00:00.000Z',
      },
    }),
    readOrderList: async (args) => {
      assert.equal(args.shopId, SHOP_ID);
      assert.equal(args.pageSize, 5);
      assert.equal(args.accessToken, 'live-access-token');
      return response({
        error: '',
        message: '',
        request_id: 'req-list',
        response: {
          more: false,
          next_cursor: '',
          order_list: [
            { order_sn: '260101AAA' },
            { order_sn: '260101BBB' },
          ],
        },
      });
    },
    readOrderDetail: async (args) => {
      detailArgs = args;
      return response({
        error: '',
        message: '',
        request_id: 'req-detail',
        response: {
          order_list: [
            { order_sn: '260101AAA', order_status: 'READY_TO_SHIP', item_list: [{ item_id: 10, model_id: 20 }] },
            { order_sn: '260101BBB', order_status: 'COMPLETED', item_list: [{ item_id: 30, model_id: 40 }] },
          ],
        },
      });
    },
    persistOrderListSnapshot: async (payload) => { listSnapshots.push(payload); return { ok: true }; },
    persistOrderSnapshot: async (payload) => { orderSnapshots.push(payload); return { ok: true }; },
    logger: () => {},
  });

  const result = await reader({
    timeFrom: 1760270400,
    timeTo: 1760274000,
    pageSize: 5,
  });

  assert.equal(result.ok, true);
  assert.equal(result.listed_count, 2);
  assert.equal(result.detailed_count, 2);
  assert.equal(result.more, false);

  assert.equal(listSnapshots.length, 1);
  assert.equal(listSnapshots[0].channel_account_id, CHANNEL_ACCOUNT_ID);
  assert.match(listSnapshots[0].external_entity_id, /^create_time:/);
  assert.equal(listSnapshots[0].request_id, 'req-list');
  assert.equal(typeof listSnapshots[0].payload_hash, 'string');
  assert.equal(listSnapshots[0].payload_hash.length, 64);

  assert.deepEqual(detailArgs.orderSnList, ['260101AAA', '260101BBB']);
  assert.ok(detailArgs.responseOptionalFields.includes('item_list'));
  assert.ok(detailArgs.responseOptionalFields.includes('recipient_address'));
  assert.deepEqual(detailArgs.responseOptionalFields, [
    'item_list', 'package_list', 'shipping_carrier', 'payment_method',
    'total_amount', 'pay_time', 'recipient_address',
  ]);

  assert.equal(orderSnapshots.length, 2);
  assert.deepEqual(orderSnapshots.map((row) => row.external_entity_id), ['260101AAA', '260101BBB']);
  assert.deepEqual(
    orderSnapshots.map((row) => row.payload.response.order_list.length),
    [1, 1],
  );
  assert.deepEqual(orderSnapshots.map((row) => row.payload.response.order_list[0].item_list), [
    [{ item_id: 10, model_id: 20 }], [{ item_id: 30, model_id: 40 }],
  ]);
  assert.deepEqual(orderSnapshots.map((row) => row.payload.response.order_list[0].order_status), [
    'READY_TO_SHIP', 'COMPLETED',
  ]);

  for (const snapshot of [...listSnapshots, ...orderSnapshots]) {
    for (const forbidden of ['order_id', 'order_items', 'inventory', 'financial_entry_id', 'contact_id']) {
      assert.equal(snapshot[forbidden], undefined);
    }
  }
});

test('does not persist detail snapshots when Shopee rejects get_order_detail', async () => {
  let persistedDetails = 0;
  const reader = createShopeeLiveOrdersReader({
    getEnv: env,
    now: () => Date.parse('2026-10-12T16:00:00.000Z'),
    readConnection: async () => ({
      ok: true,
      payload: {
        partner_id: Number(PARTNER_ID),
        shop_id: SHOP_ID,
        access_token_ciphertext: encryptTokenForTest('live-access-token'),
        access_token_expires_at: '2026-10-12T20:00:00.000Z',
      },
    }),
    readOrderList: async () => response({
      error: '',
      request_id: 'req-list',
      response: { more: false, order_list: [{ order_sn: '260101AAA' }] },
    }),
    readOrderDetail: async () => response({ error: 'error_auth', message: 'rejected', request_id: 'req-detail' }),
    persistOrderListSnapshot: async () => ({ ok: true }),
    persistOrderSnapshot: async () => { persistedDetails += 1; return { ok: true }; },
    logger: () => {},
  });

  const result = await reader({
    timeFrom: 1760270400,
    timeTo: 1760274000,
    pageSize: 5,
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'order_detail_rejected');
  assert.equal(persistedDetails, 0);
});
