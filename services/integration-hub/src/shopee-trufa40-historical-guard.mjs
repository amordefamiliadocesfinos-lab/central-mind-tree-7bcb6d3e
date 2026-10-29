// Fixed-scope temporal quarantine: historical T40 IDs must not silently resolve
// through current titles, seller SKUs or mappings. Read-only predicate.
const ACCOUNT = 'b4027369-5abf-4ac1-ab24-862334fae892';
const SENSITIVE = Object.freeze({
  '19598189256': ['159546591760'], // ID retained; original mix composition unproven
  '21999552311': ['238789009560', '238789009561', '238789009562'],
  '22193668881': ['238778628464'],
  '22393654582': ['109869648890', '109869648891'],
});
export function shopeeTrufa40HistoricalBlocker(normalized) {
  if (String(normalized?.channelAccountId ?? '') !== ACCOUNT) return null;
  const orders = normalized?.orders;
  if (!Array.isArray(orders) || orders.length !== 1) return null;
  const affected = orders[0]?.items?.some(item =>
    (SENSITIVE[String(item?.itemId ?? '')] ?? []).includes(String(item?.modelId ?? '')));
  return affected ? 'trufa40_historical_model_identity_unverified' : null;
}
