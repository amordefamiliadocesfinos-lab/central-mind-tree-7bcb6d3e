// Exact, account-scoped Adão commit authorization. Páscoa is no longer
// categorically excluded: its individually homologated pairs may be added to
// SHOPEE_ADAO_APPROVED_EASTER_MODEL_PAIRS. This only passes the policy gate;
// exact active physical mapping, projection, writer flags and individual commit
// authorization remain independent mandatory protections.
// Never infer approval from SKU/title, an active listing or mapping existence.
export const ADAO_CHANNEL_ACCOUNT_ID = 'b4027369-5abf-4ac1-ab24-862334fae892';

const PAIRS = /^\d+:\d+(,\d+:\d+)*$/;
function parseApprovedPairs(raw) {
  if (typeof raw !== 'string' || raw === '') return new Set();
  if (!PAIRS.test(raw)) return null; // malformed configuration: fail closed
  const pairs = raw.split(',');
  if (new Set(pairs).size !== pairs.length) return null;
  return new Set(pairs);
}

export function shopeeAdaoEasterCommitBlocker(normalized, {
  approvedPairs = process.env.SHOPEE_ADAO_NON_EASTER_MODEL_PAIRS ?? '',
  approvedEasterPairs = process.env.SHOPEE_ADAO_APPROVED_EASTER_MODEL_PAIRS ?? '',
} = {}) {
  if (normalized?.channelAccountId !== ADAO_CHANNEL_ACCOUNT_ID) return null;
  if (!Array.isArray(normalized?.orders) || normalized.orders.length !== 1) {
    return 'adao_pascoa_order_identity_unverified';
  }
  const regular = parseApprovedPairs(approvedPairs);
  const easter = parseApprovedPairs(approvedEasterPairs);
  if (regular === null || easter === null) {
    return 'adao_pascoa_exclusion_not_proven';
  }
  if (regular.size + easter.size === 0) {
    return 'adao_pascoa_exclusion_not_proven';
  }
  const items = normalized.orders[0]?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return 'adao_pascoa_order_identity_unverified';
  }
  for (const item of items) {
    const itemId = String(item?.itemId ?? '');
    const modelId = String(item?.modelId ?? '');
    if (!/^\d+$/.test(itemId) || !/^\d+$/.test(modelId)
        || (!regular.has(`${itemId}:${modelId}`) && !easter.has(`${itemId}:${modelId}`))) {
      return 'adao_pascoa_offer_not_approved_for_intake';
    }
  }
  return null;
}
