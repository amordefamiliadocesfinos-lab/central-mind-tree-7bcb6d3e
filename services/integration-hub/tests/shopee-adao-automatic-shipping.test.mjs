import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdaoAutomaticShip, isAdaoNewShippingCandidate,
  ADAO_AUTO_SHIP_HISTORY_CUTOFF,
} from '../src/shopee-adao-automatic-shipping.mjs';

const ORDER = '261111AABBCCD';
test('new order boundary excludes all historical test orders', () => {
  assert.equal(isAdaoNewShippingCandidate({
    order_sn: ORDER, create_time: ADAO_AUTO_SHIP_HISTORY_CUTOFF,
  }), false);
  assert.equal(isAdaoNewShippingCandidate({
    order_sn: ORDER, create_time: ADAO_AUTO_SHIP_HISTORY_CUTOFF + 1,
  }), true);
  assert.equal(isAdaoNewShippingCandidate({
    order_sn: 'invalid/', create_time: ADAO_AUTO_SHIP_HISTORY_CUTOFF + 1,
  }), false);
});

test('automatic dispatch is off unless Adão flag is explicitly true', async () => {
  let calls = 0;
  const ship = createAdaoAutomaticShip({
    getEnv: () => undefined,
    makeShip: () => { calls++; return async () => ({ ok: true }); },
  });
  assert.equal((await ship(ORDER)).code, 'adao_auto_ship_disabled');
  assert.equal(calls, 0);
});

test('new Adão shipping reuses one-shot preflight, claim and identity contract', async () => {
  let env, scope, preflightCreated = 0, shipCalls = 0;
  const ship = createAdaoAutomaticShip({
    getEnv: k => k === 'SHOPEE_ADAO_AUTO_SHIP_ENABLED' ? 'true' : 'other-live',
    makePreflight: options => {
      preflightCreated++;
      env = options.getEnv;
      return async () => ({ ok: false });
    },
    makeShip: options => {
      scope = options.automaticScope;
      return async () => { shipCalls++; return {
        ok: true, code: 'ship_order_api_acknowledged_not_collected',
      }; };
    },
  });
  assert.deepEqual(await ship(ORDER), {
    ok: true, code: 'ship_order_api_acknowledged_not_collected',
  });
  assert.equal(preflightCreated, 1);
  assert.equal(shipCalls, 1);
  assert.equal(scope.orderSn, ORDER);
  assert.equal(scope.shopId, 1156446003);
  assert.equal(scope.fiscalMode, 'cpf_no_invoice_step');
  assert.equal(env('SHOPEE_LIVE_SHIPPING_PREFLIGHT_ORDER_SN'), ORDER);
  assert.equal(env('SHOPEE_LIVE_SHIP_ORDER_ENABLED'), 'true');
});
