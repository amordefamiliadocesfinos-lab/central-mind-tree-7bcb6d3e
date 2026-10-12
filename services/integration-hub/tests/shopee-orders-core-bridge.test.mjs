import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CORE_BRIDGE_ACTIONS,
  CORE_BRIDGE_LIVE_CONTENT_TYPE,
  CORE_BRIDGE_URL,
  callCoreBridgeAction,
  readLiveShopeeOauthConnection,
  refreshLiveShopeeOauthConnection,
  upsertLiveShopeeOrderListSnapshot,
  upsertLiveShopeeOrderSnapshot,
} from '../src/core-bridge.mjs';
import {
  BRIDGE_LIVE_ACTIONS,
  createBridgeHandler,
} from '../../../supabase/functions/integration-core-bridge/handler.mjs';

const SECRET = 'synthetic-test-fixture-only-32-bytes-minimum';
const CHANNEL_ACCOUNT_ID = '8a8ad166-0317-4597-8be6-e43fb46b4d1b';
const PAYLOAD_HASH = 'b'.repeat(64);

function bridgeFetch(executeAction) {
  const handler = createBridgeHandler({
    getSecret: () => SECRET,
    checkCore: async () => true,
    executeAction,
    logger: () => {},
  });

  return async (url, options) => {
    assert.equal(url, CORE_BRIDGE_URL);
    assert.equal(options.headers['Content-Type'], CORE_BRIDGE_LIVE_CONTENT_TYPE);
    return handler(new Request(url, options));
  };
}

test('F6-B registers the localized Shopee Live Bridge actions', () => {
  for (const action of [
    'shopee.oauth_connection.read',
    'shopee.oauth_connection.refresh',
    'shopee.raw_order_list_snapshot.upsert',
    'shopee.raw_order_snapshot.upsert',
  ]) {
    assert.ok(BRIDGE_LIVE_ACTIONS.includes(action));
  }
});

test('OAuth connection read sends only channel_account_id and returns ciphertext metadata, never plaintext token fields', async () => {
  let observed;
  const result = await readLiveShopeeOauthConnection({
    channel_account_id: CHANNEL_ACCOUNT_ID,
  }, {
    url: CORE_BRIDGE_URL,
    secret: SECRET,
    logger: () => {},
    fetchImpl: bridgeFetch(async (payload) => {
      observed = payload;
      return {
        status: 200,
        body: {
          partner_id: 123456,
          shop_id: 987654,
          access_token_ciphertext: 'iv.access-ciphertext',
          refresh_token_ciphertext: 'iv.refresh-ciphertext',
          access_token_expires_at: '2026-10-12T18:00:00.000Z',
          refresh_token_expires_at: '2026-11-11T18:00:00.000Z',
          last_refreshed_at: '2026-10-12T14:00:00.000Z',
        },
      };
    }),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(observed, {
    action: CORE_BRIDGE_ACTIONS.SHOPEE_OAUTH_CONNECTION_READ,
    channel_account_id: CHANNEL_ACCOUNT_ID,
  });
  assert.equal(result.payload.partner_id, 123456);
  assert.equal(result.payload.shop_id, 987654);
  assert.equal(result.payload.access_token_ciphertext, 'iv.access-ciphertext');
  assert.equal(result.payload.refresh_token_ciphertext, 'iv.refresh-ciphertext');
  assert.equal(result.payload.access_token, undefined);
  assert.equal(result.payload.refresh_token, undefined);
  assert.equal(result.payload.environment, undefined);
  assert.equal(result.payload.request_id, result.requestId);
});

test('OAuth connection refresh sends only rotated ciphertexts and expirations, preserving metadata server-side', async () => {
  let observed;
  const data = {
    channel_account_id: CHANNEL_ACCOUNT_ID,
    access_token_ciphertext: 'iv.new-access-ciphertext',
    refresh_token_ciphertext: 'iv.new-refresh-ciphertext',
    access_token_expires_at: '2026-10-12T22:00:00.000Z',
    refresh_token_expires_at: '2026-11-11T18:00:00.000Z',
    last_refreshed_at: '2026-10-12T18:00:00.000Z',
  };
  const result = await refreshLiveShopeeOauthConnection(data, {
    url: CORE_BRIDGE_URL,
    secret: SECRET,
    logger: () => {},
    fetchImpl: bridgeFetch(async (payload) => {
      observed = payload;
      return { status: 200, body: { status: 'ok', action: payload.action } };
    }),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(observed, {
    action: CORE_BRIDGE_ACTIONS.SHOPEE_OAUTH_CONNECTION_REFRESH,
    ...data,
  });
  for (const forbidden of ['partner_id', 'shop_id', 'shop_name', 'region', 'shop_status', 'environment']) {
    assert.equal(observed[forbidden], undefined);
  }
});

test('OAuth connection refresh rejects caller attempts to overwrite connection identity or metadata', async () => {
  let executions = 0;
  const result = await callCoreBridgeAction({
    action: CORE_BRIDGE_ACTIONS.SHOPEE_OAUTH_CONNECTION_REFRESH,
    data: {
      channel_account_id: CHANNEL_ACCOUNT_ID,
      access_token_ciphertext: 'iv.new-access-ciphertext',
      refresh_token_ciphertext: 'iv.new-refresh-ciphertext',
      access_token_expires_at: '2026-10-12T22:00:00.000Z',
      refresh_token_expires_at: '2026-11-11T18:00:00.000Z',
      last_refreshed_at: '2026-10-12T18:00:00.000Z',
      shop_id: 999,
    },
    url: CORE_BRIDGE_URL,
    secret: SECRET,
    logger: () => {},
    fetchImpl: bridgeFetch(async () => {
      executions += 1;
      return { status: 200, body: {} };
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
  assert.equal(executions, 0);
});

test('OAuth connection read rejects caller-controlled environment and extra fields before Core execution', async () => {
  let executions = 0;
  const result = await callCoreBridgeAction({
    action: CORE_BRIDGE_ACTIONS.SHOPEE_OAUTH_CONNECTION_READ,
    data: {
      channel_account_id: CHANNEL_ACCOUNT_ID,
      environment: 'sandbox',
    },
    url: CORE_BRIDGE_URL,
    secret: SECRET,
    logger: () => {},
    fetchImpl: bridgeFetch(async () => {
      executions += 1;
      return { status: 200, body: {} };
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
  assert.equal(executions, 0);
});

test('order list Raw Snapshot sends only the approved six evidence fields', async () => {
  let observed;
  const snapshot = {
    channel_account_id: CHANNEL_ACCOUNT_ID,
    external_entity_id: 'window:1760270400-1760274000:cursor-root',
    request_id: 'req-order-list',
    observed_at: '2026-10-12T15:00:00.000Z',
    payload: { response: { order_list: [{ order_sn: '260101ABCDEF' }] } },
    payload_hash: PAYLOAD_HASH,
  };

  const result = await upsertLiveShopeeOrderListSnapshot(snapshot, {
    url: CORE_BRIDGE_URL,
    secret: SECRET,
    logger: () => {},
    fetchImpl: bridgeFetch(async (payload) => {
      observed = payload;
      return { status: 200, body: { status: 'ok', action: payload.action } };
    }),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(observed, {
    action: CORE_BRIDGE_ACTIONS.SHOPEE_RAW_ORDER_LIST_SNAPSHOT_UPSERT,
    ...snapshot,
  });
  for (const forbidden of ['source', 'environment', 'external_entity_type', 'endpoint']) {
    assert.equal(observed[forbidden], undefined);
  }
});

test('order detail Raw Snapshot accepts alphanumeric order_sn identity and sends no operational projection fields', async () => {
  let observed;
  const snapshot = {
    channel_account_id: CHANNEL_ACCOUNT_ID,
    external_entity_id: '260101ABCDEF',
    request_id: 'req-order-detail',
    observed_at: '2026-10-12T15:01:00.000Z',
    payload: {
      response: {
        order_list: [{ order_sn: '260101ABCDEF', order_status: 'READY_TO_SHIP' }],
      },
    },
    payload_hash: PAYLOAD_HASH,
  };

  const result = await upsertLiveShopeeOrderSnapshot(snapshot, {
    url: CORE_BRIDGE_URL,
    secret: SECRET,
    logger: () => {},
    fetchImpl: bridgeFetch(async (payload) => {
      observed = payload;
      return { status: 200, body: { status: 'ok', action: payload.action } };
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(observed.external_entity_id, '260101ABCDEF');
  for (const forbidden of ['order_id', 'order_items', 'inventory', 'financial_entry_id', 'contact_id']) {
    assert.equal(observed[forbidden], undefined);
  }
});

test('order Raw Snapshot actions reject caller attempts to override server-fixed metadata', async () => {
  for (const action of [
    CORE_BRIDGE_ACTIONS.SHOPEE_RAW_ORDER_LIST_SNAPSHOT_UPSERT,
    CORE_BRIDGE_ACTIONS.SHOPEE_RAW_ORDER_SNAPSHOT_UPSERT,
  ]) {
    let executions = 0;
    const result = await callCoreBridgeAction({
      action,
      data: {
        channel_account_id: CHANNEL_ACCOUNT_ID,
        external_entity_id: '260101ABCDEF',
        request_id: 'req',
        observed_at: '2026-10-12T15:00:00.000Z',
        payload: {},
        payload_hash: PAYLOAD_HASH,
        environment: 'sandbox',
        endpoint: '/attacker-controlled',
      },
      url: CORE_BRIDGE_URL,
      secret: SECRET,
      logger: () => {},
      fetchImpl: bridgeFetch(async () => {
        executions += 1;
        return { status: 200, body: {} };
      }),
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.equal(executions, 0);
  }
});
