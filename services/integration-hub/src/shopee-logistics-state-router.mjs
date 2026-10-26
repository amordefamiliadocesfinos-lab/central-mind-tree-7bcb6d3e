import { assessFiscalReadiness } from './shopee-shipping-preflight.mjs';

// Pure, fail-closed classification. It never invokes Shopee, writes orders or authorizes dispatch.
const PACKAGE_ID = /^[A-Za-z0-9_-]{1,100}$/;
const PREPARABLE = new Set(['LOGISTICS_READY', 'LOGISTICS_PICKUP_RETRY']);
const ARRANGED = new Set(['LOGISTICS_REQUEST_CREATED', 'LOGISTICS_PICKUP_REQUESTED', 'LOGISTICS_PICKUP_APPROVED']);
const SHIPPED = new Set(['SHIPPED', 'COMPLETED', 'TO_CONFIRM_RECEIVE']);
const DISPATCHED_PACKAGE = new Set(['LOGISTICS_PICKUP_DONE', 'LOGISTICS_DELIVERY_DONE', 'LOGISTICS_DELIVERED']);

const result = (state, reason) => Object.freeze({
  state, reason, auto_arrangement_authorized: false,
  create_shipping_document_authorized: false, inventory_mutation_authorized: false,
});

export function classifyShopeeLogistics(order, { fiscalMode, deleted = false } = {}) {
  if (deleted || order?.deleted_at != null) return result('BLOQUEADO', 'historically_deleted');
  if (!order || typeof order !== 'object' || typeof order.order_sn !== 'string') {
    return result('INDETERMINADO', 'missing_order_identity');
  }
  const status = typeof order.order_status === 'string' ? order.order_status.trim().toUpperCase() : '';
  if (!status) return result('INDETERMINADO', 'missing_order_status');
  if (status === 'CANCELLED' || status === 'IN_CANCEL' || status === 'UNPAID') {
    return result('BLOQUEADO', 'order_not_actionable');
  }
  const packages = order.package_list;
  if (!Array.isArray(packages) || packages.length !== 1) {
    return result('INDETERMINADO', 'single_package_unconfirmed');
  }
  const pkg = packages[0];
  const number = pkg?.package_number;
  const packageValid = typeof number === 'string' && PACKAGE_ID.test(number);
  const logistics = typeof pkg?.logistics_status === 'string'
    ? pkg.logistics_status.trim().toUpperCase() : '';
  if (SHIPPED.has(status) || DISPATCHED_PACKAGE.has(logistics)) {
    return result('EXPEDIDO', 'shipped_or_collected');
  }
  if (status !== 'READY_TO_SHIP') return result('BLOQUEADO', 'order_not_ready_to_ship');
  if (!packageValid || !logistics) return result('INDETERMINADO', 'package_identity_or_status_missing');
  if (ARRANGED.has(logistics)) return result('ENVIO_JA_ORGANIZADO', 'arrangement_recorded');
  if (!PREPARABLE.has(logistics)) return result('INDETERMINADO', 'unrecognized_package_status');
  const fiscal = assessFiscalReadiness(order, fiscalMode);
  if (!fiscal.ready) return result('BLOQUEADO', fiscal.code);
  return result('AGUARDANDO_ORGANIZACAO', 'preflight_required');
}
