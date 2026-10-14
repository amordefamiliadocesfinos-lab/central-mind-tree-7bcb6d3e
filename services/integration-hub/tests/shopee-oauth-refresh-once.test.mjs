import assert from 'node:assert/strict';
import test from 'node:test';

import { createShopeeOauthRefreshOnce } from '../src/shopee-oauth-refresh-once.mjs';

const ENV = {
  SHOPEE_LIVE_PARTNER_ID: '2047685',
  SHOPEE_LIVE_PARTNER_KEY: 'partner-key',
  SHOPEE_LIVE_CHANNEL_ACCOUNT_ID: '8a8ad166-0317-4597-8be6-e43fb46b4d1b',
  SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY: 'token-key',
};

const getEnv = (name) => ENV[name];

test('F6-O.1R performs exactly read -> refresh -> persist -> read', async () => {
  const calls = [];
  const snapshots = [
    {
      channel_account_id: ENV.SHOPEE_LIVE_CHANNEL_ACCOUNT_ID,
      partner_id: 2047685,
      shop_id: 531736366,
      access_token_ciphertext: 'enc-old-access',
      refresh_token_ciphertext: 'enc-old-refresh',
      access_token_expires_at: '2026-10-14T18:00:00.000Z',
      refresh_token_expires_at: '2026-11-14T18:00:00.000Z',
      last_refreshed_at: '2026-10-14T13:00:00.000Z',
    },
    {
      channel_account_id: ENV.SHOPEE_LIVE_CHANNEL_ACCOUNT_ID,
      partner_id: 2047685,
      shop_id: 531736366,
      access_token_expires_at: '2026-10-14T23:00:00.000Z',
      refresh_token_expires_at: '2026-11-13T19:00:00.000Z',
      last_refreshed_at: '2026-10-14T19:00:00.000Z',
    },
  ];
  let readIndex = 0;

  const run = createShopeeOauthRefreshOnce({
    getEnv,
    now: () => Date.parse('2026-10-14T19:00:00.000Z'),
    readConnection: async (input) => {
      calls.push(['read', input]);
      return { ok: true, payload: snapshots[readIndex++] };
    },
    decryptToken: async (ciphertext) => {
      calls.push(['decrypt', ciphertext]);
      return 'raw-refresh-token';
    },
    refreshAccessToken: async (input) => {
      calls.push(['refresh', input]);
      return {
        response: { ok: true, status: 200 },
        payload: {
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expire_in: 14400,
        },
      };
    },
    encryptToken: async (value) => {
      calls.push(['encrypt', value]);
      return `cipher:${value}`;
    },
    persistRefresh: async (payload) => {
      calls.push(['persist', payload]);
      return { ok: true };
    },
  });

  const result = await run();
  assert.equal(result.ok, true);
  assert.equal(result.code, 'oauth_refreshed');
  assert.equal(result.before.shop_id, 531736366);
  assert.equal(result.after.shop_id, 531736366);

  assert.equal(calls.filter(([name]) => name === 'read').length, 2);
  assert.equal(calls.filter(([name]) => name === 'refresh').length, 1);
  assert.equal(calls.filter(([name]) => name === 'persist').length, 1);

  const persist = calls.find(([name]) => name === 'persist')[1];
  assert.equal(persist.channel_account_id, ENV.SHOPEE_LIVE_CHANNEL_ACCOUNT_ID);
  assert.equal(persist.access_token_ciphertext, 'cipher:new-access');
  assert.equal(persist.refresh_token_ciphertext, 'cipher:new-refresh');
  assert.equal(persist.access_token_expires_at, '2026-10-14T23:00:00.000Z');
  assert.equal(persist.last_refreshed_at, '2026-10-14T19:00:00.000Z');

  assert.equal(JSON.stringify(result).includes('new-access'), false);
  assert.equal(JSON.stringify(result).includes('new-refresh'), false);
  assert.equal(JSON.stringify(result).includes('raw-refresh-token'), false);
});

test('F6-O.1R fails closed when refresh token is expired', async () => {
  let decrypts = 0;
  let refreshes = 0;
  let persists = 0;

  const run = createShopeeOauthRefreshOnce({
    getEnv,
    now: () => Date.parse('2026-10-14T19:00:00.000Z'),
    readConnection: async () => ({
      ok: true,
      payload: {
        channel_account_id: ENV.SHOPEE_LIVE_CHANNEL_ACCOUNT_ID,
        partner_id: 2047685,
        shop_id: 531736366,
        refresh_token_ciphertext: 'enc-old-refresh',
        access_token_expires_at: '2026-10-14T18:00:00.000Z',
        refresh_token_expires_at: '2026-10-14T18:59:59.000Z',
      },
    }),
    decryptToken: async () => { decrypts += 1; return 'no'; },
    refreshAccessToken: async () => { refreshes += 1; return {}; },
    persistRefresh: async () => { persists += 1; return {}; },
  });

  const result = await run();
  assert.equal(result.ok, false);
  assert.equal(result.code, 'refresh_token_expired');
  assert.equal(decrypts, 0);
  assert.equal(refreshes, 0);
  assert.equal(persists, 0);
});

test('F6-O.1R rejects partner identity mismatch before token use', async () => {
  let decrypts = 0;
  const run = createShopeeOauthRefreshOnce({
    getEnv,
    now: () => Date.parse('2026-10-14T19:00:00.000Z'),
    readConnection: async () => ({
      ok: true,
      payload: {
        channel_account_id: ENV.SHOPEE_LIVE_CHANNEL_ACCOUNT_ID,
        partner_id: 9999999,
        shop_id: 531736366,
        refresh_token_ciphertext: 'enc-old-refresh',
        refresh_token_expires_at: '2026-11-14T18:00:00.000Z',
      },
    }),
    decryptToken: async () => { decrypts += 1; return 'no'; },
  });

  const result = await run();
  assert.equal(result.ok, false);
  assert.equal(result.code, 'partner_id_mismatch');
  assert.equal(decrypts, 0);
});
