import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SHOPEE_OPERATIONAL_COMMIT_POLICY,
  buildShopeeReprocessDecision,
  classifyShopeeIntakeResult,
  shouldStopShopeeControlledRound,
  summarizeShopeeControlledRound,
} from '../src/shopee-intake-policy.mjs';

test('F6-K.1 freezes conservative automatic commit policy', () => {
  assert.equal(SHOPEE_OPERATIONAL_COMMIT_POLICY.version, 'F6-K.1');
  assert.equal(SHOPEE_OPERATIONAL_COMMIT_POLICY.batchLimit, 5);
  assert.equal(SHOPEE_OPERATIONAL_COMMIT_POLICY.concurrency, 1);
  assert.equal(SHOPEE_OPERATIONAL_COMMIT_POLICY.writerAttemptsPerRound, 1);
  assert.equal(SHOPEE_OPERATIONAL_COMMIT_POLICY.retryStrategy, 'next_controlled_round');
  assert.equal(SHOPEE_OPERATIONAL_COMMIT_POLICY.requireExactAccountIsolation, true);
  assert.equal(SHOPEE_OPERATIONAL_COMMIT_POLICY.requireExactMapping, true);
  assert.equal(SHOPEE_OPERATIONAL_COMMIT_POLICY.requireReadyProjection, true);
  assert.equal(SHOPEE_OPERATIONAL_COMMIT_POLICY.stopOnBatchReadFailure, true);
  assert.equal(SHOPEE_OPERATIONAL_COMMIT_POLICY.stopOnInfrastructureWriterException, true);
  assert.equal(SHOPEE_OPERATIONAL_COMMIT_POLICY.continueAfterBusinessBlocker, true);
  assert.equal(SHOPEE_OPERATIONAL_COMMIT_POLICY.continueAfterWriterRejected, true);
  assert.deepEqual(SHOPEE_OPERATIONAL_COMMIT_POLICY.writes, [
    'orders',
    'order_items',
    'order_separation',
  ]);
});

test('classifies intake outcomes for operational handling', () => {
  assert.equal(classifyShopeeIntakeResult({ status: 'written' }), 'success');
  assert.equal(classifyShopeeIntakeResult({ status: 'already_registered' }), 'success');
  assert.equal(classifyShopeeIntakeResult({ status: 'blocked' }), 'blocked');
  assert.equal(classifyShopeeIntakeResult({ status: 'write_failed' }), 'retryable');
  assert.equal(classifyShopeeIntakeResult({ status: 'anything_else' }), 'unknown');
});

test('summarizes a controlled round without leaking writer payloads', () => {
  const summary = summarizeShopeeControlledRound({
    selected: 4,
    ready: 3,
    blocked: 1,
    written: 1,
    results: [
      { status: 'written', write: { secret: 'ignore' } },
      { status: 'already_registered', write: { secret: 'ignore' } },
      { status: 'write_failed', write: { secret: 'ignore' } },
      { status: 'blocked', blockers: ['mapping_needs_mapping'] },
    ],
  });

  assert.deepEqual(summary, {
    selected: 4,
    ready: 3,
    blocked: 1,
    written: 1,
    success: 2,
    retryable: 1,
    unknown: 0,
    statuses: {
      written: 1,
      already_registered: 1,
      write_failed: 1,
      blocked: 1,
    },
  });
});

test('stops the round on batch unavailability or infrastructure writer exception', () => {
  assert.equal(shouldStopShopeeControlledRound({ batchAvailable: false }), true);
  assert.equal(shouldStopShopeeControlledRound({ writerException: true }), true);
  assert.equal(shouldStopShopeeControlledRound({ batchAvailable: true, writerException: false }), false);
});

test('reprocess decisions keep success done, blocker held and writer failure for next round', () => {
  assert.deepEqual(buildShopeeReprocessDecision({ status: 'written' }), {
    action: 'done',
    reason: 'persisted',
  });
  assert.deepEqual(buildShopeeReprocessDecision({ status: 'already_registered' }), {
    action: 'done',
    reason: 'idempotent_existing_order',
  });
  assert.deepEqual(buildShopeeReprocessDecision({
    status: 'blocked',
    blockers: ['mapping_needs_mapping'],
  }), {
    action: 'hold',
    reason: 'mapping_needs_mapping',
  });
  assert.deepEqual(buildShopeeReprocessDecision({
    status: 'write_failed',
    blockers: ['writer_exception'],
  }), {
    action: 'retry_next_round',
    reason: 'writer_exception',
  });
  assert.deepEqual(buildShopeeReprocessDecision({ status: 'mystery' }), {
    action: 'hold',
    reason: 'unknown_result',
  });
});
