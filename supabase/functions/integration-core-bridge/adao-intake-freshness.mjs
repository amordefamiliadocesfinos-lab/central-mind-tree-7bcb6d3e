// F5-U4: Adão-only intake freshness guard. A raw snapshot is historical evidence,
// not proof that an order remains eligible in the Shopee Seller Center.
// Reject missing, invalid, future or stale observation AND persistence timestamps.
export const ADAO_INTAKE_ACCOUNT_ID = 'b4027369-5abf-4ac1-ab24-862334fae892';
export const ADAO_INTAKE_MAX_SNAPSHOT_AGE_MS = 5 * 60 * 1000;
export const ADAO_INTAKE_FUTURE_TOLERANCE_MS = 30 * 1000;

function timestampMs(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isFreshAdaoOrderSnapshot(row, nowMs = Date.now()) {
  if (!row || typeof row !== 'object' || !Number.isFinite(nowMs)) return false;
  const observedMs = timestampMs(row.observed_at);
  const persistedMs = timestampMs(row.created_at);
  if (observedMs === null || persistedMs === null) return false;
  return [observedMs, persistedMs].every(ts =>
    nowMs - ts <= ADAO_INTAKE_MAX_SNAPSHOT_AGE_MS
    && ts - nowMs <= ADAO_INTAKE_FUTURE_TOLERANCE_MS);
}
