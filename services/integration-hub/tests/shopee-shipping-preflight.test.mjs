import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createShopeeShippingPreflight,
  assessFiscalReadiness,
  summarizeShippingRequirements,
} from '../src/shopee-shipping-preflight.mjs';
import { handleRequest } from '../src/app.mjs';
import { getShippingParameter } from '../src/connectors/shopee-protocol.mjs';
import { createHmac } from 'node:crypto';

const ORDER = '261014HX0XSUQU';
const ACCOUNT = '8a8ad166-0317-4597-8be6-e43fb46b4d1b';
const SHOP_ID = 531736366;
const PKG = 'OFG245605119132474';
const DEFAULT_ENV = {
  SHOPEE_LIVE_CHANNEL_ACCOUNT_ID: ACCOUNT,
  SHOPEE_LIVE_SHIPPING_PREFLIGHT_ORDER_SN: ORDER,
  SHOPEE_LIVE_SHIPPING_FISCAL_MODE: 'pj_shopee_issuer',
  SHOPEE_LIVE_PARTNER_ID: '2047685',
  SHOPEE_LIVE_PARTNER_KEY: 'test-key-not-real',
  SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY: 'test-encryption-key-not-real',
};
function fixture(overrides = {}) {
  const calls = [];
  const env = { ...DEFAULT_ENV, ...(overrides.env ?? {}) };
  const order = {
    order_sn: ORDER, order_status: 'READY_TO_SHIP',
    package_list: [{ package_number: PKG, logistics_status: 'LOGISTICS_READY' }],
    invoice_data: { status: 'valid' },
    ...overrides.order,
  };
  const opts = {
    getEnv: key => env[key],
    now: () => Date.parse('2026-10-15T18:00:00Z'),
    readConnection: async request => {
      calls.push(['oauth_read', request]);
      return { ok: true, payload: {
        partner_id: 2047685, shop_id: SHOP_ID,
        access_token_ciphertext: 'ciphertext',
        access_token_expires_at: '2026-10-15T22:00:00Z',
      } };
    },
    decryptToken: async () => {
      calls.push(['decrypt']);
      return 'fake-test-token';
    },
    readOrderDetail: async request => {
      calls.push(['order_detail', request]);
      return { response: { ok: true }, payload: { error: '', response: { order_list: [order] } } };
    },
    readShippingParameter: async request => {
      calls.push(['shipping_parameter', request]);
      return { response: { ok: true }, payload: {
        error: '', response: { info_needed: { dropoff: [] }, dropoff: { branch_list: [] } },
      } };
    },
    ...overrides.dependencies,
  };
  delete opts.env;
  delete opts.order;
  return { calls, run: createShopeeShippingPreflight(opts) };
}

test('pj valid READY_TO_SHIP only queries signed read paths; never ships or writes', async () => {
  const { calls, run } = fixture();
  const result = await run();
  assert.equal(result.ok, true);
  assert.equal(result.code, 'shipping_options_identified');
  assert.deepEqual(result.modes, ['dropoff']);
  assert.equal(result.fiscal, 'fiscal_valid');
  assert.equal(result.auto_arrangement_authorized, false);
  assert.deepEqual(calls.map(x => x[0]),
    ['oauth_read', 'decrypt', 'order_detail', 'shipping_parameter']);
  assert.equal(calls.at(-1)[1].packageNumber, PKG);
  assert.equal(calls.at(-1)[1].orderSn, ORDER);
  assert.equal(calls[0][1].channel_account_id, ACCOUNT);
  assert.equal(JSON.stringify(result).includes('ciphertext'), false);
});

test('PJ invoice pending cannot call shipping_parameter', async () => {
  const { calls, run } = fixture({ order: { invoice_data: { status: 'pending' } } });
  assert.equal((await run()).code, 'invoice_pending_in_seller_center');
  assert.equal(calls.some(x => x[0] === 'shipping_parameter'), false);
});

test('PJ missing fiscal validity blocks before logistics', async () => {
  const { calls, run } = fixture({ order: { invoice_data: undefined } });
  assert.equal((await run()).code, 'fiscal_not_confirmed_by_shopee');
  assert.equal(calls.some(x => x[0] === 'shipping_parameter'), false);
});

test('CPF mode skips Seller fiscal step only when explicitly configured', async () => {
  const { run } = fixture({
    env: { SHOPEE_LIVE_SHIPPING_FISCAL_MODE: 'cpf_no_invoice_step' },
    order: { invoice_data: undefined },
  });
  const result = await run();
  assert.equal(result.ok, true);
  assert.equal(result.fiscal, 'cpf_flow_fiscal_check_passed');
  assert.equal(result.auto_arrangement_authorized, false);
});

test('CPF with Shopee invoice pending still blocks', () => {
  assert.equal(assessFiscalReadiness({ invoice_data: { status: 'pending' } },
    'cpf_no_invoice_step').ready, false);
});

for (const mode of ['pj_shopee_issuer', 'cpf_no_invoice_step']) {
  for (const status of ['pending', 'valid']) {
    test(mode + ' fiscal ' + status + ' controls logistics consultation only', async () => {
      const { calls, run } = fixture({
        env: { SHOPEE_LIVE_SHIPPING_FISCAL_MODE: mode },
        order: { invoice_data: { status } },
      });
      const result = await run();
      assert.equal(result.ok, status === 'valid');
      assert.equal(calls.some(x => x[0] === 'shipping_parameter'), status === 'valid');
      assert.notEqual(result.auto_arrangement_authorized, true);
    });
  }
}

test('preflight uses real protocol GET, exact order/package and canonical HMAC', async () => {
  const observed = [];
  const { run } = fixture({ dependencies: {
    readShippingParameter: request => getShippingParameter({
      ...request,
      timestamp: 1700000000,
      fetchImpl: async (url, options) => {
        observed.push({ url: new URL(url), options });
        return new Response(JSON.stringify({ error: '', response: { info_needed: { dropoff: [] } } }),
          { headers: { 'content-type': 'application/json' } });
      },
    }),
  } });
  assert.equal((await run()).ok, true);
  assert.equal(observed.length, 1);
  const { url, options } = observed[0];
  assert.equal(new Request(url, options).method, 'GET');
  assert.equal(options.body, undefined);
  assert.equal(url.pathname, '/api/v2/logistics/get_shipping_parameter');
  assert.equal(url.searchParams.get('order_sn'), ORDER);
  assert.equal(url.searchParams.get('package_number'), PKG);
  const signature = createHmac('sha256', DEFAULT_ENV.SHOPEE_LIVE_PARTNER_KEY)
    .update('2047685/api/v2/logistics/get_shipping_parameter1700000000fake-test-token531736366')
    .digest('hex');
  assert.equal(url.searchParams.get('sign'), signature);
});

test('partner mismatch blocks before decryption and Shopee reads', async () => {
  const { calls, run } = fixture({ env: { SHOPEE_LIVE_PARTNER_ID: '999' } });
  assert.equal((await run()).code, 'partner_id_mismatch');
  assert.deepEqual(calls.map(x => x[0]), ['oauth_read']);
});

test('full preflight serialization excludes injected PII and secret material', async () => {
  const sensitive = 'SYNTHETIC-PRIVATE-DO-NOT-EXPOSE';
  const { run } = fixture({
    order: { recipient_address: { full_address: sensitive }, buyer_username: sensitive,
      invoice_data: { status: 'valid', access_key: sensitive } },
    dependencies: {
      readShippingParameter: async () => ({ response: { ok: true }, payload: { response: {
        info_needed: { pickup: ['address_id', 'pickup_time_id'] },
        pickup: { address_list: [{ address: sensitive }] }, secret: sensitive,
      } } }),
    },
  });
  const result = await run();
  assert.equal(result.ok, true);
  const serialized = JSON.stringify(result);
  for (const value of [sensitive, 'fake-test-token', 'ciphertext', DEFAULT_ENV.SHOPEE_LIVE_PARTNER_KEY]) {
    assert.equal(serialized.includes(value), false);
  }
});

for (const status of ['SHIPPED', 'PROCESSED', 'CANCELLED', 'COMPLETED']) {
  test('status ' + status + ' is not eligible for first arrangement preflight', async () => {
    const { calls, run } = fixture({ order: { order_status: status } });
    assert.equal((await run()).code, 'order_not_ready_to_ship');
    assert.equal(calls.some(x => x[0] === 'shipping_parameter'), false);
  });
}

test('multiple Shopee packages never silently select first', async () => {
  const { calls, run } = fixture({
    order: { package_list: [{ package_number: PKG }, { package_number: 'PK2' }] },
  });
  assert.equal((await run()).code, 'multiple_or_unknown_packages');
  assert.equal(calls.some(x => x[0] === 'shipping_parameter'), false);
});

for (const logisticsStatus of [
  'LOGISTICS_REQUEST_CREATED', 'LOGISTICS_PICKUP_DONE',
  'LOGISTICS_DELIVERY_DONE', 'LOGISTICS_REQUEST_CANCELED',
  'LOGISTICS_INVALID', 'UNKNOWN', undefined,
]) {
  test('package status ' + logisticsStatus + ' blocks before shipping_parameter', async () => {
    const { calls, run } = fixture({ order: {
      package_list: [{ package_number: PKG, logistics_status: logisticsStatus }],
    } });
    const result = await run();
    assert.equal(result.ok, false);
    assert.equal(calls.some(x => x[0] === 'shipping_parameter'), false);
  });
}

test('documented pickup-retry eligibility remains read-only', async () => {
  const { run } = fixture({ order: {
    package_list: [{ package_number: PKG, logistics_status: 'LOGISTICS_PICKUP_RETRY' }],
  } });
  const result = await run();
  assert.equal(result.ok, true);
  assert.equal(result.auto_arrangement_authorized, false);
});

test('missing package evidence cannot establish logistics eligibility', async () => {
  const { calls, run } = fixture({ order: { package_list: undefined } });
  assert.equal((await run()).ok, false);
  assert.equal(calls.some(x => x[0] === 'shipping_parameter'), false);
});

test('expired access token cannot decrypt, read Shopee or auto-refresh', async () => {
  let external = 0;
  const { run } = fixture({
    dependencies: {
      readConnection: async () => ({
        ok: true, payload: {
          partner_id: 2047685, shop_id: SHOP_ID,
          access_token_expires_at: '2026-10-15T16:00:00Z',
        },
      }),
      decryptToken: async () => { external++; throw Error('no decrypt'); },
      readOrderDetail: async () => { external++; throw Error('no order request'); },
    },
  });
  assert.equal((await run()).code, 'access_token_expired_read_only');
  assert.equal(external, 0);
});

test('incorrect order identity blocks before parameters', async () => {
  const { calls, run } = fixture({
    dependencies: {
      readOrderDetail: async () => ({
        response: { ok: true },
        payload: { response: { order_list: [{ order_sn: 'OTHER', order_status: 'READY_TO_SHIP' }] } },
      }),
    },
  });
  assert.equal((await run()).code, 'order_identity_mismatch');
  assert.equal(calls.some(x => x[0] === 'shipping_parameter'), false);
});

test('rejects error_param without claiming automatic readiness', async () => {
  const { run } = fixture({
    dependencies: {
      readShippingParameter: async () => ({
        response: { ok: true }, payload: { error: 'error_param' },
      }),
    },
  });
  assert.equal((await run()).code, 'shipping_parameter_rejected');
});

test('info_needed unknown fields cannot authorize shipping', () => {
  assert.equal(summarizeShippingRequirements({
    response: { info_needed: { unknown: [] } },
  }).code, 'unsupported_shipping_requirements');
  assert.equal(summarizeShippingRequirements({
    response: { info_needed: { pickup: { address_id: 123 } } },
  }).code, 'unrecognized_shipping_requirements');
  assert.equal(summarizeShippingRequirements({
    response: { info_needed: {} },
  }).code, 'shipping_mode_not_identified');
});

test('empty dropoff requirements are a valid choice requiring no extra fields', () => {
  const result = summarizeShippingRequirements({
    response: { info_needed: { dropoff: [] }, dropoff: {} },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.modes, ['dropoff']);
  assert.equal(result.autoArrangementAuthorized, false);
});

test('available shipping modes never authorize ship_order or mutate any state', () => {
  const result = summarizeShippingRequirements({
    response: {
      info_needed: { pickup: ['address_id', 'pickup_time_id'], dropoff: [] },
    },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.modes, ['dropoff', 'pickup']);
  assert.equal(result.autoArrangementAuthorized, false);
});

test('preflight endpoint defaults to disabled, disallows GET and query', async () => {
  let count = 0;
  const path = '/internal/shopee/live/logistics/shipping/preflight-once';
  const env = key => ({
    SHOPEE_LIVE_SHIPPING_PREFLIGHT_ENABLED: 'true',
    SHOPEE_LIVE_SHIPPING_PREFLIGHT_ORDER_SN: ORDER,
    SHOPEE_LIVE_SHIPPING_FISCAL_MODE: 'pj_shopee_issuer',
  })[key];
  const deps = {
    handleShopeeLive: async () => null,
    inspectShippingPreflight: async () => {
      count++;
      return { ok: true, code: 'shipping_options_identified', modes: ['dropoff'] };
    },
  };
  assert.equal((await handleRequest({ method: 'GET', path, query: {} }, { ...deps, getEnv: env })).status, 405);
  assert.equal((await handleRequest({ method: 'POST', path, query: {} }, { ...deps, getEnv: () => undefined })).status, 503);
  assert.equal((await handleRequest({ method: 'POST', path, query: { order_sn: ORDER } }, { ...deps, getEnv: env })).status, 400);
  assert.equal(count, 0);
  const answer = await handleRequest({ method: 'POST', path, query: {} }, { ...deps, getEnv: env });
  assert.equal(answer.status, 200);
  assert.deepEqual(JSON.parse(answer.body), {
    status: 'ok', mode: 'read_only', code: 'shipping_options_identified',
    order_status: null, fiscal: null, modes: ['dropoff'], auto_arrangement_authorized: false,
  });
  assert.equal(count, 1);
});
