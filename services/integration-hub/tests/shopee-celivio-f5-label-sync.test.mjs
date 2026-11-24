import test from 'node:test';
import assert from 'node:assert/strict';
import { createCelivioPilotLabelSync } from '../src/shopee-celivio-f5-label-sync.mjs';
import { handleRequest } from '../src/app.mjs';

const ACCOUNT = 'd26c7a30-aa4a-4441-8012-600d70453689';
const ORDER = '261121TBS6BHE6';
const PACKAGE = 'OFG248906009827069';
const env = key => ({
  SHOPEE_CELIVIO_F5_LABEL_SYNC_ENABLED: 'true',
  SHOPEE_LIVE_CHANNEL_ACCOUNT_ID: ACCOUNT,
  SHOPEE_LIVE_PARTNER_ID: '2047685',
  SHOPEE_LIVE_LOGISTICS_PROBE_ORDER_SN: ORDER,
})[key];
const snapshot = () => ({
  ok: true,
  order: {
    order_sn: ORDER,
    order_status: 'PROCESSED',
    package_count: 1,
    package_number: PACKAGE,
    package_logistics_status: 'LOGISTICS_REQUEST_CREATED',
    shipping_carrier: 'Retirada pelo Comprador',
    invoice_status: 'valid',
  },
  shipping_document_parameter: {
    ok: true,
    results: [{
      order_sn: ORDER,
      package_number: PACKAGE,
      selectable_shipping_document_type: ['NORMAL_AIR_WAYBILL', 'THERMAL_AIR_WAYBILL'],
    }],
  },
});

test('Celivio F5 exact pilot reuses the existing Adão synchronizer with durable Core claim', async () => {
  let options;
  let observedOrder;
  const sync = createCelivioPilotLabelSync({
    getEnv: env,
    readTombstones: async data => {
      assert.deepEqual(data, { channel_account_id: ACCOUNT, order_sns: [ORDER] });
      return { ok: true, payload: { deleted_order_sns: [] } };
    },
    makeInspector: () => async data => {
      observedOrder = data.orderSn;
      return snapshot();
    },
    makeSync: input => {
      options = input;
      return async () => ({ ok: false, code: 'document_task_created_check_later' });
    },
  });
  assert.deepEqual(await sync(), { ok: false, code: 'document_task_created_check_later' });
  assert.equal(observedOrder, ORDER);
  assert.equal(options.prepareMissingDocument, true);
  assert.equal(options.getEnv('SHOPEE_LIVE_CHANNEL_ACCOUNT_ID'), ACCOUNT);
  assert.equal(options.getEnv('SHOPEE_LIVE_LABEL_SHOP_ID'), '1357031949');
  assert.equal(options.getEnv('SHOPEE_LIVE_LABEL_ORDER_SN'), ORDER);
  assert.equal(options.getEnv('SHOPEE_LIVE_LABEL_PACKAGE_NUMBER'), PACKAGE);
});

test('Celivio F5 refuses wrong account, disabled flag, and tombstoned order', async () => {
  let calls = 0;
  const injection = {
    makeInspector: () => { calls++; throw Error('no inspector on blocked scope'); },
    makeSync: () => { calls++; throw Error('no writer on blocked scope'); },
  };
  assert.equal((await createCelivioPilotLabelSync({
    ...injection, getEnv: key => key === 'SHOPEE_CELIVIO_F5_LABEL_SYNC_ENABLED' ? 'false' : env(key),
  })()).code, 'celivio_f5_label_sync_disabled');
  assert.equal((await createCelivioPilotLabelSync({
    ...injection, getEnv: key => key === 'SHOPEE_LIVE_CHANNEL_ACCOUNT_ID' ? 'wrong' : env(key),
  })()).code, 'celivio_f5_scope_mismatch');
  assert.equal((await createCelivioPilotLabelSync({
    ...injection, getEnv: env,
    readTombstones: async () => ({ ok: true, payload: { deleted_order_sns: [ORDER] } }),
  })()).code, 'order_deleted');
  assert.equal(calls, 0);
});

test('Celivio F5 fails closed on carrier, fiscal, package or shipment state differences', async () => {
  for (const change of [
    x => { x.order.shipping_carrier = 'SPX'; },
    x => { x.order.invoice_status = 'pending'; },
    x => { x.order.package_number = 'WRONG'; },
    x => { x.order.package_count = 2; },
    x => { x.order.order_status = 'SHIPPED'; },
    x => { x.order.package_logistics_status = 'LOGISTICS_PICKUP_DONE'; },
    x => { x.shipping_document_parameter.results[0].selectable_shipping_document_type = []; },
    x => { x.shipping_document_parameter.results[0].package_number = 'WRONG'; },
  ]) {
    let writers = 0;
    const state = snapshot(); change(state);
    const result = await createCelivioPilotLabelSync({
      getEnv: env,
      readTombstones: async () => ({ ok: true, payload: { deleted_order_sns: [] } }),
      makeInspector: () => async () => state,
      makeSync: () => { writers++; return async () => ({ ok: true }); },
    })();
    assert.equal(result.code, 'celivio_f5_live_state_not_eligible');
    assert.equal(writers, 0);
  }
});

test('Celivio F5 safely returns attached PDF and sanitizes upstream diagnostic', async () => {
  for (const result of [
    { ok: true, code: 'label_attached', document_id: 'official-document-id' },
    { ok: true, code: 'already_available', document_id: 'official-document-id' },
    { ok: false, code: 'document_status_rejected',
      diagnostic: { upstream_http_status: 400, upstream_error_code: 'error_param',
        access_token: 'SECRET' } },
  ]) {
    const sync = createCelivioPilotLabelSync({
      getEnv: env,
      readTombstones: async () => ({ ok: true, payload: { deleted_order_sns: [] } }),
      makeInspector: () => async () => snapshot(),
      makeSync: () => async () => result,
    });
    const out = await sync();
    assert.equal(out.code, result.code);
    assert.equal(JSON.stringify(out).includes('SECRET'), false);
    if (result.ok) assert.deepEqual(out, result);
  }
});

test('Celivio F5 route is default-off, no-body, private and exact-account', async () => {
  const path = '/internal/shopee/celivio/f5/label/sync-once';
  const request = { path, method: 'POST', query: {}, headers: { 'content-length': '0' } };
  let calls = 0;
  const make = (overrides = {}) => ({
    handleShopeeLive: async () => null,
    syncCelivioPilotLabel: async () => { calls++; return { ok: false, code: 'document_task_created_check_later' }; },
    getEnv: name => ({
      SHOPEE_CELIVIO_F5_LABEL_SYNC_ENABLED: 'false',
      SHOPEE_LIVE_CHANNEL_ACCOUNT_ID: ACCOUNT,
      SHOPEE_LIVE_LOGISTICS_PROBE_ORDER_SN: ORDER,
      ...overrides,
    })[name],
  });
  assert.equal((await handleRequest(request,make())).status,503);
  assert.equal((await handleRequest(request,make({ SHOPEE_CELIVIO_F5_LABEL_SYNC_ENABLED:'true',
    SHOPEE_LIVE_CHANNEL_ACCOUNT_ID:'other' }))).status,503);
  assert.equal((await handleRequest(request,make({ SHOPEE_CELIVIO_F5_LABEL_SYNC_ENABLED:'true',
    SHOPEE_LIVE_LOGISTICS_PROBE_ORDER_SN:'other' }))).status,503);
  const yes = make({ SHOPEE_CELIVIO_F5_LABEL_SYNC_ENABLED:'true' });
  assert.equal((await handleRequest({...request,method:'GET'},yes)).status,405);
  assert.equal((await handleRequest({...request,body:'{}'},yes)).status,400);
  assert.equal((await handleRequest({...request,query:{order_sn:ORDER}},yes)).status,400);
  assert.equal(calls,0);
  const response = await handleRequest(request,yes);
  assert.equal(response.status,409);
  assert.deepEqual(JSON.parse(response.body),{
    status:'blocked',account:'celivio',code:'document_task_created_check_later',document_id:null,
  });
  assert.equal(calls,1);
});
