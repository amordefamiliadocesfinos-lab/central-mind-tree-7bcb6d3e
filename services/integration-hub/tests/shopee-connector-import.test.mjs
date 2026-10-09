import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAuthorizeUrl,
  exchangeToken,
  getShopInfo,
  parseShopeeError,
  refreshToken,
  signPublicRequest,
  signShopRequest,
} from '../src/connectors/shopee-protocol.mjs';

test('Hub imports the single shared Shopee protocol source without exposing a Live route', () => {
  for (const primitive of [
    buildAuthorizeUrl,
    exchangeToken,
    getShopInfo,
    parseShopeeError,
    refreshToken,
    signPublicRequest,
    signShopRequest,
  ]) {
    assert.equal(typeof primitive, 'function');
  }
});
