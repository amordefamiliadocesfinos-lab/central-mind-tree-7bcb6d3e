// Celivio C4-C: pure, non-mutating evidence gate ahead of existing
// Raw -> normalizer -> mapping preview -> projection -> internal contract.
// This module MUST NOT import Core writers, Shopee clients or crypto.
export const CELIVIO_C4C_ACCOUNT_ID = 'd26c7a30-aa4a-4441-8012-600d70453689';
export const CELIVIO_C4C_SHOP_ID = 1357031949;

// Matches the existing controlled intake policy. Do not turn UNPAID into
// a pending internal order simply because an Item/Model mapping exists.
const ELIGIBLE_STATUSES = new Set(['PROCESSED', 'READY_TO_SHIP']);
const text = (v) => typeof v === 'string' ? v.trim() : String(v ?? '').trim();

export function assessCelivioC4CPreflight({
  channelAccountId, shopId, orderSn, externalStatus,
  itemId, modelId, quantity, mappingMatches = [],
  rawOrderDetailPersisted = false, physicalConversionHomologated = false,
  existingOrder = null,
} = {}) {
  const blockers = [];
  if (text(channelAccountId) !== CELIVIO_C4C_ACCOUNT_ID
    || Number(shopId) !== CELIVIO_C4C_SHOP_ID) blockers.push('celivio_identity_mismatch');
  if (!/^[A-Za-z0-9]{8,40}$/.test(text(orderSn))) blockers.push('invalid_order_sn');
  if (!ELIGIBLE_STATUSES.has(text(externalStatus))) blockers.push('external_status_not_intake_eligible');
  if (!/^\d+$/.test(text(itemId)) || !/^\d+$/.test(text(modelId))) blockers.push('invalid_item_model_identity');
  if (!Number.isSafeInteger(quantity) || quantity < 1) blockers.push('invalid_commercial_quantity');

  // Require exactly one record with the official Item+Model and account.
  const exact = Array.isArray(mappingMatches) ? mappingMatches.filter((m) =>
    text(m?.channel_account_id) === CELIVIO_C4C_ACCOUNT_ID
    && text(m?.external_item_id) === text(itemId)
    && text(m?.external_model_id) === text(modelId)
    && text(m?.product_id) !== ''
    && Number.isFinite(Number(m?.physical_multiplier))
    && Number(m.physical_multiplier) > 0
  ) : [];
  if (exact.length !== 1) blockers.push(exact.length === 0 ? 'official_mapping_not_resolved' : 'ambiguous_official_mapping');

  if (rawOrderDetailPersisted !== true) blockers.push('raw_order_detail_not_persisted');
  if (physicalConversionHomologated !== true) blockers.push('physical_conversion_not_homologated');
  if (existingOrder !== null) blockers.push('already_imported_or_unverified_duplicate');

  return {
    schemaVersion: 1,
    account: 'celivio',
    channelAccountId: CELIVIO_C4C_ACCOUNT_ID,
    shopId: CELIVIO_C4C_SHOP_ID,
    orderSn: text(orderSn) || null,
    externalStatus: text(externalStatus) || null,
    itemId: text(itemId) || null,
    modelId: text(modelId) || null,
    candidateForNextGate: blockers.length === 0,
    blockers,
    // A clean preview is NEVER permission to persist or perform operations.
    operationalWrites: false,
    writerAuthorized: false,
    rawWrites: false,
    separationAuthorized: false,
    inventoryActionAuthorized: false,
  };
}
