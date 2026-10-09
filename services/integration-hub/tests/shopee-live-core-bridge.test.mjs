import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CORE_BRIDGE_ACTIONS,
  CORE_BRIDGE_LIVE_CONTENT_TYPE,
  CORE_BRIDGE_URL,
  callCoreBridgeAction,
  consumeLiveShopeeOauthState,
  createLiveShopeeOauthState,
  upsertLiveShopeeOauthConnection,
  upsertLiveShopeeShopSnapshot,
} from '../src/core-bridge.mjs';
import { createBridgeHandler } from '../../../supabase/functions/integration-core-bridge/handler.mjs';

const SECRET = 'synthetic-test-fixture-only-32-bytes-minimum';
const CHANNEL_ACCOUNT_ID = '8a8ad166-0317-4597-8be6-e43fb46b4d1b';
const STATE_HASH = 'a'.repeat(64);
const PAYLOAD_HASH = 'b'.repeat(64);

function bridgeFetch(executeAction, logs = []) {
  const handler = createBridgeHandler({
    getSecret: () => SECRET,
    checkCore: async () => true,
    executeAction,
    logger: (entry) => logs.push(entry),
  });
  return async (url, options) => {
    assert.equal(url, CORE_BRIDGE_URL);
    if (JSON.parse(options.body).action !== 'health') {
      assert.equal(options.headers['Content-Type'], CORE_BRIDGE_LIVE_CONTENT_TYPE);
    }
    return handler(new Request(url, options));
  };
}

test('Shopee Live OAuth state create uses the existing HMAC bridge and pins no environment in the Hub payload', async () => {
  let observed;
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const result = await createLiveShopeeOauthState({
    channel_account_id: CHANNEL_ACCOUNT_ID,
    state_hash: STATE_HASH,
    expires_at: expiresAt,
  }, {
    url: CORE_BRIDGE_URL,
    secret: SECRET,
    logger: () => {},
    fetchImpl: bridgeFetch(async (payload) => {
      observed = payload;
      return { status: 200, body: { status: 'ok', action: payload.action } };
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(observed.action, CORE_BRIDGE_ACTIONS.SHOPEE_OAUTH_STATE_CREATE);
  assert.equal(observed.channel_account_id, CHANNEL_ACCOUNT_ID);
  assert.equal(observed.environment, undefined);
});

test('Shopee Live OAuth state consume returns only the controlled channel account identity', async () => {
  const result = await consumeLiveShopeeOauthState({ state_hash: STATE_HASH }, {
    url: CORE_BRIDGE_URL,
    secret: SECRET,
    logger: () => {},
    fetchImpl: bridgeFetch(async (payload) => ({
      status: 200,
      body: {
        status: 'ok',
        action: payload.action,
        channel_account_id: CHANNEL_ACCOUNT_ID,
      },
    })),
  });

  assert.equal(result.ok, true);
  assert.equal(result.payload.channel_account_id, CHANNEL_ACCOUNT_ID);
  assert.equal(result.payload.request_id, result.requestId);
});

test('Bridge rejects caller-controlled environment before any Core operation', async () => {
  let executions = 0;
  const result = await callCoreBridgeAction({
    action: CORE_BRIDGE_ACTIONS.SHOPEE_OAUTH_STATE_CREATE,
    data: {
      channel_account_id: CHANNEL_ACCOUNT_ID,
      state_hash: STATE_HASH,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      environment: 'sandbox',
    },
    url: CORE_BRIDGE_URL,
    secret: SECRET,
    logger: () => {},
    fetchImpl: bridgeFetch(async () => {
      executions += 1;
      return { status: 200, body: { status: 'ok' } };
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
  assert.equal(executions, 0);
});

test('Shopee Live connection upsert accepts ciphertext only and never raw tokens', async () => {
  let observed;
  const now = new Date().toISOString();
  const result = await upsertLiveShopeeOauthConnection({
    channel_account_id: CHANNEL_ACCOUNT_ID,
    partner_id: 123456,
    shop_id: 987654,
    main_account_id: null,
    merchant_id: null,
    access_token_ciphertext: 'cipher.access',
    refresh_token_ciphertext: 'cipher.refresh',
    access_token_expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    refresh_token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    authorization_expires_at: null,
    shop_name: 'Viviane',
    region: 'BR',
    shop_status: 'NORMAL',
    last_authenticated_at: now,
    last_refreshed_at: null,
  }, {
    url: CORE_BRIDGE_URL,
    secret: SECRET,
    logger: () => {},
    fetchImpl: bridgeFetch(async (payload) => {
      observed = payload;
      return { status: 200, body: { status: 'ok', action: payload.action } };
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(observed.action, CORE_BRIDGE_ACTIONS.SHOPEE_OAUTH_CONNECTION_UPSERT);
  assert.equal(observed.access_token, undefined);
  assert.equal(observed.refresh_token, undefined);
  assert.equal(observed.access_token_ciphertext, 'cipher.access');
});

test('Shopee Live Raw Snapshot contract is restricted to a shop snapshot', async () => {
  let observed;
  const result = await upsertLiveShopeeShopSnapshot({
    channel_account_id: CHANNEL_ACCOUNT_ID,
    external_entity_id: '987654',
    request_id: 'shopee-request-1',
    observed_at: new Date().toISOString(),
    payload: { shop_name: 'Viviane', region: 'BR' },
    payload_hash: PAYLOAD_HASH,
  }, {
    url: CORE_BRIDGE_URL,
    secret: SECRET,
    logger: () => {},
    fetchImpl: bridgeFetch(async (payload) => {
      observed = payload;
      return { status: 200, body: { status: 'ok', action: payload.action } };
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(observed.action, CORE_BRIDGE_ACTIONS.SHOPEE_RAW_SHOP_SNAPSHOT_UPSERT);
  assert.equal(observed.endpoint, undefined);
  assert.equal(observed.environment, undefined);
  assert.equal(observed.source, undefined);
});

test('invalid Shopee Live payloads fail closed without executing a Core action', async () => {
  const cases = [
    {
      action: CORE_BRIDGE_ACTIONS.SHOPEE_OAUTH_STATE_CREATE,
      data: { channel_account_id: CHANNEL_ACCOUNT_ID, state_hash: 'bad', expires_at: new Date(Date.now() + 60_000).toISOString() },
    },
    {
      action: CORE_BRIDGE_ACTIONS.SHOPEE_OAUTH_CONNECTION_UPSERT,
      data: {
        channel_account_id: CHANNEL_ACCOUNT_ID,
        partner_id: 1,
        shop_id: 2,
        access_token_ciphertext: 'cipher',
        refresh_token_ciphertext: 'cipher',
        access_token_expires_at: null,
        refresh_token_expires_at: null,
        last_authenticated_at: 'not-a-date',
      },
    },
    {
      action: CORE_BRIDGE_ACTIONS.SHOPEE_RAW_SHOP_SNAPSHOT_UPSERT,
      data: {
        channel_account_id: CHANNEL_ACCOUNT_ID,
        external_entity_id: 'shop-not-numeric',
        observed_at: new Date().toISOString(),
        payload: {},
        payload_hash: PAYLOAD_HASH,
      },
    },
  ];

  for (const entry of cases) {
    let executions = 0;
    const result = await callCoreBridgeAction({
      ...entry,
      url: CORE_BRIDGE_URL,
      secret: SECRET,
      logger: () => {},
      fetchImpl: bridgeFetch(async () => {
        executions += 1;
        return { status: 200, body: { status: 'ok' } };
      }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.equal(executions, 0);
  }
});


test('Shopee Live profile permits a bounded payload above the legacy 1 KiB health limit', async () => {
  const largeValue = 'x'.repeat(2048);
  const result = await upsertLiveShopeeShopSnapshot({
    channel_account_id: CHANNEL_ACCOUNT_ID,
    external_entity_id: '987654',
    request_id: 'large-snapshot',
    observed_at: new Date().toISOString(),
    payload: { shop_name: 'Viviane', extra: largeValue },
    payload_hash: PAYLOAD_HASH,
  }, {
    url: CORE_BRIDGE_URL,
    secret: SECRET,
    logger: () => {},
    fetchImpl: bridgeFetch(async (payload) => ({
      status: 200,
      body: { status: 'ok', action: payload.action },
    })),
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
});
