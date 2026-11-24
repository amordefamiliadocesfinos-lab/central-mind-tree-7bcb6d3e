// Celivio C4-F: advisory eligibility and missing-evidence ledger.
// This module is PURE: no Core bridge, Shopee, auth, DB or writer imports.
// "candidate" describes validated historical evidence, NOT live status
// or permission to create an internal order.
import { assessCelivioC4CPreflight, CELIVIO_C4C_ACCOUNT_ID, CELIVIO_C4C_SHOP_ID }
  from './shopee-celivio-c4c-preflight.mjs';

export const CELIVIO_C4F_PILOT = '261121TBS6BHE6';
export const CELIVIO_C4F_RAW_ID = '90ebdbb3-1bc5-4043-9d45-d78b77c0ea1a';
const text = v => typeof v === 'string' ? v.trim() : String(v ?? '').trim();
const finiteNonNegative = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;

export function assessCelivioC4FIntakeReadiness({
  raw = null, mappingMatches = [], physicalConversionHomologated = false,
  duplicateChecked = false, existingOrder = null,
  latestExternalStatusConfirmed = false, monetaryEvidenceConfirmed = false,
  shippingContextConfirmed = false,
} = {}) {
  const blockers = [];
  // Fail closed on unexpected provenance or a mismatch between Raw envelope and payload.
  const orderList=raw?.payload?.response?.order_list;
  const order=Array.isArray(orderList) && orderList.length === 1 ? orderList[0] : null;
  const item=Array.isArray(order?.item_list) && order.item_list.length === 1 ? order.item_list[0] : null;
  if (raw?.source !== 'shopee_open_platform'
    || raw?.environment !== 'live'
    || raw?.endpoint !== '/api/v2/order/get_order_detail'
    || raw?.external_entity_type !== 'order'
    || text(raw?.channel_account_id) !== CELIVIO_C4C_ACCOUNT_ID
    || text(raw?.external_entity_id) !== CELIVIO_C4F_PILOT
    || text(order?.order_sn) !== CELIVIO_C4F_PILOT
    || !item) blockers.push('real_raw_scope_or_shape_unverified');
  if (text(raw?.id) !== CELIVIO_C4F_RAW_ID) blockers.push('raw_identity_not_verified');

  const gate=assessCelivioC4CPreflight({
    channelAccountId:raw?.channel_account_id,
    shopId:CELIVIO_C4C_SHOP_ID,
    orderSn:order?.order_sn,
    externalStatus:order?.order_status,
    itemId:item?.item_id,modelId:item?.model_id,
    quantity:item?.model_quantity_purchased,
    mappingMatches,rawOrderDetailPersisted:raw?.id === CELIVIO_C4F_RAW_ID,
    physicalConversionHomologated,duplicateChecked,existingOrder,
  });
  blockers.push(...gate.blockers);
  // The shared Adão F6-H/F6-I contract accepts unknown monetary fields as
  // null; pricing is not a new Celivio-only structural precondition.
  // Keep a separate evidence gap for business reconciliation: this does NOT
  // certify that a missing amount is zero or paid.
  const hasMoney=finiteNonNegative(order?.total_amount)
    && finiteNonNegative(item?.model_discounted_price);
  const evidencePending = [];
  if (!hasMoney || monetaryEvidenceConfirmed !== true)
    evidencePending.push('monetary_evidence_missing_or_unverified');
  // Shipping/labels belong to F6-O / Operations, AFTER order intake.
  // Missing logistics cannot block the structural Pedido+Itens preview.
  if (shippingContextConfirmed !== true)
    evidencePending.push('shipping_context_for_later_operations');
  // The recorded PROCESSED status is historical; a new pre-commit check
  // remains mandatory before any future real writer authorization.
  if (latestExternalStatusConfirmed !== true)
    evidencePending.push('current_external_status_not_rechecked');
  return {
    schemaVersion:1,account:'celivio',orderSn:CELIVIO_C4F_PILOT,
    rawId:CELIVIO_C4F_RAW_ID,
    advisoryStructuralCandidate:gate.candidateForNextGate && !blockers.includes('real_raw_scope_or_shape_unverified')
      && !blockers.includes('raw_identity_not_verified'),
    // Only advisory preview readiness. NEVER equivalent to commit readiness.
    nextGateReady:blockers.length === 0,
    blockers:[...new Set(blockers)],
    evidencePending,
    // Reader/preview may continue with null money and deferred logistics;
    // no such fact may be invented, silently priced or marked reconciled.
    requiredBeforeAnyWriterAuthorization:[
      'confirm_current_shopee_status',
      'recheck_duplicate_immediately_before_atomic_creation',
      'review_missing_monetary_evidence_under_shared_contract',
      'separate_explicit_owner_approval_and_production_gate',
    ],
    writerAuthorized:false,operationalWrites:false,rawWrites:false,
    orderWrites:false,itemWrites:false,separationAuthorized:false,
    inventoryActionAuthorized:false,labelActionAuthorized:false,
    tokenRefreshAuthorized:false,
  };
}
