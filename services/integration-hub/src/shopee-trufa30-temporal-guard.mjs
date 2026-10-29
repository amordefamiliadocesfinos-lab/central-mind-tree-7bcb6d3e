// Fail-closed temporal quarantine for Shopee model IDs re-used with new meanings.
// No reliable official cutover instant or historical order identity is established yet.
// This is deliberately independent of mutable titles, SKUs and current mappings.
const ACCOUNT = 'b4027369-5abf-4ac1-ab24-862334fae892';
const ITEM = '22898142109';
const REUSED_MODELS = new Set([
  '229425631222', '229425631223', '229425631224',
  '229425631225', '229425631226',
]);

export function shopeeTrufa30TemporalBlocker(normalized) {
  if (String(normalized?.channelAccountId ?? '') !== ACCOUNT) return null;
  const orders = normalized?.orders;
  if (!Array.isArray(orders) || orders.length !== 1) return null;
  const affected = orders[0]?.items?.some(item =>
    String(item?.itemId ?? '') === ITEM
    && REUSED_MODELS.has(String(item?.modelId ?? '')));
  return affected ? 'trufa30_reused_model_temporal_identity_unverified' : null;
}
