import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import {
  buildAuthorizeUrl,
  exchangeToken,
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
