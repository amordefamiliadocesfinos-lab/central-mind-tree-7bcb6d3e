import test from 'node:test';
import assert from 'node:assert/strict';
import { syncLogisticsReadState } from '../../../supabase/functions/integration-core-bridge/logistics-read-state.mjs';
const account = 'b4027369-5abf-4ac1-ab24-862334fae892';
const entry = { order_sn: 'SYNTHETIC001', state: 'EXPEDIDO', reason: 'shipped_or_collected' };
const row = { order_number: entry.order_sn, channel_account_id: account,
  deleted_at: null, sale_origin: 'shopee_open_platform' };
function fixture(rows, lookupError = null, writeError = null) {
  const writes = [];
  const core = { from(table) {
    if (table === 'orders') return { select() { return this; },
      eq(key, value) { assert.equal(key, 'channel_account_id'); assert.equal(value, account); return this; },
      async in(key, values) { assert.equal(key, 'order_number'); assert.deepEqual(values, [entry.order_sn]);
        return { data: rows, error: lookupError }; } };
    assert.equal(table, 'shopee_logistics_read_state');
    return { async upsert(data) { writes.push(data); return { error: writeError }; } };
  } };
  return { core, writes };
}
test('Core sync persists only sanitized state for the active canonical API order', async () => {
  const { core, writes } = fixture([row]);
  assert.equal((await syncLogisticsReadState(core, account, [entry])).status, 200);
  assert.deepEqual(Object.keys(writes[0][0]).sort(),
    ['channel_account_id', 'observed_at', 'order_sn', 'reason', 'state']);
});
for (const [name, rows] of Object.entries({ deleted: [{ ...row, deleted_at: '2026-10-26' }],
  duplicate_tombstone: [row, { ...row, deleted_at: '2026-10-26' }], missing: [],
  wrong_account: [{ ...row, channel_account_id: 'other' }],
  manual_order: [{ ...row, sale_origin: 'manual' }], wrong_order: [{ ...row, order_number: 'OTHER001' }] })) {
  test(`Core sync rejects ${name} without writing state`, async () => {
    const { core, writes } = fixture(rows);
    assert.equal((await syncLogisticsReadState(core, account, [entry])).status, 409);
    assert.equal(writes.length, 0);
  });
}
test('Core lookup and persistence errors fail closed', async () => {
  const lookup = fixture([row], {});
  assert.equal((await syncLogisticsReadState(lookup.core, account, [entry])).status, 409);
  assert.equal(lookup.writes.length, 0);
  const write = fixture([row], null, {});
  assert.equal((await syncLogisticsReadState(write.core, account, [entry])).status, 503);
});
