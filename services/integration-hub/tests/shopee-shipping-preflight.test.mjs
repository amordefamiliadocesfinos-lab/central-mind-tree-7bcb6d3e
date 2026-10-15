import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createShopeeShippingPreflight,
  assessFiscalReadiness,
  summarizeShippingRequirements,
} from '../src/shopee-shipping-preflight.mjs';
import { handleRequest } from '../src/app.mjs';

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
    package_list: [{ package_number: PKG }],
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
