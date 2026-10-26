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
              package_list: [{ package_number: 'PKG-123', logistics_status: 'LOGISTICS_READY' }],
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
    package_logistics_status: 'LOGISTICS_READY',
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


test('F6-O.1c fails closed when access token is expired and performs no refresh or persistence', async () => {
  let refreshCalls = 0;
  let persistCalls = 0;
  let decryptCalls = 0;
  let externalReads = 0;

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
    decryptToken: async () => {
      decryptCalls += 1;
      return 'must-not-decrypt';
    },
    refreshAccessToken: async () => {
      refreshCalls += 1;
      return { response: { ok: true }, payload: {} };
    },
    persistRefreshedConnection: async () => {
      persistCalls += 1;
      return { ok: true };
    },
    readOrderDetail: async () => {
      externalReads += 1;
      throw new Error('must not execute');
    },
    readShippingParameter: async () => {
      externalReads += 1;
      throw new Error('must not execute');
    },
    readShippingDocumentParameter: async () => {
      externalReads += 1;
      throw new Error('must not execute');
    },
  });

  const result = await inspect({ orderSn: '261013HKHWK3V7' });

  assert.deepEqual(result, {
    ok: false,
    code: 'access_token_expired_read_only',
    shop_id: 531736366,
  });
  assert.equal(refreshCalls, 0);
  assert.equal(persistCalls, 0);
  assert.equal(decryptCalls, 0);
  assert.equal(externalReads, 0);
});

test('F6-O confirms the pilot package status only for a unique matching package and order', async () => {
  const orderSn = '2610204FARAMB4';
  const packageNumber = 'OFG246153907178767';
  let returnedOrderSn = orderSn;
  let packages = [{
    package_number: packageNumber,
    logistics_status: 'LOGISTICS_READY',
    address: 'PRIVATE ADDRESS MUST NOT ESCAPE',
    buyer_phone: 'PRIVATE PHONE MUST NOT ESCAPE',
  }];
  let parameterCalls = 0;
  const inspect = createShopeeLiveLogisticsInspector({
    getEnv,
    now: () => Date.parse('2026-10-20T14:00:00Z'),
    readConnection: async () => ({
      ok: true,
      payload: {
        partner_id: 2047685,
        shop_id: 531736366,
        access_token_ciphertext: 'cipher',
        access_token_expires_at: '2026-10-20T19:25:40Z',
      },
    }),
    decryptToken: async () => 'test-access-token',
    readOrderDetail: async () => ({
      response: { ok: true, status: 200 },
      payload: { response: { order_list: [{
        order_sn: returnedOrderSn,
        order_status: 'READY_TO_SHIP',
        package_list: packages,
        invoice_data: { status: 'valid' },
      }] } },
    }),
    readShippingParameter: async () => {
      parameterCalls += 1;
      return {
        response: { ok: true, status: 200 },
        payload: { response: { info_needed: { dropoff: [] } } },
      };
    },
    readShippingDocumentParameter: async () => ({
      response: { ok: true, status: 200 },
      payload: { response: { result_list: [] } },
    }),
  });

  const valid = await inspect({ orderSn });
  assert.equal(valid.ok, true);
  assert.equal(valid.order.order_sn, orderSn);
  assert.equal(valid.order.package_number, packageNumber);
  assert.equal(valid.order.package_logistics_status, 'LOGISTICS_READY');
  assert.deepEqual(valid.shipping_parameter.info_needed, { dropoff: [] });
  assert.equal('package_list' in valid.order, false);
  assert.equal(JSON.stringify(valid).includes('PRIVATE ADDRESS'), false);
  assert.equal(JSON.stringify(valid).includes('PRIVATE PHONE'), false);

  // Two packages are ambiguous even if the first package has the expected number.
  packages = [
    { package_number: packageNumber, logistics_status: 'LOGISTICS_READY' },
    { package_number: 'OTHER-PACKAGE', logistics_status: 'LOGISTICS_PICKUP_RETRY' },
  ];
  const ambiguous = await inspect({ orderSn });
  assert.equal(ambiguous.order.package_logistics_status, null);

  // Do not forward arbitrary upstream strings that could contain private data.
  packages = [{ package_number: packageNumber, logistics_status: 'LOGISTICS_READY private-data' }];
  const invalid = await inspect({ orderSn });
  assert.equal(invalid.order.package_logistics_status, null);

  // An order identity mismatch must stop before reading shipping parameters.
  returnedOrderSn = 'OTHER-ORDER';
  const beforeMismatch = parameterCalls;
  const mismatch = await inspect({ orderSn });
  assert.deepEqual(mismatch, {
    ok: false, code: 'order_detail_identity_mismatch', shop_id: 531736366,
  });
  assert.equal(parameterCalls, beforeMismatch);
});

test('F6-Q.6D.2A retains sanitized detail checkpoint when shipping request throws', async () => {
  let documentsCalled = false;
  const inspect = createShopeeLiveLogisticsInspector({
    getEnv,
    now: () => Date.parse('2026-10-14T19:00:00.000Z'),
    readConnection: async () => ({
      ok: true,
      payload: {
        partner_id: 2047685, shop_id: 531736366,
        access_token_ciphertext: 'cipher-access',
        access_token_expires_at: '2026-10-14T23:00:00.000Z',
      },
    }),
    decryptToken: async () => 'access-token',
    readOrderDetail: async () => ({
      response: { ok: true, status: 200 },
      payload: { response: { order_list: [{
        order_sn: 'TEST-ORDER', order_status: 'READY_TO_SHIP',
        package_list: [{ package_number: 'PKG-001', logistics_status: 'LOGISTICS_READY', recipient_address: 'PRIVATE ADDRESS' }],
      }] } },
    }),
    readShippingParameter: async () => { throw new Error('PRIVATE TOKEN and PRIVATE ADDRESS'); },
    readShippingDocumentParameter: async () => { documentsCalled = true; throw new Error('Unexpected call'); },
  });
  const result = await inspect({ orderSn: 'TEST-ORDER' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'shipping_parameter_transport_failed');
  assert.equal(result.order.order_status, 'READY_TO_SHIP');
  assert.equal(result.order.package_count, 1);
  assert.equal(result.order.package_number, 'PKG-001');
  assert.equal(result.shipping_parameter.error, 'transport_or_parse_failure');
  assert.equal(result.shipping_document_parameter.attempted, false);
  assert.equal(documentsCalled, false);
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
});
