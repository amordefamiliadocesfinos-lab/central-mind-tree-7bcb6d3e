import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdaoAutomaticIntake, ADAO_AUTO_INTAKE_SCOPE } from '../src/shopee-adao-automatic-intake.mjs';
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

test('fail closed when disabled or approved pair list missing', async () => {
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
  assert.equal((await noPairs()).code, 'adao_approved_pairs_missing');
  assert.equal(calls, 0);
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
