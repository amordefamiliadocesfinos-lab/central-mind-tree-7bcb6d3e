export function previewTrufasMappings(reference, mappings, accountId) {
  if (!Array.isArray(reference) || !Array.isArray(mappings) || !accountId) throw new TypeError('invalid input');
  const seen = new Set();
  const rows = reference.map(row => {
    const itemId = String(row.item_id ?? '');
    const modelId = String(row.model_id ?? '');
    if (!itemId || !modelId) throw new TypeError('missing official identity');
    const key = accountId + ':' + itemId + ':' + modelId;
    if (seen.has(key)) throw new TypeError('duplicate source identity');
    seen.add(key);
    const hits = mappings.filter(m => m.marketplace === 'shopee' &&
      m.channel_account_id === accountId &&
      String(m.external_item_id ?? '') === itemId &&
      String(m.external_model_id ?? '') === modelId);
    return { itemId, modelId, status: hits.length === 0 ? 'missing' :
      hits.length === 1 ? 'present_unverified' : 'duplicate', count: hits.length };
  });
  return { writes: false, selected: rows.length,
    missing: rows.filter(r => r.status === 'missing').length,
    duplicate: rows.filter(r => r.status === 'duplicate').length,
    rows };
}
