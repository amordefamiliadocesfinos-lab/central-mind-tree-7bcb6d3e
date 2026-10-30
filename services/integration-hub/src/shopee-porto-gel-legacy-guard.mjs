// Fail-closed historical identity guard, read-only. Scope: Shopee Adão.
const ACCOUNT = 'b4027369-5abf-4ac1-ab24-862334fae892';
const LEGACY_ITEM = '58211561353';
const LEGACY_MODEL = '199622481703'; // historical 5 kg, no longer listed

export function shopeePortoGelLegacyBlocker(normalized) {
  if (String(normalized?.channelAccountId ?? '') !== ACCOUNT) return null;
  if (!Array.isArray(normalized?.orders) || normalized.orders.length !== 1) return null;
  const affected = normalized.orders[0]?.items?.some(item =>
    String(item?.itemId ?? '') === LEGACY_ITEM &&
    String(item?.modelId ?? '') === LEGACY_MODEL);
  return affected ? 'porto_gel_historical_5kg_identity_unverified' : null;
}
