import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdaoAutomaticIntake, ADAO_AUTO_INTAKE_SCOPE, ADAO_OAUTH_READ_TIMEOUT_MS, createAdaoOauthConnectionReader, ADAO_INTAKE_BATCH_READ_TIMEOUT_MS, createAdaoIntakeBatchReader, createAdaoScopedIntake, selectAdaoLabelCandidate, selectAdaoRecentProcessedLabelCandidate, adaoBatchLimit, selectAdaoBatchCandidates } from '../src/shopee-adao-automatic-intake.mjs';
import { handleRequest } from '../src/app.mjs';

const PAIRS = '18599184676:229452998568,22193668881:179732818913';
const env = {
  SHOPEE_ADAO_AUTO_INTAKE_ENABLED: 'true',
  SHOPEE_ADAO_NON_EASTER_MODEL_PAIRS: PAIRS,
  SHOPEE_LIVE_PARTNER_ID: '2047685',
};
const getEnv = key => env[key];
const now = () => Date.parse('2026-11-07T18:00:00Z');
const page = (order_sns, { more = false, next_cursor = null } = {}) =>
  ({ ok: true, shop_id: 1156446003, order_sns, more, next_cursor });
const result = (orderSn, status) => ({
  ok: true, selected: 1, roundStopped: false,
  results: [{ orderSn, status }],
});

test('disabled runner stays off; mapped orders do not require a duplicate environment approval list', async () => {
  let calls = 0;
  const readOrders = async () => { calls++; return page([]); };
  const disabled = createAdaoAutomaticIntake({
    getEnv: key => key === 'SHOPEE_ADAO_AUTO_INTAKE_ENABLED' ? 'false' : getEnv(key),
    now, readOrders,
  });
  assert.equal((await disabled()).code, 'adao_auto_intake_disabled');
  const noPairs = createAdaoAutomaticIntake({
    getEnv: key => key === 'SHOPEE_ADAO_NON_EASTER_MODEL_PAIRS' ? '' : getEnv(key),
    now, readOrders,
  });
  assert.equal((await noPairs()).code, 'cycle_completed');
  assert.equal(calls, 1);
});

test('discovers and imports in exact Adão scope, with pagination', async () => {
  const input = [];
  const seen = [];
  const runner = createAdaoAutomaticIntake({
    getEnv, now,
    readOrders: async args => {
      input.push(args);
      return input.length === 1 ? page(['261107KXS6MN9H'], { more: true, next_cursor: 'next1' })
        : page(['261107KWVWKFBB']);
    },
    intake: async args => { seen.push(args); return result(args.expectedOrderSn, 'written'); },
  });
  const r = await runner();
  assert.equal(r.ok, true);
  assert.equal(r.written, 2);
  assert.equal(r.pages, 2);
  assert.equal(input[1].cursor, 'next1');
  assert.equal(input[0].timeRangeField, 'update_time');
  assert.equal(input[0].onlyIntakeEligibleOrders, true);
  assert.deepEqual(seen.map(v => v.expectedOrderSn), ['261107KXS6MN9H', '261107KWVWKFBB']);
  assert.ok(seen.every(v => v.channelAccountId === ADAO_AUTO_INTAKE_SCOPE.account
    && v.mode === 'commit' && v.limit === 1 && v.verifyExisting === true));
});

test('existing filtered orders are skipped without retry or creation', async () => {
  const r = await createAdaoAutomaticIntake({
    getEnv, now, readOrders: async () => page(['261107KXS6MN9H']),
    intake: async () => ({ ok: false, code: 'expected_order_unavailable' }),
  })();
  assert.equal(r.ok, true);
  assert.equal(r.skipped, 1);
  assert.equal(r.written, 0);
});

test('unknown result stops further orders', async () => {
  let calls = 0;
  const r = await createAdaoAutomaticIntake({
    getEnv, now, readOrders: async () => page(['261107KXS6MN9H', '261107KWVWKFBB']),
    intake: async args => { calls++; return result(args.expectedOrderSn, 'write_failed'); },
  })();
  assert.equal(r.ok, false);
  assert.equal(r.code, 'writer_uncertain_requires_review');
  assert.equal(calls, 1);
});

test('identity mismatch and duplicate discovery fail closed', async () => {
  const wrongShop = await createAdaoAutomaticIntake({
    getEnv, now, readOrders: async () => ({ ...page([]), shop_id: 531736366 }),
  })();
  assert.equal(wrongShop.ok, false);
  const duplicate = await createAdaoAutomaticIntake({
    getEnv, now, readOrders: async () => page(['261107KXS6MN9H', '261107KXS6MN9H']),
  })();
  assert.equal(duplicate.ok, false);
});

test('bounded pagination returns explicit failure instead of silent success', async () => {
  let counter = 0;
  const r = await createAdaoAutomaticIntake({
    getEnv, now,
    readOrders: async () => {
      counter++;
      return page([], { more: true, next_cursor: 'cursor' + counter });
    },
  })();
  assert.equal(r.code, 'pagination_budget_exhausted');
  assert.equal(r.pages, ADAO_AUTO_INTAKE_SCOPE.maxPages);
  assert.equal(r.ok, false);
});

test('route accepts only zero-body POST, with sanitized aggregate response', async () => {
  let calls = 0;
  const injected = {
    handleShopeeLive: async () => null,
    runAdaoIntake: async () => { calls++; return {
      ok: true, code: 'cycle_completed', discovered: 2, written: 1,
      skipped: 1, pages: 1, blocked: 0,
    }; },
  };
  const path = '/internal/shopee/adao/orders/intake/auto';
  assert.equal((await handleRequest({ method: 'GET', path }, injected)).status, 405);
  assert.equal((await handleRequest({ method: 'POST', path, query: { x: '1' } }, injected)).status, 400);
  const response = await handleRequest({ method: 'POST', path, query: {}, headers: { 'content-length': '0' } }, injected);
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.body).written, 1);
  assert.equal(calls, 1);
});

test('core intake failure explains stage and status without leaking payload', async () => {
  let calls = 0;
  const runner = createAdaoAutomaticIntake({
    getEnv, now, readOrders: async () => page(['261107KXS6MN9H']),
    intake: async () => {
      calls++;
      return { ok: false, code: 'intake_batch_unavailable', status: 503,
        secret: 'do-not-expose', sourceCounts: { selected: 0, skipped_existing: 1 } };
    },
  });
  const r = await runner();
  assert.equal(r.code, 'intake_uncertain_requires_review');
  assert.equal(r.stopped, true);
  assert.equal(r.diagnostic.stage, 'core_intake');
  assert.equal(r.diagnostic.reason, 'intake_batch_unavailable');
  assert.equal(r.diagnostic.http_status, 503);
  assert.deepEqual(r.diagnostic.selection_counts, { selected: 0, skipped_existing: 1 });
  assert.equal(calls, 1);
  assert.ok(!JSON.stringify(r).includes('do-not-expose'));
});

test('mappings blocked: no writer retries and classified blocker', async () => {
  const runner = createAdaoAutomaticIntake({
    getEnv, now, readOrders: async () => page(['261107KXS6MN9H']),
    intake: async order => ({ ...result(order.expectedOrderSn, 'blocked'),
      results: [{ orderSn: order.expectedOrderSn, status: 'blocked',
        blockers: ['mapping_unavailable', 'some sensitive data'] }] }),
  });
  const r = await runner();
  assert.equal(r.ok, true);
  assert.equal(r.blocked, 1);
  assert.equal(r.last_blocker, 'mapping_or_projection_blocked');
  assert.ok(!JSON.stringify(r).includes('some sensitive data'));
});

test('unexpected successful selection is stopped with structured diagnosis', async () => {
  const runner = createAdaoAutomaticIntake({
    getEnv, now, readOrders: async () => page(['261107KXS6MN9H']),
    intake: async () => ({ ok: true, selected: 0, results: [] }),
  });
  const r = await runner();
  assert.equal(r.stopped, true);
  assert.equal(r.diagnostic.stage, 'intake_contract');
  assert.equal(r.diagnostic.reason, 'unexpected_selection');
});

test('IAM route exposes only sanctioned diagnostic object', async () => {
  const response = await handleRequest({
    method: 'POST', path: '/internal/shopee/adao/orders/intake/auto', query: {},
    headers: { 'content-length': '0' },
  }, {
    handleShopeeLive: async () => null,
    runAdaoIntake: async () => ({
      ok: false, code: 'intake_uncertain_requires_review',
      discovered: 1, written: 0, stopped: true,
      diagnostic: { stage: 'core_intake', reason: 'intake_batch_unavailable',
        http_status: 503, selection_counts: null },
    }),
  });
  assert.equal(response.status, 503);
  const body = JSON.parse(response.body);
  assert.equal(body.diagnostic.reason, 'intake_batch_unavailable');
  assert.equal(body.diagnostic.stage, 'core_intake');
});


test('Adão OAuth read alone gets the extended bounded timeout', async () => {
  const calls = [];
  const reader = createAdaoOauthConnectionReader(async (data, options) => {
    calls.push({ data, options });
    return { ok: false, status: 503 };
  });
  const account = { channel_account_id: ADAO_AUTO_INTAKE_SCOPE.account };
  await reader(account);
  assert.equal(ADAO_OAUTH_READ_TIMEOUT_MS, 12_000);
  assert.deepEqual(calls, [{ data: account, options: { timeoutMs: 12_000 } }]);
  assert.equal(ADAO_AUTO_INTAKE_SCOPE.account, 'b4027369-5abf-4ac1-ab24-862334fae892');
});

test('Adão batch reader extends only its Core read budget and rejects other account IDs', async () => {
  const seen = [];
  const readBatch = async (data, options) => {
    seen.push({ data, options });
    return { ok: false, status: 503 };
  };
  const reader = createAdaoIntakeBatchReader(readBatch);
  const data = { channel_account_id: ADAO_AUTO_INTAKE_SCOPE.account, limit: 1, order_sn: '261107KXS6MN9H' };
  assert.deepEqual(await reader(data), { ok: false, status: 503 });
  assert.equal(ADAO_INTAKE_BATCH_READ_TIMEOUT_MS, 12_000);
  assert.deepEqual(seen, [{ data, options: { timeoutMs: 12_000 } }]);
  assert.deepEqual(await reader({ ...data, channel_account_id: '8a8ad166-0317-4597-8be6-e43fb46b4d1b' }),
    { ok: false, status: 409, payload: null });
  assert.equal(seen.length, 1);
});

test('Adão runner uses scoped Core batch reader, exact account and order, without a writer on read failure', async () => {
  const reads = [];
  let writes = 0;
  const scopedIntake = createAdaoScopedIntake(async (data, options) => {
    reads.push({ data, options });
    return { ok: false, status: 503 };
  }, async () => { writes++; return { ok: true }; });
  const runner = createAdaoAutomaticIntake({
    getEnv, now, readOrders: async () => page(['261107KXS6MN9H']),
    intake: scopedIntake,
  });
  const r = await runner();
  assert.equal(r.ok, false);
  assert.equal(r.code, 'intake_uncertain_requires_review');
  assert.equal(r.diagnostic.stage, 'core_intake');
  assert.equal(r.diagnostic.reason, 'intake_batch_unavailable');
  assert.equal(writes, 0);
  assert.deepEqual(reads, [{ data: {
    channel_account_id: ADAO_AUTO_INTAKE_SCOPE.account,
    limit: 1,
    order_sn: '261107KXS6MN9H',
  }, options: { timeoutMs: 12_000 } }]);
});


test('automatic Adão label follows a newly imported order, without a second scheduler', async () => {
  const labels = [];
  const runner = createAdaoAutomaticIntake({
    getEnv: k => k === 'SHOPEE_ADAO_LABEL_SYNC_ENABLED' ? 'true' : getEnv(k),
    now, readOrders: async () => page(['NEWADAO2026']),
    intake: async ({ expectedOrderSn }) => result(expectedOrderSn, 'written'),
    syncLabel: async sn => { labels.push(sn); return { ok: true, code: 'label_attached' }; },
  });
  const r = await runner();
  assert.equal(r.ok, true);
  assert.equal(r.written, 1);
  assert.equal(r.labels_attached, 1);
  assert.deepEqual(labels, ['NEWADAO2026']);
  assert.equal(r.logistics_writes, 0);
});

test('already-imported eligible orders automatically recheck labels in bounded rotation', async () => {
  const target = selectAdaoLabelCandidate(['ADASAMPLE1', 'ADASAMPLE2', 'ADASAMPLE3'], now());
  const labels = [];
  const runner = createAdaoAutomaticIntake({
    getEnv: k => k === 'SHOPEE_ADAO_LABEL_SYNC_ENABLED' ? 'true' : getEnv(k),
    now, readOrders: async () => page(['ADASAMPLE1', 'ADASAMPLE2', 'ADASAMPLE3']),
    intake: async () => ({ ok: false, code: 'expected_order_unavailable' }),
    syncLabel: async sn => { labels.push(sn); return { ok: false, code: 'document_processing' }; },
  });
  const r = await runner();
  assert.equal(r.ok, true);
  assert.equal(r.skipped, 3);
  assert.equal(r.labels_pending, 1);
  assert.deepEqual(labels, [target]);
  assert.equal(selectAdaoLabelCandidate(['ADASAMPLE1', 'ADASAMPLE2'], now()), 
    selectAdaoLabelCandidate(['ADASAMPLE2', 'ADASAMPLE1'], now()));
});

test('label failure does not hide successfully received orders or retry shipping operations', async () => {
  const runner = createAdaoAutomaticIntake({
    getEnv: k => k === 'SHOPEE_ADAO_LABEL_SYNC_ENABLED' ? 'true' : getEnv(k),
    now, readOrders: async () => page(['ADASAMPLE1']),
    intake: async ({ expectedOrderSn }) => result(expectedOrderSn, 'written'),
    syncLabel: async () => { throw new Error('private upstream error'); },
  });
  const r = await runner();
  assert.equal(r.ok, true);
  assert.equal(r.written, 1);
  assert.equal(r.labels_blocked, 1);
  assert.equal(r.label_code, 'label_sync_exception');
  assert.ok(!JSON.stringify(r).includes('private upstream'));
});

test('automatic label remains disabled unless Adão label sync is enabled', async () => {
  let labels = 0;
  const r = await createAdaoAutomaticIntake({
    getEnv,
    now, readOrders: async () => page(['ADASAMPLE1']),
    intake: async ({ expectedOrderSn }) => result(expectedOrderSn, 'written'),
    syncLabel: async () => { labels++; return { ok: true, code: 'label_attached' }; },
  })();
  assert.equal(r.ok, true);
  assert.equal(labels, 0);
  assert.equal(r.labels_attached, 0);
});


test('Adão auto shipping remains disabled when the account flag is unset', async () => {
  let calls = 0;
  const r = await createAdaoAutomaticIntake({
    getEnv: k => k === 'SHOPEE_ADAO_LABEL_SYNC_ENABLED' ? 'false' : getEnv(k),
    now,
    readOrders: async () => ({ ...page(['FRESHSHOPEE1']), ready_to_ship_candidates: [
      { order_sn: 'FRESHSHOPEE1', create_time: 1795000000 },
    ] }),
    intake: async ({ expectedOrderSn }) => result(expectedOrderSn, 'written'),
    arrangeShipping: async () => { calls++; return { ok: true }; },
  })();
  assert.equal(r.ok, true);
  assert.equal(calls, 0);
  assert.equal(r.shipment_acknowledged, 0);
});

test('one newly created Adão order may arrange using LIVE READY_TO_SHIP after Core commit', async () => {
  const arranged = [];
  const r = await createAdaoAutomaticIntake({
    getEnv: k => k === 'SHOPEE_ADAO_AUTO_SHIP_ENABLED' ? 'true' : getEnv(k),
    now,
    readOrders: async () => ({ ...page(['FRESHSHOPEE1', 'FRESHSHOPEE2']),
      ready_to_ship_candidates: [
        { order_sn: 'FRESHSHOPEE1', create_time: 1795000000 },
        { order_sn: 'FRESHSHOPEE2', create_time: 1795000000 },
      ] }),
    intake: async ({ expectedOrderSn }) => result(expectedOrderSn, 'written'),
    arrangeShipping: async sn => {
      arranged.push(sn);
      return { ok: true, code: 'ship_order_api_acknowledged_not_collected' };
    },
  })();
  assert.equal(r.ok, true);
  assert.equal(r.shipment_acknowledged, 1);
  assert.deepEqual(arranged, ['FRESHSHOPEE1']);
  assert.equal(r.written, 2);
});

test('test history and shipped orders never receive automatic ship_order', async () => {
  const calls = [];
  const r = await createAdaoAutomaticIntake({
    getEnv: k => k === 'SHOPEE_ADAO_AUTO_SHIP_ENABLED' ? 'true' : getEnv(k),
    now,
    readOrders: async () => ({ ...page(['HISTORICAL1', 'ALREADYSHIP1']),
      ready_to_ship_candidates: [
        { order_sn: 'HISTORICAL1', create_time: 1794000000 },
      ] }),
    intake: async () => ({ ok: false, code: 'expected_order_unavailable' }),
    arrangeShipping: async sn => { calls.push(sn); return { ok: true }; },
  })();
  assert.equal(r.ok, true);
  assert.equal(r.skipped, 2);
  assert.deepEqual(calls, []);
});

test('uncertain shipment does not trigger another ship_order or hide successful intake', async () => {
  let calls = 0;
  const r = await createAdaoAutomaticIntake({
    getEnv: k => k === 'SHOPEE_ADAO_AUTO_SHIP_ENABLED' ? 'true' : getEnv(k),
    now,
    readOrders: async () => ({ ...page(['FRESHSHOPEE1']),
      ready_to_ship_candidates: [{ order_sn: 'FRESHSHOPEE1', create_time: 1795000000 }] }),
    intake: async ({ expectedOrderSn }) => result(expectedOrderSn, 'written'),
    arrangeShipping: async () => { calls++; return { ok: false, code: 'ship_order_uncertain_requires_reconciliation' }; },
  })();
  assert.equal(r.written, 1);
  assert.equal(r.shipment_pending, 1);
  assert.equal(r.shipment_code, 'ship_order_uncertain_requires_reconciliation');
  assert.equal(calls, 1);
});


test('reopened pilot PED-00413 is eligible only with live READY_TO_SHIP evidence', async () => {
  const arranged = [];
  const sn = '2611111W8T6TE3';
  const resultValue = await createAdaoAutomaticIntake({
    getEnv: key => key === 'SHOPEE_ADAO_AUTO_SHIP_ENABLED' ? 'true'
      : key === 'SHOPEE_ADAO_LABEL_SYNC_ENABLED' ? 'false' : getEnv(key),
    now,
    readOrders: async () => ({
      ...page([sn]),
      ready_to_ship_candidates: [{ order_sn: sn, create_time: 1794350000 }],
    }),
    intake: async () => ({ ok: false, code: 'expected_order_unavailable' }),
    arrangeShipping: async value => {
      arranged.push(value);
      return { ok: true, code: 'ship_order_api_acknowledged_not_collected' };
    },
  })();
  assert.equal(resultValue.ok, true);
  assert.equal(resultValue.shipment_acknowledged, 1);
  assert.deepEqual(arranged, [sn]);
});

test('no old order except three explicitly reopened can be automatically arranged', async () => {
  const arranged = [];
  const sn = '261110UM3PJTUT'; // finalized PED-00409
  const resultValue = await createAdaoAutomaticIntake({
    getEnv: key => key === 'SHOPEE_ADAO_AUTO_SHIP_ENABLED' ? 'true'
      : key === 'SHOPEE_ADAO_LABEL_SYNC_ENABLED' ? 'false' : getEnv(key),
    now,
    readOrders: async () => ({
      ...page([sn]),
      ready_to_ship_candidates: [{ order_sn: sn, create_time: 1794350000 }],
    }),
    intake: async () => ({ ok: false, code: 'expected_order_unavailable' }),
    arrangeShipping: async value => { arranged.push(value); },
  })();
  assert.equal(resultValue.ok, true);
  assert.deepEqual(arranged, []);
});

test('reopened pilot never arranges without current Shopee READY_TO_SHIP evidence', async () => {
  const arranged = [];
  const sn = '2611111W8T6TE3';
  const resultValue = await createAdaoAutomaticIntake({
    getEnv: key => key === 'SHOPEE_ADAO_AUTO_SHIP_ENABLED' ? 'true'
      : key === 'SHOPEE_ADAO_LABEL_SYNC_ENABLED' ? 'false' : getEnv(key),
    now,
    readOrders: async () => ({
      ...page([sn]), ready_to_ship_candidates: [],
    }),
    intake: async () => ({ ok: false, code: 'expected_order_unavailable' }),
    arrangeShipping: async value => { arranged.push(value); },
  })();
  assert.equal(resultValue.ok, true);
  assert.deepEqual(arranged, []);
});


test('new Core order imported before READY_TO_SHIP is arranged when Shopee later becomes ready', async () => {
  const sn = 'FRESHSHOPEE1';
  const arranged = [];
  const runner = createAdaoAutomaticIntake({
    getEnv: k => k === 'SHOPEE_ADAO_AUTO_SHIP_ENABLED' ? 'true'
      : k === 'SHOPEE_ADAO_LABEL_SYNC_ENABLED' ? 'false' : getEnv(k),
    now,
    readOrders: async () => ({
      ...page([sn]),
      ready_to_ship_candidates: [{ order_sn: sn, create_time: 1795000000 }],
    }),
    // Core does not reimport already registered order. It will be checked
    // for active state atomically by the live shipping claim.
    intake: async () => ({ ok: false, code: 'expected_order_unavailable' }),
    arrangeShipping: async value => { arranged.push(value); return {
      ok: true, code: 'ship_order_api_acknowledged_not_collected',
    }; },
  });
  const resultValue = await runner();
  assert.equal(resultValue.ok, true);
  assert.equal(resultValue.skipped, 1);
  assert.equal(resultValue.shipment_candidates, 1);
  assert.equal(resultValue.shipment_acknowledged, 1);
  assert.deepEqual(arranged, [sn]);
});

test('new order already in Core does not arrange unless latest Shopee state is READY_TO_SHIP', async () => {
  const sn = 'FRESHSHOPEE1';
  const arranged = [];
  const runner = createAdaoAutomaticIntake({
    getEnv: k => k === 'SHOPEE_ADAO_AUTO_SHIP_ENABLED' ? 'true'
      : k === 'SHOPEE_ADAO_LABEL_SYNC_ENABLED' ? 'false' : getEnv(k),
    now,
    readOrders: async () => ({ ...page([sn]), ready_to_ship_candidates: [] }),
    intake: async () => ({ ok: false, code: 'expected_order_unavailable' }),
    arrangeShipping: async v => { arranged.push(v); return { ok: true }; },
  });
  const resultValue = await runner();
  assert.equal(resultValue.shipment_candidates, 0);
  assert.deepEqual(arranged, []);
});

test('candidate rotation prevents one permanently ineligible order from starving other orders', async () => {
  const calls = [];
  const orders = ['FRESHSHOPEE1','FRESHSHOPEE2'];
  for (const time of [Date.parse('2026-11-11T14:40:00Z'), Date.parse('2026-11-11T14:45:00Z')]) {
    const runner = createAdaoAutomaticIntake({
      getEnv: k => k === 'SHOPEE_ADAO_AUTO_SHIP_ENABLED' ? 'true'
        : k === 'SHOPEE_ADAO_LABEL_SYNC_ENABLED' ? 'false' : getEnv(k),
      now: () => time,
      readOrders: async () => ({ ...page(orders),
        ready_to_ship_candidates: orders.map(order_sn => ({ order_sn, create_time: 1795000000 })),
      }),
      intake: async () => ({ ok: false, code: 'expected_order_unavailable' }),
      arrangeShipping: async sn => { calls.push(sn); return { ok: false, code: 'preflight_not_eligible' }; },
    });
    const resultValue = await runner();
    assert.equal(resultValue.shipment_candidates, 2);
    assert.equal(resultValue.shipment_pending, 1);
  }
  assert.deepEqual([...new Set(calls)].sort(), orders);
});


test('recent PROCESSED Adão orders are prioritized over old label backlog', async () => {
  const a = { order_sn: '26111137FS6GRM', create_time: 1794410000 };
  const b = { order_sn: '2611123948MENG', create_time: 1794410500 };
  const old = { order_sn: 'OLDPROCESSED1', create_time: 1794200000 };
  const first = selectAdaoRecentProcessedLabelCandidate([old,a,b], Date.parse('2026-11-11T15:10:00Z'));
  assert.ok([a.order_sn,b.order_sn].includes(first));
  assert.equal(selectAdaoRecentProcessedLabelCandidate([old], Date.parse('2026-11-11T15:10:00Z')), null);
});

test('automatic Adão cycle prioritizes recent processed PDF and emits sanitized diagnostics', async () => {
  const old = 'OLDPROCESSED1';
  const first = '26111137FS6GRM';
  const second = '2611123948MENG';
  const synced = [];
  const diagnostics = [];
  const runner = createAdaoAutomaticIntake({
    getEnv: key => key === 'SHOPEE_ADAO_AUTO_SHIP_ENABLED' ? 'false'
      : key === 'SHOPEE_ADAO_LABEL_SYNC_ENABLED' ? 'true' : getEnv(key),
    now: () => Date.parse('2026-11-11T15:10:00Z'),
    readOrders: async () => ({
      ...page([old,first,second]),
      label_ready_candidates: [
        { order_sn: first, create_time: 1794410000 },
        { order_sn: second, create_time: 1794410500 },
      ],
    }),
    intake: async () => ({ ok: false, code: 'expected_order_unavailable' }),
    syncLabel: async sn => { synced.push(sn); return {ok:false,code:'document_processing'}; },
    logDiagnostic: entry => diagnostics.push(entry),
  });
  const report = await runner();
  assert.equal(report.labels_pending,1);
  assert.equal(synced.length,1);
  assert.ok([first,second].includes(synced[0]));
  assert.deepEqual(Object.keys(diagnostics[0]).sort(), ['event','outcome','processed_candidates','result_code']);
  assert.equal(diagnostics[0].result_code,'document_processing');
});


test('F12: batch limits default to one and cap at three without changing old production env', () => {
  assert.equal(adaoBatchLimit(undefined), 1);
  assert.equal(adaoBatchLimit('10'), 1);
  assert.equal(adaoBatchLimit('0'), 1);
  assert.equal(adaoBatchLimit('3'), 3);
  assert.equal(selectAdaoBatchCandidates(['NEWORDER001','NEWORDER002','NEWORDER003'], Date.parse('2026-11-11T19:00:00Z'), 3).length, 3);
  assert.equal(new Set(selectAdaoBatchCandidates(['NEWORDER001','NEWORDER001','NEWORDER002'], Date.parse('2026-11-11T19:00:00Z'), 3)).size, 2);
});

test('F12: Adão bounded batches process three shipments and three labels, preserving 1 per order', async () => {
  const snList = ['NEWORDER001','NEWORDER002','NEWORDER003','NEWORDER004'];
  const shipCalls = [], labelCalls = [];
  const runner = createAdaoAutomaticIntake({
    getEnv: key => ({
      SHOPEE_ADAO_AUTO_SHIP_ENABLED: 'true',
      SHOPEE_ADAO_LABEL_SYNC_ENABLED: 'true',
      SHOPEE_ADAO_SHIP_BATCH_SIZE: '3',
      SHOPEE_ADAO_LABEL_BATCH_SIZE: '3',
    })[key] ?? getEnv(key),
    now: () => Date.parse('2026-11-11T18:00:00Z'),
    readOrders: async () => ({
      ...page(snList),
      ready_to_ship_candidates: snList.map(order_sn => ({ order_sn, create_time: 1794410500 })),
      label_ready_candidates: snList.map(order_sn => ({ order_sn, create_time: 1794410500 })),
    }),
    intake: async () => ({ ok: false, code: 'expected_order_unavailable' }),
    arrangeShipping: async sn => { shipCalls.push(sn); return { ok: true, code: 'ship_order_api_acknowledged_not_collected' }; },
    syncLabel: async sn => { labelCalls.push(sn); return { ok: true, code: 'label_attached' }; },
    logDiagnostic: () => {},
  });
  const r = await runner();
  assert.equal(r.ok, true);
  assert.equal(r.shipment_candidates, 4);
  assert.equal(r.shipment_attempted, 3);
  assert.equal(r.shipment_acknowledged, 3);
  assert.equal(r.label_attempted, 3);
  assert.equal(r.labels_attached, 3);
  assert.equal(new Set(shipCalls).size, 3);
  assert.equal(new Set(labelCalls).size, 3);
});

test('F12: one failed shipping candidate does not prevent other scoped candidates', async () => {
  const snList = ['NEWORDER001','NEWORDER002','NEWORDER003'];
  const attempts = [];
  const runner = createAdaoAutomaticIntake({
    getEnv: key => ({
      SHOPEE_ADAO_AUTO_SHIP_ENABLED: 'true',
      SHOPEE_ADAO_LABEL_SYNC_ENABLED: 'false',
      SHOPEE_ADAO_SHIP_BATCH_SIZE: '3',
    })[key] ?? getEnv(key),
    now: () => Date.parse('2026-11-11T18:00:00Z'),
    readOrders: async () => ({
      ...page(snList),
      ready_to_ship_candidates: snList.map(order_sn => ({ order_sn, create_time: 1794410500 })),
    }),
    intake: async () => ({ ok: false, code: 'expected_order_unavailable' }),
    arrangeShipping: async sn => {
      attempts.push(sn);
      if (attempts.length === 1) throw new Error('simulated transport exception');
      return {ok:true,code:'ship_order_api_acknowledged_not_collected'};
    },
  });
  const r = await runner();
  assert.equal(r.shipment_attempted, 3);
  assert.equal(r.shipment_pending, 1);
  assert.equal(r.shipment_acknowledged, 2);
});

test('F12: wall-clock budget stops new logistics actions without interrupting completed calls', async () => {
  let elapsedMs = 0;
  const snList = ['NEWORDER001','NEWORDER002','NEWORDER003'];
  const runner = createAdaoAutomaticIntake({
    getEnv: key => ({
      SHOPEE_ADAO_AUTO_SHIP_ENABLED: 'true',
      SHOPEE_ADAO_LABEL_SYNC_ENABLED: 'true',
      SHOPEE_ADAO_SHIP_BATCH_SIZE: '3',
      SHOPEE_ADAO_LABEL_BATCH_SIZE: '3',
    })[key] ?? getEnv(key),
    now: () => Date.parse('2026-11-11T18:00:00Z') + elapsedMs,
    readOrders: async () => ({
      ...page(snList),
      ready_to_ship_candidates: snList.map(order_sn => ({ order_sn, create_time: 1794410500 })),
    }),
    intake: async () => ({ ok: false, code: 'expected_order_unavailable' }),
    arrangeShipping: async () => { elapsedMs += 50_000; return {ok:true,code:'ship_order_api_acknowledged_not_collected'}; },
    syncLabel: async () => { throw new Error('should not be called after timeout'); },
  });
  const r = await runner();
  assert.equal(r.shipment_attempted, 1);
  assert.equal(r.work_budget_exhausted, true);
  assert.equal(r.label_attempted, 0);
});
