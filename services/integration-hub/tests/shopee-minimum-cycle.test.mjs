import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createShopeeMinimumCycle } from '../src/shopee-minimum-cycle.mjs';
import { SHOPEE_CYCLE_ACCOUNT as account } from '../src/shopee-cycle-scope.mjs';
import { handleRequest } from '../src/app.mjs';
import { callCoreBridgeAction, CORE_BRIDGE_URL } from '../src/core-bridge.mjs';
import { createBridgeHandler } from '../../../supabase/functions/integration-core-bridge/handler.mjs';
import { executeCycleAction, verifyCycleOrder } from '../../../supabase/functions/integration-core-bridge/cycle.mjs';

const NOW = Date.parse('2026-10-21T12:00:00Z');
const ID = '123e4567-e89b-42d3-a456-426614174000';
const SN = 'SYNTHETIC001';
const env = { SHOPEE_LIVE_CYCLE_ENABLED: 'true', SHOPEE_LIVE_AUTO_COMMIT_ENABLED: 'true',
  SHOPEE_LIVE_LABEL_CREATE_ENABLED: 'true', SHOPEE_LIVE_LABEL_SYNC_ENABLED: 'true',
  SHOPEE_LIVE_CHANNEL_ACCOUNT_ID: account.account, SHOPEE_LIVE_PARTNER_ID: String(account.partner) };
function fixture({ candidate = { order_sn: SN, package_number: 'SYNTHETICPKG' }, overrides = {}, envPatch = {} } = {}) {
  const calls = [], config = { ...env, ...envPatch };
  const lease = { status: 'acquired', lease_id: ID, expires_at: '2026-10-21T12:05:00+00:00',
    time_from: 1792570000, time_to: 1792575000, cursor: 'page2', candidate };
  let finished;
  const deps = { getEnv: k => config[k], now: () => NOW,
    callCore: async ({ action, data }) => {
      calls.push(action);
      if (action.endsWith('acquire')) return { ok: true, payload: lease };
      finished = data; return { ok: true, payload: { status: 'finished' } };
    },
    readOrders: async args => { calls.push(['read', args]); return { ok: true, shop_id: account.shop,
      order_sns: ['SYNTHETIC002'], more: true, next_cursor: 'page3' }; },
    intake: async args => { calls.push(['intake', args]); return { ok: true, selected: 1,
      results: [{ orderSn: SN, status: 'written' }] }; },
    prepareLabel: options => async () => { calls.push(['label', options]); return { ok: true, code: 'label_attached', document_id: ID }; },
    ...overrides };
  return { run: createShopeeMinimumCycle(deps), calls, lease, get finished() { return finished; } };
}
test('recurring cycle carries exact account, persisted cursor, canonical verification and scoped label window', async () => {
  const f = fixture(); const result = await f.run();
  assert.equal(result.document_id, ID);
  assert.deepEqual(f.calls.map(c => Array.isArray(c) ? c[0] : c), ['shopee.cycle.acquire','read','intake','label','shopee.cycle.finish']);
  assert.equal(f.calls[1][1].cursor, 'page2'); assert.equal(f.calls[1][1].timeRangeField, 'update_time');
  assert.equal(f.calls[2][1].verifyExisting, true); assert.equal(f.calls[2][1].expectedOrderSn, SN);
  const options = f.calls[3][1]; assert.deepEqual(options.recurringScope, { ...account, order: SN, package: 'SYNTHETICPKG' });
  assert.equal(options.getEnv('SHOPEE_LIVE_LABEL_CREATE_WINDOW_EXPIRES_AT'), '2026-10-21T12:05:00.000Z');
  assert.equal(f.finished.outcome, 'complete'); assert.equal(f.finished.page.next_cursor, 'page3');
});
test('discovery-only round enqueues page and creates no order or label', async () => {
  const f = fixture({ candidate: null }); assert.equal((await f.run()).code, 'cycle_discovered');
  assert.equal(f.calls.filter(Array.isArray).length, 1); assert.deepEqual(f.finished.page.order_sns, ['SYNTHETIC002']);
});
for (const key of ['SHOPEE_LIVE_CYCLE_ENABLED','SHOPEE_LIVE_AUTO_COMMIT_ENABLED','SHOPEE_LIVE_LABEL_CREATE_ENABLED','SHOPEE_LIVE_LABEL_SYNC_ENABLED']) {
  test(`default-off ${key} prevents all access`, async () => {
    const f = fixture({ envPatch: { [key]: undefined } }); assert.equal((await f.run()).code, 'cycle_not_enabled'); assert.deepEqual(f.calls, []);
  });
}
for (const patch of [{ SHOPEE_LIVE_CHANNEL_ACCOUNT_ID: ID }, { SHOPEE_LIVE_PARTNER_ID: '1' },
  { SHOPEE_LIVE_SHIP_ORDER_ENABLED: 'true' }, { SHOPEE_LIVE_SHIP_ORDER_ROUTE_ENABLED: 'true' }]) {
  test(`account/dispatch conflict refuses before network ${JSON.stringify(patch)}`, async () => {
    const f = fixture({ envPatch: patch }); assert.equal((await f.run()).ok, false); assert.deepEqual(f.calls, []);
  });
}
test('concurrent lease refusal cannot discover, ingest or create', async () => {
  const f = fixture({ overrides: { callCore: async () => ({ ok: false, payload: { status: 'busy' } }) } });
  assert.equal((await f.run()).code, 'cycle_busy_or_unavailable'); assert.deepEqual(f.calls, []);
});
for (const candidate of [{ order_sn: SN, document_available: true }, { order_sn: SN, terminal: true }]) {
  test('attached or physically shipped orders never reach intake/preparation', async () => {
    const f = fixture({ candidate }); assert.equal((await f.run()).ok, true);
    assert.equal(f.calls.filter(Array.isArray).length, 1); assert.equal(f.finished.outcome, 'complete');
  });
}
test('canonical identity conflict is quarantined without label or writer', async () => {
  const f = fixture({ candidate: { order_sn: SN, blocked_reason: 'canonical_order_conflict' } });
  assert.equal((await f.run()).ok, false); assert.equal(f.finished.outcome, 'blocked');
  assert.equal(f.calls.filter(Array.isArray).length, 1);
});
test('waiting package still imports order but never prepares label', async () => {
  const f = fixture({ candidate: { order_sn: SN, package_number: null } });
  assert.equal((await f.run()).code, 'cycle_waiting_single_package');
  assert.equal(f.calls.filter(Array.isArray).length, 2); assert.equal(f.finished.outcome, 'pending');
});
test('mapping blocker stays pending; canonical write conflict blocks only this order', async () => {
  for (const status of ['blocked','write_failed']) {
    const f = fixture({ overrides: { intake: async () => ({ ok: true, selected: 1,
      results: [{ orderSn: SN, status, blockers: ['synthetic_integrity_blocker'] }] }) } });
    const result = await f.run(); assert.deepEqual(result.blockers, ['synthetic_integrity_blocker']);
    assert.equal(f.finished.outcome, status === 'blocked' ? 'pending' : 'blocked');
    assert.equal(f.calls.some(c => c[0] === 'label'), false);
  }
});
for (const code of ['document_creation_uncertain','document_core_confirmation_missing','document_claim_locked','document_failed']) {
  test(`uncertain/final result ${code} blocks without retry`, async () => {
    let attempts = 0;
    const f = fixture({ overrides: { prepareLabel: () => async () => { attempts++; return { ok: false, code }; } } });
    assert.equal((await f.run()).ok, false); assert.equal(attempts, 1); assert.equal(f.finished.outcome, 'blocked');
  });
}
test('PROCESSING remains pending and next round uses same preparer read-before-claim protection', async () => {
  let attempts = 0;
  const f = fixture({ overrides: { prepareLabel: () => async () => { attempts++; return { ok: false, code: 'document_processing' }; } } });
  assert.equal((await f.run()).ok, true); assert.equal(attempts, 1); assert.equal(f.finished.outcome, 'pending');
});
test('invalid/repeated cursor and failed discovery never advance checkpoint', async () => {
  for (const page of [{ ok: false, code: 'access_token_expired_no_refresh' },
    { ok: true, shop_id: account.shop, order_sns: [], more: true, next_cursor: 'page2' }]) {
    const f = fixture({ overrides: { readOrders: async () => page } }); await f.run();
    assert.equal(f.finished.page, null); assert.equal(f.finished.outcome, 'pending');
  }
});
test('ambiguous token rotation/discovery is explicit and checkpointed for account halt', async () => {
  const f = fixture({ envPatch: { SHOPEE_LIVE_OAUTH_REFRESH_ENABLED: 'true' },
    overrides: { readOrders: async () => { throw Error('private token'); } } });
  assert.equal((await f.run()).code, 'cycle_refresh_or_discovery_uncertain');
  assert.equal(f.finished.code, 'cycle_refresh_or_discovery_uncertain'); assert.equal(f.finished.page, null);
});
test('checkpoint loss is not reported as successful round and never repeats preparation', async () => {
  const f = fixture(); let calls = 0;
  const g = fixture({ overrides: { callCore: async ({ action }) => action.endsWith('acquire')
    ? { ok: true, payload: f.lease } : (++calls, { ok: false }) } });
  await assert.rejects(g.run(), /cycle_checkpoint_unavailable/); assert.equal(calls, 1);
});

test('private route is off by default and refuses bodies, queries and wrong method before runner', async () => {
  const base = { path: '/internal/shopee/live/cycle/run', method: 'POST', headers: {}, query: {} };
  const deps = { handleShopeeLive: async () => null, getEnv: () => undefined, runMinimumCycle: async () => assert.fail() };
  assert.equal((await handleRequest(base, deps)).status, 503);
  for (const patch of [{ method: 'GET' }, { body: '{}' }, { query: { order: SN } }, { headers: { 'content-length': '1' } }]) {
    assert.ok([400,405].includes((await handleRequest({ ...base, ...patch }, deps)).status));
  }
});
test('HMAC cycle payload validation rejects caller-selected scope and malformed checkpoint before executor', async () => {
  let executed = 0;
  const handler = createBridgeHandler({ getSecret: () => 'synthetic-key', checkCore: async () => true,
    executeAction: async () => { executed++; return { status: 200, body: { status: 'acquired' } }; }, logger: () => {} });
  const call = (action, data) => callCoreBridgeAction({ action, data, secret: 'synthetic-key', url: CORE_BRIDGE_URL,
    logger: () => {}, fetchImpl: (url, options) => handler(new Request(url, options)) });
  assert.equal((await call('shopee.cycle.acquire', { channel_account_id: account.account })).ok, true);
  assert.equal((await call('shopee.cycle.acquire', { channel_account_id: account.account, order_sn: SN })).status, 400);
  const data = { channel_account_id: account.account, lease_id: ID, page: null, candidate_order_sn: SN, outcome: 'pending', code: 'waiting' };
  assert.equal((await call('shopee.cycle.finish', data)).ok, true);
  for (const patch of [{ lease_id: 'bad' }, { outcome: 'retry_post' }, { code: 'private/token' },
    { page: { order_sns: [SN,SN], next_cursor: null } }, { page: { order_sns: [SN], next_cursor: 'x'.repeat(2049) } }]) {
    assert.equal((await call('shopee.cycle.finish', { ...data, ...patch })).status, 400);
  }
  assert.equal(executed, 2);
});

// Query adapter keeps these tests offline while exercising Core enrichment and
// integrity decisions; SQL lease/idempotency are tested in real PostgreSQL too.
function dbFixture({ raw, orders = [], docs = [], items = [], order } = {}) {
  const calls = [];
  return { calls, rpc: async () => ({ data: { status: 'acquired', candidate_order_sn: SN }, error: null }),
    from: table => {
      calls.push(table);
      const data = table === 'marketplace_raw_snapshots' ? { payload: { response: { order_list: raw ?? [{ order_sn: SN, package_list: [{ package_number: 'PKG' }] }] } } }
        : table === 'order_documents' ? docs : table === 'order_items' ? items : order ?? orders;
      const q = { then: (yes, no) => Promise.resolve({ data, error: null }).then(yes, no) };
      for (const k of ['select','eq','is','order','limit','maybeSingle']) q[k] = () => q;
      return q;
    } };
}
test('Core does not expose complete raw payload; wrong identity or existing arbitrary label blocks', async () => {
  const db = dbFixture({ raw: [{ order_sn: 'OTHERORDER' }] });
  const result = await executeCycleAction(db, { action: 'shopee.cycle.acquire', channel_account_id: account.account });
  assert.equal(result.body.candidate.blocked_reason, 'raw_identity_mismatch'); assert.equal(result.body.candidate.payload, undefined);
  const other = await executeCycleAction(db, { action: 'shopee.cycle.acquire', channel_account_id: ID }); assert.equal(other.status, 409);
  const attached = dbFixture({ orders: [{ id: ID, sale_origin: 'shopee_open_platform' }], docs: [{ source: 'manual' }] });
  assert.equal((await executeCycleAction(attached, { action: 'shopee.cycle.acquire', channel_account_id: account.account })).body.candidate.blocked_reason, 'existing_document_requires_review');
});
test('Core skips collected orders before any document or label work', async () => {
  const db = dbFixture({ raw: [{ order_sn: SN, order_status: 'SHIPPED' }], orders: [{ id: ID, sale_origin: 'shopee_open_platform' }],
    docs: [{ id: ID, source: 'shopee_open_platform', storage_bucket: 'shopee-labels', storage_path: ID + '/shopee-original.pdf' }] });
  const r = await executeCycleAction(db, { action: 'shopee.cycle.acquire', channel_account_id: account.account });
  assert.equal(r.body.candidate.terminal, true); assert.equal(db.calls.includes('order_documents'), false);
});
test('Core accepts only the original storage locator for this exact account/order/package', async () => {
  const hash = createHash('sha256').update([account.account, account.shop, SN, 'PKG'].join(':')).digest('hex');
  for (const path of [ID + '/shopee-' + hash + '.pdf', ID + '/shopee-other-package.pdf']) {
    const db = dbFixture({ orders: [{ id: ID, sale_origin: 'shopee_open_platform' }],
      docs: [{ id: ID, source: 'shopee_open_platform', storage_bucket: 'shopee-labels', storage_path: path }] });
    const r = await executeCycleAction(db, { action: 'shopee.cycle.acquire', channel_account_id: account.account });
    assert.equal(r.body.candidate.document_available, path.includes(hash));
    assert.equal(r.body.candidate.blocked_reason, path.includes(hash) ? null : 'existing_document_requires_review');
  }
});
test('canonical verification accepts conserved physical quantity/value, blocks changed multiplier or origin', async () => {
  const order = { id: ID, channel_account_id: account.account, channel: 'shopee', order_number: SN, sale_origin: 'shopee_open_platform', deleted_at: null };
  const payload = { channel_account_id: account.account, order_number: SN,
    items: [{ product_id: ID, variant_id: null, quantity: 1000, commercial_quantity: 1, unit_price: 27.99 }] };
  assert.equal(await verifyCycleOrder(dbFixture({ order, items: [{ product_id: ID, variant_id: null, quantity: 1000, unit_price: 0.02799 }] }), ID, payload), true);
  assert.equal(await verifyCycleOrder(dbFixture({ order, items: [{ product_id: ID, variant_id: null, quantity: 1, unit_price: 27.99 }] }), ID, payload), false);
  assert.equal(await verifyCycleOrder(dbFixture({ order: { ...order, sale_origin: 'manual' }, items: [] }), ID, payload), false);
});
