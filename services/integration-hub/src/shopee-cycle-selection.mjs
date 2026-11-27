// Shared F12 selection primitives, extracted verbatim from the proven Adão implementation.
// Inputs must already be scoped and validated by the caller; selection never authorizes writes.
const ORDER_RE = /^[A-Za-z0-9]{8,100}$/;
export const SHOPEE_MAX_BATCH_PER_TYPE = 3;
export function shopeeBatchLimit(value) {
  const raw = String(value ?? '').trim();
  if (!/^[1-3]$/.test(raw)) return 1;
  return Math.min(Number(raw), SHOPEE_MAX_BATCH_PER_TYPE);
}
export function selectShopeeBatchCandidates(sns, nowMs, limit = 1) {
  if (!Array.isArray(sns) || !Number.isFinite(nowMs)) return [];
  const sorted = [...new Set(sns)].filter(sn => typeof sn === 'string' && ORDER_RE.test(sn)).sort();
  if (!sorted.length) return [];
  const count = Math.min(shopeeBatchLimit(limit), sorted.length);
  const offset = Math.floor(nowMs / 300_000) % sorted.length;
  return Array.from({ length: count }, (_, i) => sorted[(offset + i) % sorted.length]);
}
// F12.2: trust only the live Shopee ship_by_date (Unix seconds). Orders
// without a trustworthy deadline use older create_time first; never infer
// a ship-by timestamp from paid time or days_to_ship.
export function selectShopeePendingShipments(candidates, nowMs, limit = 1) {
  if (!Array.isArray(candidates) || !Number.isFinite(nowMs)) return [];
  const valid = new Map();
  for (const candidate of candidates) {
    const sn = candidate?.order_sn;
    if (typeof sn !== 'string' || !ORDER_RE.test(sn) || valid.has(sn)) continue;
    const created = candidate?.create_time;
    const deadline = candidate?.ship_by_date;
    valid.set(sn, {
      created: Number.isSafeInteger(created) && created > 0 ? created : null,
      deadline: Number.isSafeInteger(deadline) && deadline >= 1_000_000_000
        && deadline <= 4_102_444_800 ? deadline : null,
    });
  }
  // Official deadlines take precedence over age-only fallback. No field
  // means no asserted deadline; it does not mean already overdue.
  const ordered = [...valid].sort(([a, x], [b, y]) =>
    (x.deadline === null) - (y.deadline === null)
    || (x.deadline ?? 0) - (y.deadline ?? 0)
    || (x.created === null) - (y.created === null)
    || (x.created ?? 0) - (y.created ?? 0)
    || a.localeCompare(b)
  );
  // Preserve fairness across scheduler cycles among candidates with the
  // same deadline AND age; do not rotate newer ones ahead of older.
  const ranked = [];
  for (let i = 0; i < ordered.length;) {
    let j = i + 1;
    while (j < ordered.length
      && ordered[j][1].deadline === ordered[i][1].deadline
      && ordered[j][1].created === ordered[i][1].created) j++;
    const group = ordered.slice(i, j).map(([sn]) => sn);
    const rotated = group.length <= 1 ? group :
      [...group.slice(Math.floor(nowMs / 300_000) % group.length),
        ...group.slice(0, Math.floor(nowMs / 300_000) % group.length)];
    ranked.push(...rotated);
    i = j;
  }
  return ranked.slice(0, Math.min(shopeeBatchLimit(limit), valid.size));
}

export function selectShopeeLabelCandidate(orderSns, nowMs) {
  if (!Array.isArray(orderSns) || !orderSns.length || !Number.isFinite(nowMs)) return null;
  const unique = [...new Set(orderSns)].filter(sn => typeof sn === 'string' && ORDER_RE.test(sn)).sort();
  if (!unique.length) return null;
  return unique[Math.floor(nowMs / 300_000) % unique.length];
}

