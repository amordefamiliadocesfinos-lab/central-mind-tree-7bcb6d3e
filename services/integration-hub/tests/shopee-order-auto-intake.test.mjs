import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createShopeeControlledAutoIntake,
  SHOPEE_CONTROLLED_AUTO_INTAKE_CONTRACT,
} from '../src/shopee-order-auto-intake.mjs';

const CHANNEL_ACCOUNT_ID = '8a8ad166-0317-4597-8be6-e43fb46b4d1b';

function snapshot(orderSn = '261014HRQJ4QHT') {
  return {
    source: 'shopee_open_platform',
    environment: 'live',
    channel_account_id: CHANNEL_ACCOUNT_ID,
    external_entity_type: 'order',
    external_entity_id: orderSn,
    endpoint: '/api/v2/order/get_order_detail',
    observed_at: '2026-10-14T00:00:00.000Z',
    created_at: '2026-10-14T00:00:00.000Z',
    payload: {
      response: {
        order_list: [{
          order_sn: orderSn,
          order_status: 'PROCESSED',
          create_time: 1791932400,
          total_amount: 20.21,
          payment_method: 'Pix',
          item_list: [{
            item_id: '23298665306',
            model_id: '0',
            item_name: 'Alfajor 60g - Kit com 6 UNI. | SH-002-015',
            model_name: '',
            item_sku: '',
            model_sku: '',
            model_quantity_purchased: 1,
            model_original_price: 20.21,
            model_discounted_price: 20.21,
          }],
        }],
      },
    },
  };
}

function mapping() {
  return {
    id: 'ea54687e-cab8-481c-9b6f-cfd692f3c849',
    marketplace: 'shopee',
    marketplace_account: 'SHOPEE VIVIANE',
    external_item_key: 'code:SH-002-015|variation:',
    product_id: '62cf9f63-be04-4261-ad11-569028dd1125',
    variant_id: 'd89e1dba-ca80-4136-b9f3-225fb80b6dfb',
    physical_multiplier: 3,
    channel_account_id: CHANNEL_ACCOUNT_ID,
    components: [
      {
        product_id: '62cf9f63-be04-4261-ad11-569028dd1125',
        variant_id: 'd89e1dba-ca80-4136-b9f3-225fb80b6dfb',
        physical_multiplier: 3,
        position: 0,
      },
      {
        product_id: '62cf9f63-be04-4261-ad11-569028dd1125',
        variant_id: 'e4d756c8-f324-4ac0-b9ff-6adae24f5310',
        physical_multiplier: 3,
        position: 1,
      },
    ],
  };
}

function batchPayload(overrides = {}) {
  return {
    status: 'ok',
    action: 'shopee.order_intake_batch.read',
    channel_account_id: CHANNEL_ACCOUNT_ID,
    marketplace_account: 'SHOPEE VIVIANE',
    eligible_statuses: ['PROCESSED', 'READY_TO_SHIP'],
    snapshots: [snapshot()],
    mappings: [mapping()],
    counts: {
      selected: 1,
      skipped_existing: 0,
      skipped_status: 0,
      skipped_malformed: 0,
    },
    ...overrides,
  };
}

test('recurring intake requests exact raw order server-side and asks writer to verify existing canonical items', async () => {
  const target = 'SYNTHETIC001'; let request, options;
  const run = createShopeeControlledAutoIntake({
    readBatch: async data => { request = data; return { ok: true, payload: batchPayload({ snapshots: [snapshot(target)] }) }; },
    persistOrder: async (_contract, opts) => { options = opts; return { ok: true, payload: { order_id: 'synthetic', already_registered: true } }; },
  });
  const result = await run({ channelAccountId: CHANNEL_ACCOUNT_ID, limit: 1, mode: 'commit', expectedOrderSn: target, verifyExisting: true });
  assert.deepEqual(request, { channel_account_id: CHANNEL_ACCOUNT_ID, limit: 1, order_sn: target });
  assert.deepEqual(options, { verifyExisting: true }); assert.equal(result.results[0].status, 'already_registered');
});

test('defaults to preview and never calls the writer', async () => {
  let writes = 0;
  const run = createShopeeControlledAutoIntake({
    readBatch: async () => ({ ok: true, status: 200, payload: batchPayload() }),
    persistOrder: async () => {
      writes += 1;
      return { ok: true, status: 200, payload: {} };
    },
  });

  const result = await run({ channelAccountId: CHANNEL_ACCOUNT_ID });

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'preview');
  assert.equal(result.selected, 1);
  assert.equal(result.ready, 1);
  assert.equal(result.blocked, 0);
  assert.equal(result.written, 0);
  assert.equal(result.results[0].status, 'ready');
  assert.equal(writes, 0);
});

test('commit mode writes only a ready contract and returns sanitized ids', async () => {
  let observedContract;
  const run = createShopeeControlledAutoIntake({
    readBatch: async () => ({ ok: true, status: 200, payload: batchPayload() }),
    persistOrder: async (contract) => {
      observedContract = contract;
      return {
        ok: true,
        status: 200,
        payload: {
          order_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          separation_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          already_registered: false,
          forbidden: 'do-not-forward',
        },
      };
    },
  });

  const result = await run({
    channelAccountId: CHANNEL_ACCOUNT_ID,
    mode: 'commit',
  });

  assert.equal(result.ready, 1);
  assert.equal(result.written, 1);
  assert.equal(result.results[0].status, 'written');
  assert.deepEqual(result.results[0].write, {
    ok: true,
    status: 200,
    orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    separationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    alreadyRegistered: false,
  });
  assert.equal(observedContract.order.status, 'pendente');
  assert.equal(observedContract.order.operationalStatus, 'todo');
  assert.equal(observedContract.order.orderType, 'stock');
  assert.equal(observedContract.order.paymentStatus, 'pendente');
  assert.equal(observedContract.effects.stockAction, null);
  assert.equal(observedContract.effects.financialAction, null);
});

test('unmapped Raw is blocked and never reaches writer', async () => {
  let writes = 0;
  const payload = batchPayload({ mappings: [] });
  const run = createShopeeControlledAutoIntake({
    readBatch: async () => ({ ok: true, status: 200, payload }),
    persistOrder: async () => {
      writes += 1;
      return { ok: true, status: 200, payload: {} };
    },
  });

  const result = await run({
    channelAccountId: CHANNEL_ACCOUNT_ID,
    mode: 'commit',
  });

  assert.equal(result.ready, 0);
  assert.equal(result.blocked, 1);
  assert.equal(result.written, 0);
  assert.equal(result.results[0].status, 'blocked');
  assert.ok(result.results[0].blockers.some((value) => value.includes('mapping_needs_mapping')));
  assert.equal(writes, 0);
});

test('writer rejection is isolated to that order and is not counted as written', async () => {
  const run = createShopeeControlledAutoIntake({
    readBatch: async () => ({ ok: true, status: 200, payload: batchPayload() }),
    persistOrder: async () => ({ ok: false, status: 409, payload: { error: 'rejected' } }),
  });

  const result = await run({
    channelAccountId: CHANNEL_ACCOUNT_ID,
    mode: 'commit',
  });

  assert.equal(result.ready, 1);
  assert.equal(result.written, 0);
  assert.equal(result.results[0].status, 'write_failed');
  assert.deepEqual(result.results[0].blockers, ['writer_rejected']);
});

test('batch failure and malformed batch fail closed without writes', async () => {
  for (const response of [
    { ok: false, status: 503, payload: null },
    { ok: true, status: 200, payload: { snapshots: null, mappings: [] } },
  ]) {
    let writes = 0;
    const run = createShopeeControlledAutoIntake({
      readBatch: async () => response,
      persistOrder: async () => {
        writes += 1;
        return { ok: true, status: 200, payload: {} };
      },
    });
    const result = await run({
      channelAccountId: CHANNEL_ACCOUNT_ID,
      mode: 'commit',
    });
    assert.equal(result.ok, false);
    assert.equal(writes, 0);
  }
});

test('requires explicit commit mode and bounded batch size', async () => {
  const run = createShopeeControlledAutoIntake({
    readBatch: async () => ({ ok: true, status: 200, payload: batchPayload() }),
  });

  await assert.rejects(
    () => run({ channelAccountId: CHANNEL_ACCOUNT_ID, mode: 'write' }),
    /mode must be preview or commit/,
  );
  await assert.rejects(
    () => run({ channelAccountId: CHANNEL_ACCOUNT_ID, limit: 21 }),
    /limit must be an integer between 1 and 20/,
  );
});

test('contract keeps selection server-controlled and commit opt-in', () => {
  assert.equal(SHOPEE_CONTROLLED_AUTO_INTAKE_CONTRACT.defaultMode, 'preview');
  assert.equal(SHOPEE_CONTROLLED_AUTO_INTAKE_CONTRACT.commitRequiresExplicitMode, true);
  assert.equal(SHOPEE_CONTROLLED_AUTO_INTAKE_CONTRACT.eligibleStatusesAreServerControlled, true);
  assert.equal(SHOPEE_CONTROLLED_AUTO_INTAKE_CONTRACT.rawSelectionIsServerControlled, true);
  assert.deepEqual(SHOPEE_CONTROLLED_AUTO_INTAKE_CONTRACT.writes, [
    'orders',
    'order_items',
    'order_separation',
  ]);
});


test('exact target commit processes only the pinned order from a broader server batch', async () => {
  const target = '261014HRQJ4QHT';
  const other = '261013HKHWK3V7';
  const payload = batchPayload({
    snapshots: [snapshot(other), snapshot(target)],
    counts: { selected: 2, skipped_existing: 1, skipped_status: 0, skipped_malformed: 0 },
  });
  const writtenOrders = [];
  const run = createShopeeControlledAutoIntake({
    readBatch: async () => ({ ok: true, status: 200, payload }),
    persistOrder: async (contract) => {
      writtenOrders.push(contract.order.orderNumber);
      return {
        ok: true,
        status: 200,
        payload: {
          order_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          separation_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          already_registered: false,
        },
      };
    },
  });

  const result = await run({
    channelAccountId: CHANNEL_ACCOUNT_ID,
    limit: 5,
    mode: 'commit',
    expectedOrderSn: target,
  });

  assert.equal(result.ok, true);
  assert.equal(result.selected, 1);
  assert.equal(result.ready, 1);
  assert.equal(result.blocked, 0);
  assert.equal(result.written, 1);
  assert.deepEqual(writtenOrders, [target]);
  assert.equal(result.results[0].orderSn, target);
  assert.equal(result.results[0].status, 'written');
});

test('exact target commit fails closed when the pinned order is not in the server batch', async () => {
  let writes = 0;
  const run = createShopeeControlledAutoIntake({
    readBatch: async () => ({ ok: true, status: 200, payload: batchPayload() }),
    persistOrder: async () => {
      writes += 1;
      return { ok: true, status: 200, payload: {} };
    },
  });

  const result = await run({
    channelAccountId: CHANNEL_ACCOUNT_ID,
    mode: 'commit',
    expectedOrderSn: 'NOT-IN-BATCH',
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'expected_order_unavailable');
  assert.equal(result.selected, 0);
  assert.equal(result.written, 0);
  assert.equal(writes, 0);
});

test('idempotent already-registered result is successful but does not count as a new write', async () => {
  const run = createShopeeControlledAutoIntake({
    readBatch: async () => ({ ok: true, status: 200, payload: batchPayload() }),
    persistOrder: async () => ({
      ok: true,
      status: 200,
      payload: {
        order_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        separation_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        already_registered: true,
      },
    }),
  });

  const result = await run({
    channelAccountId: CHANNEL_ACCOUNT_ID,
    mode: 'commit',
    expectedOrderSn: '261014HRQJ4QHT',
  });

  assert.equal(result.ready, 1);
  assert.equal(result.written, 0);
  assert.equal(result.results[0].status, 'already_registered');
  assert.equal(result.results[0].write.alreadyRegistered, true);
});

test('writer exception is classified as write_failed and not as pipeline exception', async () => {
  const run = createShopeeControlledAutoIntake({
    readBatch: async () => ({ ok: true, status: 200, payload: batchPayload() }),
    persistOrder: async () => {
      throw new Error('synthetic writer outage');
    },
  });

  const result = await run({
    channelAccountId: CHANNEL_ACCOUNT_ID,
    mode: 'commit',
    expectedOrderSn: '261014HRQJ4QHT',
  });

  assert.equal(result.ready, 1);
  assert.equal(result.blocked, 0);
  assert.equal(result.written, 0);
  assert.equal(result.results[0].status, 'write_failed');
  assert.deepEqual(result.results[0].blockers, ['writer_exception']);
});


test('F6-K.1 stops the controlled round after infrastructure writer exception', async () => {
  const first = '261014HRQJ4QHT';
  const second = '261013HKHWK3V7';
  const payload = batchPayload({
    snapshots: [snapshot(first), snapshot(second)],
    counts: { selected: 2, skipped_existing: 0, skipped_status: 0, skipped_malformed: 0 },
  });

  const attempted = [];
  const run = createShopeeControlledAutoIntake({
    readBatch: async () => ({ ok: true, status: 200, payload }),
    persistOrder: async (contract) => {
      attempted.push(contract.order.orderNumber);
      throw new Error('synthetic infrastructure outage');
    },
  });

  const result = await run({
    channelAccountId: CHANNEL_ACCOUNT_ID,
    limit: 5,
    mode: 'commit',
  });

  assert.deepEqual(attempted, [first]);
  assert.equal(result.roundStopped, true);
  assert.equal(result.stopReason, 'writer_exception');
  assert.equal(result.selected, 2);
  assert.equal(result.ready, 1);
  assert.equal(result.written, 0);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].orderSn, first);
  assert.equal(result.results[0].status, 'write_failed');
  assert.deepEqual(result.results[0].blockers, ['writer_exception']);
});
