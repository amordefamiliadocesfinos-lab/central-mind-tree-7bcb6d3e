export const SHOPEE_OPERATIONAL_COMMIT_POLICY = Object.freeze({
  version: 'F6-K.1',
  batchLimit: 5,
  concurrency: 1,
  writerAttemptsPerRound: 1,
  retryStrategy: 'next_controlled_round',
  requireExactAccountIsolation: true,
  requireExactMapping: true,
  requireReadyProjection: true,
  stopOnBatchReadFailure: true,
  stopOnInfrastructureWriterException: true,
  continueAfterBusinessBlocker: true,
  continueAfterWriterRejected: true,
  idempotency: 'channel_account_id+order_number',
  successStatuses: Object.freeze(['written', 'already_registered']),
  retryableStatuses: Object.freeze(['write_failed']),
  blockedStatuses: Object.freeze(['blocked']),
  writes: Object.freeze(['orders', 'order_items', 'order_separation']),
  prohibitedWrites: Object.freeze([
    'inventory',
    'inventory_movements',
    'financial_entries',
    'financial_movements',
    'contacts',
    'contact_history',
    'service_conversations',
    'production_orders',
  ]),
});

export function classifyShopeeIntakeResult(entry = {}) {
  const status = typeof entry?.status === 'string' ? entry.status : 'unknown';
  if (status === 'written' || status === 'already_registered') return 'success';
  if (status === 'blocked') return 'blocked';
  if (status === 'write_failed') return 'retryable';
  return 'unknown';
}

export function summarizeShopeeControlledRound(result = {}) {
  const entries = Array.isArray(result?.results) ? result.results : [];
  const summary = {
    selected: Number(result?.selected ?? 0),
    ready: Number(result?.ready ?? 0),
    blocked: Number(result?.blocked ?? 0),
    written: Number(result?.written ?? 0),
    success: 0,
    retryable: 0,
    unknown: 0,
    statuses: {},
  };

  for (const entry of entries) {
    const status = typeof entry?.status === 'string' ? entry.status : 'unknown';
    summary.statuses[status] = (summary.statuses[status] ?? 0) + 1;

    const classification = classifyShopeeIntakeResult(entry);
    if (classification === 'success') summary.success += 1;
    else if (classification === 'retryable') summary.retryable += 1;
    else if (classification === 'unknown') summary.unknown += 1;
  }

  return summary;
}

export function shouldStopShopeeControlledRound({
  batchAvailable = true,
  writerException = false,
} = {}) {
  if (!batchAvailable && SHOPEE_OPERATIONAL_COMMIT_POLICY.stopOnBatchReadFailure) return true;
  if (writerException && SHOPEE_OPERATIONAL_COMMIT_POLICY.stopOnInfrastructureWriterException) return true;
  return false;
}

export function buildShopeeReprocessDecision(entry = {}) {
  const classification = classifyShopeeIntakeResult(entry);

  if (classification === 'success') {
    return {
      action: 'done',
      reason: entry?.status === 'already_registered' ? 'idempotent_existing_order' : 'persisted',
    };
  }

  if (classification === 'blocked') {
    return {
      action: 'hold',
      reason: Array.isArray(entry?.blockers) && entry.blockers.length > 0
        ? entry.blockers.join(',')
        : 'business_blocker',
    };
  }

  if (classification === 'retryable') {
    return {
      action: 'retry_next_round',
      reason: Array.isArray(entry?.blockers) && entry.blockers.length > 0
        ? entry.blockers.join(',')
        : 'writer_failure',
    };
  }

  return {
    action: 'hold',
    reason: 'unknown_result',
  };
}
