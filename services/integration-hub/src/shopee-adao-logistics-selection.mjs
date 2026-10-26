import { classifyShopeeLogistics } from './shopee-logistics-state-router.mjs';

// Offline, side-effect-free selection from already fetched order details.
// Requires explicit tombstone evidence and account identity before classification.
export const ADAO_LOGISTICS_ACCOUNT = Object.freeze({
  channel_account_id: 'b4027369-5abf-4ac1-ab24-862334fae892',
  shop_id: 1156446003,
});

export function selectAdaoLogisticsOrders({
  channelAccountId, shopId, orders, deletedOrderSns, fiscalMode = 'cpf_no_invoice_step',
} = {}) {
  if (channelAccountId !== ADAO_LOGISTICS_ACCOUNT.channel_account_id ||
      shopId !== ADAO_LOGISTICS_ACCOUNT.shop_id) {
    return { ok: false, code: 'account_identity_mismatch', selected: [] };
  }
  if (!Array.isArray(orders) || !(deletedOrderSns instanceof Set) ||
      [...deletedOrderSns].some(sn => typeof sn !== 'string')) {
    return { ok: false, code: 'tombstone_evidence_required', selected: [] };
  }
  if (fiscalMode !== 'cpf_no_invoice_step') {
    return { ok: false, code: 'account_fiscal_mode_mismatch', selected: [] };
  }
  const seen = new Set();
  const selected = [];
  for (const order of orders) {
    const sn = order?.order_sn;
    if (typeof sn !== 'string' || !/^[A-Za-z0-9]{8,100}$/.test(sn) || seen.has(sn)) {
      return { ok: false, code: 'invalid_or_duplicate_order_identity', selected: [] };
    }
    seen.add(sn);
    const classification = classifyShopeeLogistics(order, {
      fiscalMode, deleted: deletedOrderSns.has(sn),
    });
    selected.push({
      order_sn: sn,
      state: classification.state,
      reason: classification.reason,
      package_count: Array.isArray(order.package_list) ? order.package_list.length : null,
      // External logistics state does not establish internal physical separation.
      auto_arrangement_authorized: false,
      create_shipping_document_authorized: false,
      inventory_mutation_authorized: false,
    });
  }
  return { ok: true, account: 'adao', selected };
}
