// HMAC payload validation remains in handler.mjs. No Shopee or operational writer.
export async function syncLogisticsReadState(core, accountId, entries) {
  if (accountId !== 'b4027369-5abf-4ac1-ab24-862334fae892') {
    return { status: 409, body: { error: 'canonical_order_verification_failed' } };
  }
  const sns = entries.map(entry => entry.order_sn);
  const { data: canonical, error: lookupError } = await core.from('orders')
    .select('order_number,deleted_at,channel_account_id,sale_origin')
    .eq('channel_account_id', accountId).in('order_number', sns);
  if (lookupError || !Array.isArray(canonical) || canonical.length !== entries.length
    || canonical.some(row => row.deleted_at != null || row.channel_account_id !== accountId
      || row.sale_origin !== 'shopee_open_platform' || !sns.includes(row.order_number))
    || new Set(canonical.map(row => row.order_number)).size !== sns.length) {
    return { status: 409, body: { error: 'canonical_order_verification_failed' } };
  }
  const { error } = await core.from('shopee_logistics_read_state')
    .upsert(entries.map(entry => ({ channel_account_id: accountId,
      order_sn: entry.order_sn, state: entry.state, reason: entry.reason,
      observed_at: new Date().toISOString(),
    })), { onConflict: 'channel_account_id,order_sn' });
  return error ? { status: 503, body: { error: 'logistics_snapshot_write_failed' } }
    : { status: 200, body: { status: 'ok', count: entries.length } };
}
