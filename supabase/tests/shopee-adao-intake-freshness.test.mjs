import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADAO_INTAKE_MAX_SNAPSHOT_AGE_MS,
  ADAO_INTAKE_FUTURE_TOLERANCE_MS,
  isFreshAdaoOrderSnapshot,
} from '../functions/integration-core-bridge/adao-intake-freshness.mjs';

const now = Date.parse('2026-11-10T17:00:00.000Z');
const row = (observed, persisted = observed) => ({
  observed_at: new Date(now - observed).toISOString(),
  created_at: new Date(now - persisted).toISOString(),
});

test('accepts a fresh persisted observation, including exact age boundary', () => {
  assert.equal(isFreshAdaoOrderSnapshot(row(0), now), true);
  assert.equal(isFreshAdaoOrderSnapshot(row(ADAO_INTAKE_MAX_SNAPSHOT_AGE_MS), now), true);
});

test('fail-closed for historical Shopee PROCESSED snapshots even if status looks eligible', () => {
  const old = { ...row(24 * 60 * 60 * 1000), payload: { response: { order_list: [{ order_status: 'PROCESSED' }] } } };
  assert.equal(isFreshAdaoOrderSnapshot(old, now), false);
  assert.equal(isFreshAdaoOrderSnapshot(row(ADAO_INTAKE_MAX_SNAPSHOT_AGE_MS + 1), now), false);
});

test('rejects old observation even if same raw snapshot was stored just now', () => {
  assert.equal(isFreshAdaoOrderSnapshot(row(6 * 60 * 1000, 0), now), false);
});

test('rejects old persistence even if observation looks fresh', () => {
  assert.equal(isFreshAdaoOrderSnapshot(row(0, 6 * 60 * 1000), now), false);
});

test('rejects missing, malformed and future timestamps', () => {
  assert.equal(isFreshAdaoOrderSnapshot({}, now), false);
  assert.equal(isFreshAdaoOrderSnapshot({ observed_at: 'garbage', created_at: new Date(now).toISOString() }, now), false);
  assert.equal(isFreshAdaoOrderSnapshot({ observed_at: null, created_at: null }, now), false);
  assert.equal(isFreshAdaoOrderSnapshot(row(-ADAO_INTAKE_FUTURE_TOLERANCE_MS - 1), now), false);
  assert.equal(isFreshAdaoOrderSnapshot(row(-ADAO_INTAKE_FUTURE_TOLERANCE_MS), now), true);
  assert.equal(isFreshAdaoOrderSnapshot(row(0), Number.NaN), false);
  assert.equal(isFreshAdaoOrderSnapshot(null, now), false);
});
