import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import {
  buildAuthorizeUrl,
  exchangeToken,
  getOrderDetail,
  getOrderList,
  getShopInfo,
  parseShopeeError,
  refreshToken,
  signPublicRequest,
  signShopRequest,
} from '../../../supabase/functions/_shared/shopee-protocol.mjs';

const partnerId = 1247042;
const partnerKey = 'test-partner-key';
const timestamp = 1700000000;

test('signPublicRequest preserves Shopee V2 public signature formula', async () => {
  const path = '/api/v2/auth/token/get';
  const expected = createHmac('sha256', partnerKey)
    .update(`${partnerId}${path}${timestamp}`)
    .digest('hex');

  assert.deepEqual(
    await signPublicRequest({ partnerId, partnerKey, path, timestamp }),
    { timestamp, sign: expected },
  );
});

test('signShopRequest preserves Shopee V2 shop signature formula', async () => {
  const path = '/api/v2/shop/get_shop_info';
  const accessToken = 'access-token';
  const shopId = 227959614;
  const expected = createHmac('sha256', partnerKey)
    .update(`${partnerId}${path}${timestamp}${accessToken}${shopId}`)
    .digest('hex');

  assert.deepEqual(
    await signShopRequest({ partnerId, partnerKey, path, accessToken, shopId, timestamp }),
    { timestamp, sign: expected },
  );
});

test('buildAuthorizeUrl preserves current Sandbox OAuth query semantics', () => {
  const url = buildAuthorizeUrl({
    authorizeUrl: 'https://open.sandbox.test-stable.shopee.com/auth',
    partnerId,
    redirectUri: 'https://example.test/api/shopee/oauth/callback',
    state: 'state-value',
  });

  assert.equal(url.searchParams.get('partner_id'), String(partnerId));
  assert.equal(url.searchParams.get('auth_type'), 'seller');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://example.test/api/shopee/oauth/callback');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('state'), 'state-value');
});

test('exchangeToken signs and posts the same token payload', async () => {
  let observed;
  const fetchImpl = async (url, init) => {
    observed = { url: new URL(url), init };
    return new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const result = await exchangeToken({
    apiBaseUrl: 'https://openplatform.sandbox.test-stable.shopee.sg',
    tokenPath: '/api/v2/auth/token/get',
    partnerId,
    partnerKey,
    code: 'code-value',
    shopId: 227959614,
    fetchImpl,
    timestamp,
  });

  assert.equal(observed.init.method, 'POST');
  assert.deepEqual(JSON.parse(observed.init.body), {
    code: 'code-value',
    partner_id: partnerId,
    shop_id: 227959614,
  });
  assert.equal(observed.url.searchParams.get('partner_id'), String(partnerId));
  assert.equal(observed.url.searchParams.get('timestamp'), String(timestamp));
  assert.ok(observed.url.searchParams.get('sign'));
  assert.equal(result.payload.access_token, 'a');
});

test('refreshToken signs and posts the same refresh payload', async () => {
  let body;
  const fetchImpl = async (_url, init) => {
    body = JSON.parse(init.body);
    return new Response(JSON.stringify({ access_token: 'next-a', refresh_token: 'next-r' }), { status: 200 });
  };

  const result = await refreshToken({
    apiBaseUrl: 'https://openplatform.sandbox.test-stable.shopee.sg',
    refreshPath: '/api/v2/auth/access_token/get',
    partnerId,
    partnerKey,
    refreshToken: 'refresh-value',
    shopId: 227959614,
    fetchImpl,
    timestamp,
  });

  assert.deepEqual(body, {
    partner_id: partnerId,
    refresh_token: 'refresh-value',
    shop_id: 227959614,
  });
  assert.equal(result.payload.refresh_token, 'next-r');
});

test('getShopInfo signs a shop-scoped GET and preserves raw response', async () => {
  let observed;
  const payload = { shop_name: 'Sandbox Shop', request_id: 'req-1' };
  const fetchImpl = async (url, init) => {
    observed = { url: new URL(url), init };
    return new Response(JSON.stringify(payload), { status: 200 });
  };

  const result = await getShopInfo({
    apiBaseUrl: 'https://openplatform.sandbox.test-stable.shopee.sg',
    shopInfoPath: '/api/v2/shop/get_shop_info',
    partnerId,
    partnerKey,
    accessToken: 'access-value',
    shopId: 227959614,
    fetchImpl,
    timestamp,
  });

  assert.equal(observed.init.headers.Accept, 'application/json');
  assert.equal(observed.url.searchParams.get('access_token'), 'access-value');
  assert.equal(observed.url.searchParams.get('shop_id'), '227959614');
  assert.ok(observed.url.searchParams.get('sign'));
  assert.deepEqual(result.payload, payload);
  assert.equal(result.rawText, JSON.stringify(payload));
});

test('parseShopeeError trims errors and ignores absent error fields', () => {
  assert.equal(parseShopeeError({ error: ' error_sign ' }), 'error_sign');
  assert.equal(parseShopeeError({ message: 'ok' }), '');
});


test('getOrderList signs shop request and emits only read-only list query parameters', async () => {
  let observed;
  const fetchImpl = async (url, init) => {
    observed = { url: new URL(url), init };
    return new Response(JSON.stringify({
      response: {
        more: false,
        next_cursor: '',
        order_list: [{ order_sn: '260101ABCDEF' }],
      },
      request_id: 'req-order-list',
    }), { status: 200 });
  };

  const result = await getOrderList({
    apiBaseUrl: 'https://partner.shopeemobile.com',
    orderListPath: '/api/v2/order/get_order_list',
    partnerId,
    partnerKey,
    accessToken: 'access-value',
    shopId: 531736366,
    timeRangeField: 'create_time',
    timeFrom: 1700000000,
    timeTo: 1700003600,
    pageSize: 20,
    cursor: 'cursor-1',
    orderStatus: 'READY_TO_SHIP',
    fetchImpl,
    timestamp,
  });

  assert.equal(observed.init.headers.Accept, 'application/json');
  assert.equal(observed.url.pathname, '/api/v2/order/get_order_list');
  assert.equal(observed.url.searchParams.get('time_range_field'), 'create_time');
  assert.equal(observed.url.searchParams.get('time_from'), '1700000000');
  assert.equal(observed.url.searchParams.get('time_to'), '1700003600');
  assert.equal(observed.url.searchParams.get('page_size'), '20');
  assert.equal(observed.url.searchParams.get('cursor'), 'cursor-1');
  assert.equal(observed.url.searchParams.get('order_status'), 'READY_TO_SHIP');
  assert.equal(observed.url.searchParams.get('shop_id'), '531736366');
  assert.ok(observed.url.searchParams.get('sign'));
  assert.equal(result.payload.response.order_list[0].order_sn, '260101ABCDEF');
});

test('getOrderDetail signs shop request and requests explicit optional fields', async () => {
  let observed;
  const fetchImpl = async (url, init) => {
    observed = { url: new URL(url), init };
    return new Response(JSON.stringify({
      response: { order_list: [{ order_sn: '260101ABCDEF', order_status: 'READY_TO_SHIP' }] },
      request_id: 'req-order-detail',
    }), { status: 200 });
  };

  const result = await getOrderDetail({
    apiBaseUrl: 'https://partner.shopeemobile.com',
    orderDetailPath: '/api/v2/order/get_order_detail',
    partnerId,
    partnerKey,
    accessToken: 'access-value',
    shopId: 531736366,
    orderSnList: ['260101ABCDEF', '260101UVWXYZ'],
    responseOptionalFields: ['item_list', 'recipient_address', 'buyer_username', 'total_amount'],
    fetchImpl,
    timestamp,
  });

  assert.equal(observed.init.headers.Accept, 'application/json');
  assert.equal(observed.url.pathname, '/api/v2/order/get_order_detail');
  assert.equal(observed.url.searchParams.get('order_sn_list'), '260101ABCDEF,260101UVWXYZ');
  assert.equal(
    observed.url.searchParams.get('response_optional_fields'),
    'item_list,recipient_address,buyer_username,total_amount',
  );
  assert.equal(observed.url.searchParams.get('shop_id'), '531736366');
  assert.ok(observed.url.searchParams.get('sign'));
  assert.equal(result.payload.response.order_list[0].order_sn, '260101ABCDEF');
});

test('getOrderList rejects inverted time windows before calling Shopee', async () => {
  await assert.rejects(
    getOrderList({
      apiBaseUrl: 'https://partner.shopeemobile.com',
      orderListPath: '/api/v2/order/get_order_list',
      partnerId,
      partnerKey,
      accessToken: 'access-value',
      shopId: 531736366,
      timeFrom: 1700003600,
      timeTo: 1700000000,
      pageSize: 20,
      fetchImpl: async () => { throw new Error('must not execute'); },
      timestamp,
    }),
    /timeTo must be greater than or equal to timeFrom/,
  );
});
