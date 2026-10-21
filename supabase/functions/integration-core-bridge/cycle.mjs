const ACCOUNT = '8a8ad166-0317-4597-8be6-e43fb46b4d1b';

// Core alone selects queue entries. No client-supplied order/package can select
// work. The lease is durable in Postgres, shared across all Hub instances.
export async function executeCycleAction(core, payload) {
  if (payload.channel_account_id !== ACCOUNT) return { status: 409, body: { error: 'cycle_account_refused' } };
  const acquiring = payload.action === 'shopee.cycle.acquire';
  const { data, error } = await core.rpc(acquiring ? 'acquire_shopee_cycle' : 'finish_shopee_cycle', acquiring
    ? { p_channel_account_id: ACCOUNT }
    : { p_channel_account_id: ACCOUNT, p_lease_id: payload.lease_id, p_page: payload.page,
      p_candidate_order_sn: payload.candidate_order_sn, p_outcome: payload.outcome, p_code: payload.code });
  if (error || !data) return { status: 503, body: { error: 'cycle_state_unavailable' } };
  if (data.status !== (acquiring ? 'acquired' : 'finished')) return { status: 409, body: { error: 'cycle_lease_refused' } };
  if (!acquiring || !data.candidate_order_sn) return { status: 200, body: { ...data, candidate: null } };
  const sn = data.candidate_order_sn;
  const raw = await core.from('marketplace_raw_snapshots').select('payload')
    .eq('channel_account_id', ACCOUNT).eq('source', 'shopee_open_platform').eq('environment', 'live')
    .eq('external_entity_type', 'order').eq('endpoint', '/api/v2/order/get_order_detail')
    .eq('external_entity_id', sn).order('observed_at', { ascending: false }).limit(1).maybeSingle();
  // A failed read leaves the lease in place. Expired selected work is quarantined.
  if (raw.error) return { status: 503, body: { error: 'cycle_candidate_read_failed' } };
  const rows = raw.data?.payload?.response?.order_list;
  const exact = Array.isArray(rows) && rows.length === 1 && rows[0]?.order_sn === sn;
  const order = exact ? rows[0] : null;
  const candidate = { order_sn: sn, package_number: order?.package_list?.length === 1
    ? order.package_list[0]?.package_number ?? null : null,
    terminal: ['CANCELLED', 'SHIPPED', 'COMPLETED', 'IN_CANCEL', 'TO_RETURN'].includes(order?.order_status)
      || order?.package_list?.some(p => ['LOGISTICS_PICKUP_DONE','LOGISTICS_DELIVERY_DONE'].includes(p.logistics_status)) === true,
    blocked_reason: exact ? null : 'raw_identity_mismatch' };
  const found = await core.from('orders').select('id,sale_origin,status').eq('channel_account_id', ACCOUNT)
    .eq('channel', 'shopee').eq('order_number', sn).is('deleted_at', null).limit(2);
  if (found.error) return { status: 503, body: { error: 'cycle_order_read_failed' } };
  if (found.data?.length > 1 || (found.data?.length === 1 && found.data[0].sale_origin !== 'shopee_open_platform')) {
    candidate.blocked_reason = 'canonical_order_conflict';
  }
  if (found.data?.length === 1) {
    if (['cancelado','finalizado'].includes(found.data[0].status)) candidate.terminal = true;
    const docs = await core.from('order_documents').select('id,source,storage_bucket,storage_path')
      .eq('order_id', found.data[0].id).eq('document_type', 'shipping_label').limit(2);
    if (docs.error) return { status: 503, body: { error: 'cycle_document_read_failed' } };
    if (docs.data?.length) {
      const doc = docs.data[0];
      candidate.document_available = docs.data.length === 1 && doc.source === 'shopee_open_platform'
        && doc.storage_bucket === 'shopee-labels' && doc.storage_path?.startsWith(found.data[0].id + '/shopee-');
      if (!candidate.document_available) candidate.blocked_reason = 'existing_document_requires_review';
    }
  }
  return { status: 200, body: { ...data, candidate } };
}

// The legacy writer is idempotent but does not compare already-existing items.
// Recurring callers must prove the current exact mapping still describes the
// canonical order before allowing any label work. Never repair quantities here.
export async function verifyCycleOrder(core, orderId, payload) {
  const order = await core.from('orders').select('id,channel_account_id,channel,order_number,sale_origin,deleted_at')
    .eq('id', orderId).maybeSingle();
  const o = order.data;
  if (order.error || !o || o.channel_account_id !== payload.channel_account_id || o.channel !== 'shopee'
    || o.order_number !== payload.order_number || o.sale_origin !== 'shopee_open_platform' || o.deleted_at != null) return false;
  const items = await core.from('order_items').select('product_id,variant_id,quantity,unit_price').eq('order_id', orderId);
  if (items.error || !Array.isArray(items.data)) return false;
  const totals = (rows, projected) => {
    const grouped = new Map();
    for (const i of rows) {
      const key = i.product_id + ':' + (i.variant_id ?? '');
      const qty = Number(i.quantity);
      const price = projected ? i.unit_price == null ? null : Number(i.commercial_quantity) * Number(i.unit_price) / qty
        : i.unit_price == null ? null : Number(i.unit_price);
      if (!Number.isSafeInteger(qty) || qty <= 0 || (price !== null && (!Number.isFinite(price) || price < 0))) return null;
      const prev = grouped.get(key) ?? { quantity: 0, value: 0, unknown: 0 };
      prev.quantity += qty; prev.value += price === null ? 0 : price * qty; prev.unknown += price === null ? qty : 0;
      grouped.set(key, prev);
    }
    return grouped;
  };
  const expected = totals(payload.items, true), actual = totals(items.data, false);
  return expected !== null && actual !== null && expected.size === actual.size
    && [...expected].every(([k, e]) => { const a = actual.get(k); return a && a.quantity === e.quantity
      && a.unknown === e.unknown && Math.abs(a.value - e.value) < 0.00001; });
}
