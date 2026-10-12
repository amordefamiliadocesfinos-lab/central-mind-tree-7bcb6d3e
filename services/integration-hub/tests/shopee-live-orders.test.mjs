import test from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';

import { createShopeeLiveOrdersReader } from '../src/shopee-live-orders.mjs';

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

test('fails closed before Shopee when stored access token is expired', async () => {
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
    code: 'access_token_expired',
    refresh_required: true,
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
  assert.ok(detailArgs.responseOptionalFields.includes('buyer_cpf_id'));

  assert.equal(orderSnapshots.length, 2);
  assert.deepEqual(orderSnapshots.map((row) => row.external_entity_id), ['260101AAA', '260101BBB']);
  assert.deepEqual(
    orderSnapshots.map((row) => row.payload.response.order_list.length),
    [1, 1],
  );

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
