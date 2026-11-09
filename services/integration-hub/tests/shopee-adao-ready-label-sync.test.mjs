import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdaoReadyLabelSync } from '../src/shopee-adao-ready-label-sync.mjs';
import { handleRequest } from '../src/app.mjs';

const ORDER_SN = '261108PWWQ4K95';

const env = key => ({
  SHOPEE_ADAO_LABEL_SYNC_ENABLED: 'true',
  SHOPEE_LIVE_PARTNER_ID: '2047685',
  SHOPEE_LIVE_CHANNEL_ACCOUNT_ID: '8a8ad166-0317-4597-8be6-e43fb46b4d1b',
})[key];

test('real-use Adão label sync scopes account, shop and order; existing READY PDF is attached', async () => {
  let keys;
  let tombstoneCalls = 0;
  const orderSn = ORDER_SN;
  const sync = createAdaoReadyLabelSync({
    getEnv: env,
    readTombstones: async input => {
      tombstoneCalls++;
      assert.equal(input.channel_account_id, 'b4027369-5abf-4ac1-ab24-862334fae892');
      assert.deepEqual(input.order_sns, [orderSn]);
      return { ok: true, payload: { deleted_order_sns: [] } };
    },
    makeSync: options => {
      keys = options.getEnv;
      return async () => ({ ok: true, code: 'label_attached', document_id: 'official-pdf-id' });
    },
  });
  const result = await sync(orderSn);
  assert.deepEqual(result, { ok: true, code: 'label_attached', document_id: 'official-pdf-id' });
  assert.equal(tombstoneCalls, 1);
  assert.equal(keys('SHOPEE_LIVE_CHANNEL_ACCOUNT_ID'), 'b4027369-5abf-4ac1-ab24-862334fae892');
  assert.equal(keys('SHOPEE_LIVE_LABEL_ORDER_SN'), orderSn);
  assert.equal(keys('SHOPEE_LIVE_LABEL_SHOP_ID'), '1156446003');
  assert.equal(keys('SHOPEE_LIVE_LABEL_PACKAGE_NUMBER'), undefined);
});

test('malformed and tombstoned orders cannot fetch labels', async () => {
  let syncCalls = 0;
  const sync = createAdaoReadyLabelSync({
    getEnv: env,
    readTombstones: async () => ({ ok: true, payload: { deleted_order_sns: [ORDER_SN] } }),
    makeSync: () => { syncCalls++; return async () => ({ ok: true }); },
  });
  assert.equal((await sync('unknown-order')).code, 'invalid_order_identity');
  assert.equal((await sync(ORDER_SN)).code, 'order_deleted');
  assert.equal(syncCalls, 0);
});

test('new eligible order is not blocked by the retired pilot list', async () => {
  const newOrder = '261109TG59UDC7';
  let selectedOrder = null;
  const sync = createAdaoReadyLabelSync({
    getEnv: env,
    readTombstones: async input => {
      assert.equal(input.channel_account_id, 'b4027369-5abf-4ac1-ab24-862334fae892');
      assert.deepEqual(input.order_sns, [newOrder]);
      return { ok: true, payload: { deleted_order_sns: [] } };
    },
    makeSync: options => {
      selectedOrder = options.getEnv('SHOPEE_LIVE_LABEL_ORDER_SN');
      return async () => ({ ok: false, code: 'document_not_ready' });
    },
  });
  assert.deepEqual(await sync(newOrder), { ok: false, code: 'document_not_ready' });
  assert.equal(selectedOrder, newOrder);
});

test('Adão forwards only safe document-status diagnostics', async () => {
  const sync = createAdaoReadyLabelSync({
    getEnv: env,
    readTombstones: async () => ({ ok: true, payload: { deleted_order_sns: [] } }),
    makeSync: () => async () => ({
      ok: false, code: 'document_status_rejected',
      diagnostic: { upstream_http_status: 400, upstream_error_code: 'error_param',
        message: 'must-not-leak', access_token: 'hidden' },
    }),
  });
  assert.deepEqual(await sync(ORDER_SN), {
    ok: false, code: 'document_status_rejected',
    diagnostic: { upstream_http_status: 400, upstream_error_code: 'error_param' },
  });
});

test('Adão IAM route exposes only sanitized document rejection diagnostics', async () => {
  const path = '/internal/shopee/adao/logistics/label/sync-ready';
  const result = await handleRequest({
    path, method: 'POST', query: { order_sn: ORDER_SN },
    headers: { 'content-length': '0' },
  }, {
    handleShopeeLive: async () => null,
    syncAdaoLabel: async () => ({
      ok: false, code: 'document_status_rejected',
      diagnostic: { upstream_http_status: 400, upstream_error_code: 'error_param' },
    }),
  });
  assert.equal(result.status, 409);
  assert.deepEqual(JSON.parse(result.body), {
    status: 'blocked', account: 'adao', code: 'document_status_rejected',
    document_id: null,
    diagnostic: { upstream_http_status: 400, upstream_error_code: 'error_param' },
  });
});

test('one-time document preparation is available to scoped Adão orders', async () => {
  for (const order of [
    '261108PWWQ4K95', '261108PVDNUPFH', '261109TG59UDC7',
    '261109SWB8MAV2', '261108RCKAFSRX', '261107P3VANTS1',
  ]) {
    let creationEnabled = null;
    const sync = createAdaoReadyLabelSync({
      getEnv: env,
      readTombstones: async () => ({ ok: true, payload: { deleted_order_sns: [] } }),
      makeSync: options => {
        creationEnabled = options.prepareMissingDocument;
        return async () => ({ ok: false, code: 'document_not_ready' });
      },
    });
    assert.equal((await sync(order)).code, 'document_not_ready');
    assert.equal(creationEnabled, true);
  }
});

test('not-ready response is an explicit non-write failure', async () => {
  const sync = createAdaoReadyLabelSync({
    getEnv: env,
    readTombstones: async () => ({ ok: true, payload: { deleted_order_sns: [] } }),
    makeSync: () => async () => ({ ok: false, code: 'document_not_ready' }),
  });
  assert.deepEqual(await sync(ORDER_SN),
    { ok: false, code: 'document_not_ready' });
});

test('IAM route validates method, exact query and returns sanitized label result', async () => {
  const path = '/internal/shopee/adao/logistics/label/sync-ready';
  let calls = 0;
  const injection = {
    handleShopeeLive: async () => null,
    syncAdaoLabel: async orderSn => { calls++; assert.equal(orderSn, ORDER_SN);
      return { ok: true, code: 'label_attached', document_id: 'document-id' }; },
  };
  const req = { path, method: 'POST', query: { order_sn: ORDER_SN },
    headers: { 'content-length': '0' } };
  assert.equal((await handleRequest({ ...req, method: 'GET' }, injection)).status, 405);
  assert.equal((await handleRequest({ ...req, query: {} }, injection)).status, 400);
  assert.equal((await handleRequest({ ...req, body: 'anything' }, injection)).status, 400);
  const result = await handleRequest(req, injection);
  assert.equal(result.status, 200);
  assert.equal(JSON.parse(result.body).document_id, 'document-id');
  assert.equal(calls, 1);
});


test('Adão ignores inherited Viviane fixed package while retaining Shopee package validation', async () => {
  let scoped;
  const sync = createAdaoReadyLabelSync({
    getEnv: key => key === 'SHOPEE_LIVE_LABEL_PACKAGE_NUMBER' ? 'VIVIANE-OLD-PACKAGE' : env(key),
    readTombstones: async () => ({ ok: true, payload: { deleted_order_sns: [] } }),
    makeSync: options => { scoped = options.getEnv; return async () => ({ ok: false, code: 'document_not_ready' }); },
  });
  assert.equal((await sync(ORDER_SN)).code, 'document_not_ready');
  assert.equal(scoped('SHOPEE_LIVE_LABEL_PACKAGE_NUMBER'), undefined);
  assert.equal(scoped('SHOPEE_LIVE_CHANNEL_ACCOUNT_ID'), 'b4027369-5abf-4ac1-ab24-862334fae892');
});
