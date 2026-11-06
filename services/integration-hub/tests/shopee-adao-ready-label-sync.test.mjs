import test from 'node:test';
import assert from 'node:assert/strict';
import { ADAO_LABEL_ORDER_SNS, createAdaoReadyLabelSync } from '../src/shopee-adao-ready-label-sync.mjs';
import { handleRequest } from '../src/app.mjs';

const env = key => ({
  SHOPEE_ADAO_LABEL_SYNC_ENABLED: 'true',
  SHOPEE_LIVE_PARTNER_ID: '2047685',
  SHOPEE_LIVE_CHANNEL_ACCOUNT_ID: '8a8ad166-0317-4597-8be6-e43fb46b4d1b',
})[key];

test('real-use Adão label sync scopes account, shop and order; existing READY PDF is attached', async () => {
  let keys;
  let tombstoneCalls = 0;
  const orderSn = ADAO_LABEL_ORDER_SNS[0];
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
});

test('unknown and tombstoned orders cannot fetch labels', async () => {
  let syncCalls = 0;
  const sync = createAdaoReadyLabelSync({
    getEnv: env,
    readTombstones: async () => ({ ok: true, payload: { deleted_order_sns: [ADAO_LABEL_ORDER_SNS[0]] } }),
    makeSync: () => { syncCalls++; return async () => ({ ok: true }); },
  });
  assert.equal((await sync('unknown-order')).code, 'order_not_approved');
  assert.equal((await sync(ADAO_LABEL_ORDER_SNS[0])).code, 'order_deleted');
  assert.equal(syncCalls, 0);
});

test('not-ready response is an explicit non-write failure', async () => {
  const sync = createAdaoReadyLabelSync({
    getEnv: env,
    readTombstones: async () => ({ ok: true, payload: { deleted_order_sns: [] } }),
    makeSync: () => async () => ({ ok: false, code: 'document_not_ready' }),
  });
  assert.deepEqual(await sync(ADAO_LABEL_ORDER_SNS[0]),
    { ok: false, code: 'document_not_ready' });
});

test('IAM route validates method, exact query and returns sanitized label result', async () => {
  const path = '/internal/shopee/adao/logistics/label/sync-ready';
  let calls = 0;
  const injection = {
    handleShopeeLive: async () => null,
    syncAdaoLabel: async orderSn => { calls++; assert.equal(orderSn, ADAO_LABEL_ORDER_SNS[0]);
      return { ok: true, code: 'label_attached', document_id: 'document-id' }; },
  };
  const req = { path, method: 'POST', query: { order_sn: ADAO_LABEL_ORDER_SNS[0] },
    headers: { 'content-length': '0' } };
  assert.equal((await handleRequest({ ...req, method: 'GET' }, injection)).status, 405);
  assert.equal((await handleRequest({ ...req, query: {} }, injection)).status, 400);
  assert.equal((await handleRequest({ ...req, body: 'anything' }, injection)).status, 400);
  const result = await handleRequest(req, injection);
  assert.equal(result.status, 200);
  assert.equal(JSON.parse(result.body).document_id, 'document-id');
  assert.equal(calls, 1);
});
