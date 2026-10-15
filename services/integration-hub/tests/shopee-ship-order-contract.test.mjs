import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  buildSimpleDropoffRequest,
  shipOrderSimpleDropoff,
  getTrackingNumber,
} from '../src/connectors/shopee-protocol.mjs';
import { handleRequest } from '../src/app.mjs';

const base = {
  apiBaseUrl: 'https://partner.shopeemobile.com',
  partnerId: 2047685,
  partnerKey: 'synthetic-key',
  accessToken: 'synthetic-access-token',
  shopId: 531736366,
  orderSn: '261014HX0XSUQU',
  packageNumber: 'OFG245605119132474',
  timestamp: 1700000000,
};
const simpleDropoff = { dropoff: [] };

test('simple dropoff request includes exact order, package and empty dropoff object', () => {
  assert.deepEqual(buildSimpleDropoffRequest({
    orderSn: base.orderSn, packageNumber: base.packageNumber,
    infoNeeded: simpleDropoff,
  }), {
    order_sn: base.orderSn, package_number: base.packageNumber,
    dropoff: {},
  });
});

for (const infoNeeded of [
  undefined, null, {}, { pickup: [] },
  { dropoff: ['sender_real_name'] }, { dropoff: ['branch_id'] },
  { dropoff: [], pickup: [] }, { dropoff: [] , non_integrated: [] },
  { dropoff: {} }, { dropoff: null }, { dropoff: '[]' },
]) {
  test('rejects unsupported shipping fields without arranging ' + JSON.stringify(infoNeeded), async () => {
    let invoked = 0;
    assert.throws(
      () => shipOrderSimpleDropoff({
        ...base, shipOrderPath: '/api/v2/logistics/ship_order',
        infoNeeded, fetchImpl: async () => { invoked++; throw Error('should not call'); },
      }),
      { name: 'TypeError' },
    );
    assert.equal(invoked, 0);
  });
}

for (const identity of [
  { orderSn: '' }, { orderSn: 'attacker/other' },
  { packageNumber: '' }, { packageNumber: '../other' }, { packageNumber: 'a'.repeat(101) },
]) {
  test('rejects malformed dropoff identity before signed POST', () => {
    assert.throws(() => buildSimpleDropoffRequest({
      orderSn: base.orderSn, packageNumber: base.packageNumber,
      infoNeeded: simpleDropoff, ...identity,
    }), { name: 'TypeError' });
  });
}

test('dropoff signed POST follows Shopee contract; no automatic invocation', async () => {
  const calls = [];
  const result = await shipOrderSimpleDropoff({
    ...base, shipOrderPath: '/api/v2/logistics/ship_order',
    infoNeeded: simpleDropoff,
    fetchImpl: async (url, options) => {
      calls.push({ url: new URL(url), options });
      return new Response(JSON.stringify({ error: '', message: '', response: {} }), {
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  assert.equal(calls.length, 1);
  const [{ url, options }] = calls;
  assert.equal(options.method, 'POST');
  assert.deepEqual(JSON.parse(options.body), {
    order_sn: base.orderSn, package_number: base.packageNumber,
    dropoff: {},
  });
  assert.equal(url.pathname, '/api/v2/logistics/ship_order');
  assert.equal(url.searchParams.get('partner_id'), '2047685');
  assert.equal(url.searchParams.get('shop_id'), '531736366');
  assert.equal(url.searchParams.get('access_token'), base.accessToken);
  const sign = createHmac('sha256', base.partnerKey)
    .update(base.partnerId + '/api/v2/logistics/ship_order' +
      base.timestamp + base.accessToken + base.shopId)
    .digest('hex');
  assert.equal(url.searchParams.get('sign'), sign);
  assert.equal(result.payload.error, '');
});

test('tracking query is signed GET and includes package number', async () => {
  const calls = [];
  await getTrackingNumber({
    ...base, getTrackingNumberPath: '/api/v2/logistics/get_tracking_number',
    fetchImpl: async (url, options) => {
      calls.push({ url: new URL(url), options });
      return new Response(JSON.stringify({ error: '', response: { tracking_number: '' } }), {
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(new Request(calls[0].url, calls[0].options).method, 'GET');
  assert.equal(calls[0].options.body, undefined);
  assert.equal(calls[0].url.searchParams.get('order_sn'), base.orderSn);
  assert.equal(calls[0].url.searchParams.get('package_number'), base.packageNumber);
  const sign = createHmac('sha256', base.partnerKey)
    .update(base.partnerId + '/api/v2/logistics/get_tracking_number' +
      base.timestamp + base.accessToken + base.shopId)
    .digest('hex');
  assert.equal(calls[0].url.searchParams.get('sign'), sign);
});

test('ship_order route remains disabled by default before reaching library', async () => {
  const path = '/internal/shopee/live/logistics/shipping/ship-once';
  const result = await handleRequest({ method: 'POST', path, query: {} }, {
    handleShopeeLive: async () => null,
  });
  assert.equal(result.status, 503);
});

for (const extra of [{ pickup: {} }, { dropoff: { branch_id: 123 } }, { body: {} }, { query: {} }]) {
  test('rejects extra primitive parameters before any transport: ' + Object.keys(extra)[0], () => {
    let count = 0;
    const fetchImpl = async () => { count++; throw Error('must not execute'); };
    assert.throws(() => shipOrderSimpleDropoff({
      ...base, shipOrderPath: '/api/v2/logistics/ship_order', infoNeeded: simpleDropoff,
      fetchImpl, ...extra,
    }), TypeError);
    assert.throws(() => getTrackingNumber({
      ...base, getTrackingNumberPath: '/api/v2/logistics/get_tracking_number', fetchImpl, ...extra,
    }), TypeError);
    assert.equal(count, 0);
  });
}

test('request builder rejects additional operational fields', () => {
  assert.throws(() => buildSimpleDropoffRequest({
    orderSn: base.orderSn, packageNumber: base.packageNumber,
    infoNeeded: simpleDropoff, pickup: {},
  }), TypeError);
});

test('uncertain ship response is never retried automatically', async () => {
  let count = 0;
  await assert.rejects(shipOrderSimpleDropoff({
    ...base, shipOrderPath: '/api/v2/logistics/ship_order', infoNeeded: simpleDropoff,
    fetchImpl: async () => { count++; throw Error('uncertain-response'); },
  }), /uncertain-response/);
  assert.equal(count, 1);
});

test('empty tracking remains empty and does not trigger another operation', async () => {
  let count = 0;
  const result = await getTrackingNumber({
    ...base, getTrackingNumberPath: '/api/v2/logistics/get_tracking_number',
    fetchImpl: async () => { count++; return new Response(JSON.stringify({ error: '', response: { tracking_number: '' } })); },
  });
  assert.equal(result.payload.response.tracking_number, '');
  assert.equal(count, 1);
});
