import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADAO_F12_WORK_BUDGET_MS,
  createAdaoAutomaticIntake,
} from '../src/shopee-adao-automatic-intake.mjs';

// F12.2 comparison of the exact production runner with ALL external adapters
// replaced by in-memory fakes. Never imports the HTTP server, calls the Core,
// obtains OAuth or runs a Shopee POST. Synthetic order IDs are never logged.
const START = Date.parse('2026-11-11T18:00:00Z');
const SHOP = 1156446003;
const FIRST = ['SIMFIRSTPAGE1', 'SIMFIRSTPAGE2', 'SIMFIRSTPAGE3'];
const SECOND = 'SIMSECONDPAGE';
const THIRD = 'SIMTHIRDPAGE1';

function page(ids, more, cursor, deadline, created = 1794400000) {
  return {
    ok: true, shop_id: SHOP, order_sns: ids,
    more, next_cursor: cursor,
    ready_to_ship_candidates: ids.map(order_sn => ({
      order_sn, create_time: created, ship_by_date: deadline,
    })),
  };
}

async function simulate({ fairness, includeThirdPage = false, secondPageFailure = false } = {}) {
  let elapsed = 0;
  let pagesRead = 0;
  let intakeCalls = 0;
  let shippingCalls = 0;
  let labelCalls = 0;
  const events = [];
  const getEnv = key => ({
    SHOPEE_LIVE_PARTNER_ID: '2047685',
    SHOPEE_ADAO_AUTO_INTAKE_ENABLED: 'true',
    SHOPEE_ADAO_AUTO_SHIP_ENABLED: 'true',
    SHOPEE_ADAO_LABEL_SYNC_ENABLED: 'false',
    SHOPEE_ADAO_SHIP_BATCH_SIZE: '3',
    SHOPEE_ADAO_LABEL_BATCH_SIZE: '3',
    SHOPEE_ADAO_F12_CROSS_PAGE_FAIRNESS_ENABLED: fairness ? 'true' : 'false',
  })[key];
  const run = createAdaoAutomaticIntake({
    getEnv,
    now: () => START + elapsed,
    readOrders: async () => {
      pagesRead++;
      elapsed += 9000;
      if (pagesRead === 1) return page(FIRST, true, 'cursor2', 1794500000);
      if (secondPageFailure) throw new Error('synthetic page error');
      if (pagesRead === 2) {
        return page([SECOND], includeThirdPage, includeThirdPage ? 'cursor3' : null, 1794400000);
      }
      return page([THIRD], false, null, 1794300000);
    },
    intake: async ({ expectedOrderSn }) => {
      intakeCalls++;
      return {
        ok: true, selected: 1, roundStopped: false,
        results: [{ orderSn: expectedOrderSn, status: 'written' }],
      };
    },
    arrangeShipping: async sn => {
      shippingCalls++;
      events.push({ sn, page: pagesRead, timeMs: elapsed });
      elapsed += 1000;
      return { ok: true, code: 'ship_order_api_acknowledged_not_collected' };
    },
    syncLabel: async () => {
      labelCalls++;
      throw new Error('labels must remain disabled');
    },
    logDiagnostic: () => {},
  });
  const report = await run();
  return { report, events, pagesRead, intakeCalls, shippingCalls, labelCalls };
}

test('F12.2 controlled A/B: opt-in reserves last slot for the urgent second page without delaying first action', async () => {
  const baseline = await simulate({ fairness: false });
  const optIn = await simulate({ fairness: true });

  assert.equal(baseline.report.ok, true);
  assert.equal(optIn.report.ok, true);
  assert.equal(baseline.report.pages, 2);
  assert.equal(optIn.report.pages, 2);
  assert.equal(baseline.report.shipment_attempted, 3);
  assert.equal(optIn.report.shipment_attempted, 3);
  assert.equal(baseline.events.some(e => e.sn === SECOND), false);
  assert.equal(optIn.events.at(-1).sn, SECOND);
  assert.equal(optIn.events[0].page, 1);
  assert.ok(optIn.events[0].timeMs < ADAO_F12_WORK_BUDGET_MS);
  assert.equal(new Set(optIn.events.map(e => e.sn)).size, 3);
  assert.equal(baseline.labelCalls, 0);
  assert.equal(optIn.labelCalls, 0);
  assert.equal(baseline.shippingCalls, 3);
  assert.equal(optIn.shippingCalls, 3);
  // These counters are synthetic fake-adapter invocations, not live shipments.
  const evidence = {
    scenario: 'two_pages_one_urgent_on_second',
    baseline: { attempted: baseline.report.shipment_attempted, urgent_included: false },
    opt_in: { attempted: optIn.report.shipment_attempted, urgent_included: true },
    first_opt_in_action_before_48s: true,
    actual_shopee_or_core_calls: 0,
    actual_labels_or_stock_writes: 0,
  };
  assert.deepEqual(evidence.baseline, { attempted: 3, urgent_included: false });
  assert.deepEqual(evidence.opt_in, { attempted: 3, urgent_included: true });
  console.log('F12_2_AB_SYNTHETIC ' + JSON.stringify(evidence));
});

test('F12.2 controlled A/B: page-three urgency remains an unproven global-fairness limitation', async () => {
  const optIn = await simulate({ fairness: true, includeThirdPage: true });
  assert.equal(optIn.report.ok, true);
  assert.equal(optIn.pagesRead, 3);
  assert.equal(optIn.report.shipment_attempted, 3);
  assert.equal(optIn.events.some(e => e.sn === SECOND), true);
  assert.equal(optIn.events.some(e => e.sn === THIRD), false);
  assert.equal(optIn.report.cross_page_deadline_inversions, 2);
  assert.equal(optIn.labelCalls, 0);
  console.log('F12_2_LIMIT_SYNTHETIC ' + JSON.stringify({
    scenario: 'urgent_third_page_after_cap',
    third_page_not_serviced_this_cycle: true,
    cross_page_deadline_inversions: optIn.report.cross_page_deadline_inversions,
    actual_shopee_or_core_calls: 0,
  }));
});

test('F12.2 controlled: failed second page never retries an earlier synthetic shipment', async () => {
  const optIn = await simulate({ fairness: true, secondPageFailure: true });
  assert.equal(optIn.report.ok, false);
  assert.equal(optIn.report.code, 'shopee_discovery_exception');
  assert.equal(optIn.report.shipment_attempted, 2);
  assert.equal(optIn.shippingCalls, 2);
  assert.equal(new Set(optIn.events.map(e => e.sn)).size, 2);
  assert.equal(optIn.labelCalls, 0);
});
