import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CORE_BRIDGE_ACTIONS,
  CORE_BRIDGE_LIVE_CONTENT_TYPE,
  CORE_BRIDGE_URL,
  callCoreBridgeAction,
  createLiveShopeeOrder,
  readLiveShopeeOrderIntakeBatch,
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
    'shopee.order.create',
    'shopee.order_intake_batch.read',
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


test('F6-I order writer sends only the approved narrow payload', async () => {
  let observed;
  const data = {
    channel_account_id: CHANNEL_ACCOUNT_ID,
    marketplace_account: 'SHOPEE VIVIANE',
    order_number: '261014HX0XSUQU',
    order_date: '2026-10-14',
    total_value: 39.9,
    payment_method: 'Pix',
    external_status: 'READY_TO_SHIP',
    items: [{
      product_id: '92088a70-8cc0-40ef-a39d-564603df6866',
      variant_id: null,
      quantity: 1000,
      commercial_quantity: 1,
      physical_multiplier: 1000,
      unit_price: 39.9,
      external_item_key: 'code:SH-002-006|variation:1 kg',
      item_id: '58261505740',
      model_id: '149554569657',
      mapping_id: 'dbc15870-e45a-4fe5-a86b-114208d1b5ed',
      composition_position: 0,
    }],
  };

  const result = await createLiveShopeeOrder(data, {
    url: CORE_BRIDGE_URL,
    secret: SECRET,
    logger: () => {},
    fetchImpl: bridgeFetch(async (payload) => {
      observed = payload;
      return {
        status: 200,
        body: {
          status: 'ok',
          action: payload.action,
          order_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          separation_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          already_registered: false,
        },
      };
    }),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(observed, {
    action: CORE_BRIDGE_ACTIONS.SHOPEE_ORDER_CREATE,
    ...data,
  });
});

test('F6-I bridge rejects attempts to control internal state or side effects', async () => {
  const base = {
    channel_account_id: CHANNEL_ACCOUNT_ID,
    marketplace_account: 'SHOPEE VIVIANE',
    order_number: '261014HX0XSUQU',
    order_date: '2026-10-14',
    total_value: 39.9,
    payment_method: null,
    external_status: 'READY_TO_SHIP',
    items: [{
      product_id: '92088a70-8cc0-40ef-a39d-564603df6866',
      variant_id: null,
      quantity: 1000,
      commercial_quantity: 1,
      physical_multiplier: 1000,
      unit_price: null,
      external_item_key: 'code:SH-002-006|variation:1 kg',
      item_id: '58261505740',
      model_id: '149554569657',
      mapping_id: 'dbc15870-e45a-4fe5-a86b-114208d1b5ed',
      composition_position: 0,
    }],
  };

  for (const forbidden of [
    ['status', 'enviado'],
    ['operational_status', 'finalized'],
    ['order_type', 'production'],
    ['payment_status', 'pago'],
    ['stock_event', 'external_shipped'],
    ['financial_action', 'create'],
    ['crm_action', 'create'],
    ['contact_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    ['customer_name', 'synthetic'],
    ['inventory', {}],
    ['production_order', {}],
  ]) {
    let executions = 0;
    const result = await callCoreBridgeAction({
      action: CORE_BRIDGE_ACTIONS.SHOPEE_ORDER_CREATE,
      data: { ...base, [forbidden[0]]: forbidden[1] },
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

test('F6-I bridge rejects incoherent physical quantity before Core execution', async () => {
  let executions = 0;
  const result = await createLiveShopeeOrder({
    channel_account_id: CHANNEL_ACCOUNT_ID,
    marketplace_account: 'SHOPEE VIVIANE',
    order_number: '261014HX0XSUQU',
    order_date: '2026-10-14',
    total_value: 39.9,
    payment_method: null,
    external_status: 'READY_TO_SHIP',
    items: [{
      product_id: '92088a70-8cc0-40ef-a39d-564603df6866',
      variant_id: null,
      quantity: 999,
      commercial_quantity: 1,
      physical_multiplier: 1000,
      unit_price: null,
      external_item_key: 'code:SH-002-006|variation:1 kg',
      item_id: '58261505740',
      model_id: '149554569657',
      mapping_id: 'dbc15870-e45a-4fe5-a86b-114208d1b5ed',
      composition_position: 0,
    }],
  }, {
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

function f6iValidRequest() {
  return { channel_account_id: CHANNEL_ACCOUNT_ID, marketplace_account: 'SHOPEE VIVIANE',
    order_number: 'F6I-TEST', order_date: '2026-10-14', total_value: 39.9,
    payment_method: null, external_status: 'PROCESSED', items: [{
      product_id: '92088a70-8cc0-40ef-a39d-564603df6866', variant_id: null,
      quantity: 1000, commercial_quantity: 1, physical_multiplier: 1000,
      unit_price: null, external_item_key: 'code:SH-002-006|variation:1 kg',
      item_id: '58261505740', model_id: '149554569657',
      mapping_id: 'dbc15870-e45a-4fe5-a86b-114208d1b5ed', composition_position: 0,
    }] };
}

test('F6-I rejects extra item fields and invalid date, integer range and quantities before execution', async () => {
  for (const mutate of [
    p => { p.items[0].status = 'enviado'; },
    p => { p.order_date = '2026-02-30'; },
    p => { p.items = null; },
    p => { p.items[0].quantity = 2147483648; p.items[0].physical_multiplier = 2147483648; },
    p => { p.items[0].quantity = 1.5; },
    p => { p.items[0].commercial_quantity = 0; },
    p => { p.items[0].physical_multiplier = 0; },
  ]) {
    const p = f6iValidRequest(); mutate(p);
    let executions = 0;
    const r = await createLiveShopeeOrder(p, { url: CORE_BRIDGE_URL, secret: SECRET, logger: () => {},
      fetchImpl: bridgeFetch(async () => { executions += 1; return {status:200,body:{}}; }),
    });
    assert.equal(r.status, 400); assert.equal(executions, 0);
  }
});

test('F6-I accepts coherent integer quantities within the defined numeric tolerance', async () => {
  for (const [quantity, multiplier] of [[2147483647, 2147483647], [1000, 1000.0000005]]) {
    const p = f6iValidRequest(); p.items[0].quantity = quantity; p.items[0].physical_multiplier = multiplier;
    let executions = 0;
    const r = await createLiveShopeeOrder(p, {url:CORE_BRIDGE_URL,secret:SECRET,logger:()=>{},
      fetchImpl:bridgeFetch(async payload => {executions += 1; return {status:200,body:{status:'ok',action:payload.action}};}),
    });
    assert.equal(r.status, 200); assert.equal(executions, 1);
  }
});


test('F6-J intake batch read sends only channel account and bounded limit', async () => {
  let observed;
  const largeMappings = Array.from({ length: 30 }, (_, index) => ({
    id: `mapping-${index}`,
    marketplace: 'shopee',
    marketplace_account: 'SHOPEE VIVIANE',
    external_item_key: `code:SH-TEST-${index}|variation:`,
    components: [],
  }));

  const result = await readLiveShopeeOrderIntakeBatch({
    channel_account_id: CHANNEL_ACCOUNT_ID,
    limit: 5,
  }, {
    url: CORE_BRIDGE_URL,
    secret: SECRET,
    logger: () => {},
    fetchImpl: bridgeFetch(async (payload) => {
      observed = payload;
      return {
        status: 200,
        body: {
          status: 'ok',
          action: payload.action,
          channel_account_id: CHANNEL_ACCOUNT_ID,
          marketplace_account: 'SHOPEE VIVIANE',
          eligible_statuses: ['PROCESSED', 'READY_TO_SHIP'],
          snapshots: [],
          mappings: largeMappings,
          counts: {
            selected: 0,
            skipped_existing: 1,
            skipped_status: 0,
            skipped_malformed: 0,
          },
        },
      };
    }),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(observed, {
    action: CORE_BRIDGE_ACTIONS.SHOPEE_ORDER_INTAKE_BATCH_READ,
    channel_account_id: CHANNEL_ACCOUNT_ID,
    limit: 5,
  });
  assert.equal(result.payload.mappings.length, 30);
});

test('F6-J intake batch read rejects caller-controlled eligibility filters and oversized limits', async () => {
  for (const data of [
    {
      channel_account_id: CHANNEL_ACCOUNT_ID,
      limit: 5,
      eligible_statuses: ['COMPLETED'],
    },
    {
      channel_account_id: CHANNEL_ACCOUNT_ID,
      limit: 21,
    },
  ]) {
    let executions = 0;
    const result = await callCoreBridgeAction({
      action: CORE_BRIDGE_ACTIONS.SHOPEE_ORDER_INTAKE_BATCH_READ,
      data,
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
