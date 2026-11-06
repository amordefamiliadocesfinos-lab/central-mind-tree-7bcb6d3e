// Production-only gate. Until non-Easter offers are independently verified and
// enumerated by exact account-scoped Shopee Item/Model IDs, Adão writes fail closed.
// No fallback to SKU, title, or the presence/absence of a mapping.
export const ADAO_CHANNEL_ACCOUNT_ID = 'b4027369-5abf-4ac1-ab24-862334fae892';

export function shopeeAdaoEasterCommitBlocker(normalized, {
  approvedPairs = process.env.SHOPEE_ADAO_NON_EASTER_MODEL_PAIRS ?? '',
} = {}) {
  if (normalized?.channelAccountId !== ADAO_CHANNEL_ACCOUNT_ID) return null;
  if (!Array.isArray(normalized?.orders) || normalized.orders.length !== 1) {
    return 'adao_pascoa_order_identity_unverified';
  }
  // Whitelist is only set after a separate commercial/physical verification.
  // Malformed or missing configuration cannot enable a writer.
  if (typeof approvedPairs !== 'string' || !/^\d+:\d+(,\d+:\d+)*$/.test(approvedPairs)) {
    return 'adao_pascoa_exclusion_not_proven';
  }
  const allowed = new Set(approvedPairs.split(','));
  const items = normalized.orders[0]?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return 'adao_pascoa_order_identity_unverified';
  }
  for (const item of items) {
    const itemId = String(item?.itemId ?? '');
    const modelId = String(item?.modelId ?? '');
    if (!/^\d+$/.test(itemId) || !/^\d+$/.test(modelId)
      || !allowed.has(`${itemId}:${modelId}`)) {
      return 'adao_pascoa_offer_not_approved_for_intake';
    }
  }
  return null;
}
