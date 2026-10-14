import assert from 'node:assert/strict';
import test from 'node:test';

import { createShopeeLiveLogisticsInspector } from '../src/shopee-live-logistics.mjs';

const env = {
  SHOPEE_LIVE_PARTNER_ID: '2047685',
  SHOPEE_LIVE_PARTNER_KEY: 'partner-key',
  SHOPEE_LIVE_CHANNEL_ACCOUNT_ID: '8a8ad166-0317-4597-8be6-e43fb46b4d1b',
  SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY: '01234567890123456789012345678901',
};

function getEnv(name) {
  return env[name];
}

test('F6-O.1b inspects invoice and logistics parameters without mutation', async () => {
  const calls = [];
  const inspect = createShopeeLiveLogisticsInspector({
    getEnv,
    now: () => Date.parse('2026-10-14T19:00:00.000Z'),
    readConnection: async () => ({
      ok: true,
      payload: {
        partner_id: 2047685,
        shop_id: 531736366,
        access_token_ciphertext: 'cipher-access',
        refresh_token_ciphertext: 'cipher-refresh',
        access_token_expires_at: '2026-10-14T23:00:00.000Z',
        refresh_token_expires_at: '2026-11-14T23:00:00.000Z',
      },
    }),
    decryptToken: async (ciphertext) => ciphertext === 'cipher-access' ? 'access-token' : 'refresh-token',
    readOrderDetail: async (input) => {
      calls.push(['detail', input]);
      return {
        response: { ok: true, status: 200 },
        payload: {
          response: {
            order_list: [{
              order_sn: '261013HKHWK3V7',
              order_status: 'PROCESSED',
              shipping_carrier: 'SPX',
              package_list: [{ package_number: 'PKG-123' }],
              invoice_data: { status: 'valid', pending_reason: '' },
            }],
          },
        },
      };
    },
    readShippingParameter: async (input) => {
      calls.push(['shipping', input]);
      return {
        response: { ok: true, status: 200 },
        payload: {
          response: {
            info_needed: {
              pickup: ['address_id', 'pickup_time_id'],
              dropoff: [],
            },
            pickup: {
              address_list: [{ address_id: 1, address: 'PII must not escape' }],
            },
          },
        },
      };
    },
    readShippingDocumentParameter: async (input) => {
      calls.push(['document', input]);
      return {
        response: { ok: true, status: 200 },
        payload: {
          response: {
            result_list: [{
              order_sn: '261013HKHWK3V7',
              package_number: 'PKG-123',
              suggested_shipping_document_type: 'NORMAL_AIR_WAYBILL',
              selectable_shipping_document_type: ['NORMAL_AIR_WAYBILL', 'THERMAL_AIR_WAYBILL'],
              hidden: 'do-not-expose',
            }],
          },
        },
      };
    },
  });

  const result = await inspect({ orderSn: '261013HKHWK3V7' });

  assert.equal(result.ok, true);
  assert.deepEqual(result.order, {
    order_sn: '261013HKHWK3V7',
    order_status: 'PROCESSED',
    shipping_carrier: 'SPX',
    package_number: 'PKG-123',
    invoice_status: 'valid',
    invoice_pending_reason: '',
  });
  assert.deepEqual(result.shipping_parameter, {
    ok: true,
    error: null,
    info_needed: {
      pickup: ['address_id', 'pickup_time_id'],
      dropoff: [],
    },
  });
  assert.deepEqual(result.shipping_document_parameter.results, [{
    order_sn: '261013HKHWK3V7',
    package_number: 'PKG-123',
    suggested_shipping_document_type: 'NORMAL_AIR_WAYBILL',
    selectable_shipping_document_type: ['NORMAL_AIR_WAYBILL', 'THERMAL_AIR_WAYBILL'],
  }]);

  assert.equal(calls[0][0], 'detail');
  assert.deepEqual(calls[0][1].responseOptionalFields, [
    'package_list',
    'shipping_carrier',
    'invoice_data',
  ]);
  assert.equal(calls[1][0], 'shipping');
  assert.equal(calls[1][1].packageNumber, 'PKG-123');
  assert.equal(calls[2][0], 'document');
  assert.deepEqual(calls[2][1].orderList, [{
    order_sn: '261013HKHWK3V7',
    package_number: 'PKG-123',
  }]);

  assert.equal(JSON.stringify(result).includes('PII must not escape'), false);
  assert.equal(JSON.stringify(result).includes('hidden'), false);
});

test('F6-O.1b reports logistics endpoint rejection without failing the whole inspection', async () => {
  const inspect = createShopeeLiveLogisticsInspector({
    getEnv,
    now: () => Date.parse('2026-10-14T19:00:00.000Z'),
    readConnection: async () => ({
      ok: true,
      payload: {
        partner_id: 2047685,
        shop_id: 531736366,
        access_token_ciphertext: 'cipher-access',
        refresh_token_ciphertext: 'cipher-refresh',
        access_token_expires_at: '2026-10-14T23:00:00.000Z',
        refresh_token_expires_at: '2026-11-14T23:00:00.000Z',
      },
    }),
    decryptToken: async () => 'access-token',
    readOrderDetail: async () => ({
      response: { ok: true, status: 200 },
      payload: {
        response: {
          order_list: [{
            order_sn: '261013HKHWK3V7',
            order_status: 'PROCESSED',
            package_list: [],
          }],
        },
      },
    }),
    readShippingParameter: async () => ({
      response: { ok: false, status: 400 },
      payload: { error: 'error_param' },
    }),
    readShippingDocumentParameter: async () => ({
      response: { ok: true, status: 200 },
      payload: { response: { result_list: [] } },
    }),
  });

  const result = await inspect({ orderSn: '261013HKHWK3V7' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.shipping_parameter, {
    ok: false,
    error: 'error_param',
    info_needed: null,
  });
  assert.deepEqual(result.shipping_document_parameter, {
    ok: true,
    error: null,
    results: [],
  });
});

test('F6-O.1b refreshes token only through the existing OAuth persistence path', async () => {
  let refreshed = 0;
  let persisted = 0;
  const inspect = createShopeeLiveLogisticsInspector({
    getEnv,
    now: () => Date.parse('2026-10-14T19:00:00.000Z'),
    readConnection: async () => ({
      ok: true,
      payload: {
        partner_id: 2047685,
        shop_id: 531736366,
        access_token_ciphertext: 'cipher-old-access',
        refresh_token_ciphertext: 'cipher-refresh',
        access_token_expires_at: '2026-10-14T18:00:00.000Z',
        refresh_token_expires_at: '2026-11-14T23:00:00.000Z',
      },
    }),
    decryptToken: async (ciphertext) => ciphertext === 'cipher-refresh' ? 'refresh-token' : 'old-access',
    encryptToken: async (value) => `enc:${value}`,
    refreshAccessToken: async () => {
      refreshed += 1;
      return {
        response: { ok: true, status: 200 },
        payload: {
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expire_in: 14400,
        },
      };
    },
    persistRefreshedConnection: async (payload) => {
      persisted += 1;
      assert.equal(payload.access_token_ciphertext, 'enc:new-access');
      assert.equal(payload.refresh_token_ciphertext, 'enc:new-refresh');
      return { ok: true };
    },
    readOrderDetail: async (input) => {
      assert.equal(input.accessToken, 'new-access');
      return {
        response: { ok: true, status: 200 },
        payload: { response: { order_list: [{ order_sn: '261013HKHWK3V7' }] } },
      };
    },
    readShippingParameter: async () => ({
      response: { ok: true, status: 200 },
      payload: { response: { info_needed: {} } },
    }),
    readShippingDocumentParameter: async () => ({
      response: { ok: true, status: 200 },
      payload: { response: { result_list: [] } },
    }),
  });

  const result = await inspect({ orderSn: '261013HKHWK3V7' });
  assert.equal(result.ok, true);
  assert.equal(refreshed, 1);
  assert.equal(persisted, 1);
});
