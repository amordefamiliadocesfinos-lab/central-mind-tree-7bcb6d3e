// Maltodextrina Shopee Adão V14: four fractioned gram models (MD1) and
// one ORIGINAL 25 kg sealed sack model (MD2). These commercial identities
// do not create physical stocks or authorize opening sealed sacks.
export const MALTO_ADAO_ACCOUNT_ID = 'b4027369-5abf-4ac1-ab24-862334fae892';
export const MALTO_PRODUCT_ID = '78fd74e2-1dc8-4c10-94a3-e661de6f8ba8';
export const MALTO_MD1_PRESENTATION_ID = 'd9e00f4e-e6c6-426d-b805-fe1cdb9ad2c7';
export const MALTO_MD2_PRESENTATION_ID = '2bad0e25-0000-4000-8000-000000002500';
export const MALTO_ADAO_MODELS = Object.freeze({
  '58211513468|189189988173': Object.freeze({kind:'fractioned_g',multiplier:1000}),
  '58211513468|189189988170': Object.freeze({kind:'fractioned_g',multiplier:2000}),
  '58211513468|189189988171': Object.freeze({kind:'fractioned_g',multiplier:3000}),
  '58211513468|189189988172': Object.freeze({kind:'fractioned_g',multiplier:4000}),
  '22295380075|219629064704': Object.freeze({kind:'sealed_sack',multiplier:1}),
});

export function maltoAdaoPhysicalBlocker(item, components, scope, contract) {
  if (scope?.channelAccountId !== MALTO_ADAO_ACCOUNT_ID) return 'malto_account_unverified';
  if (components.length !== 1) return 'malto_composition_invalid';
  const c = components[0];
  const identity = c?.physical_identity;
  if (c?.product_id !== MALTO_PRODUCT_ID || c?.variant_id != null
    || identity?.active !== true || identity?.unit !== 'g'
    || Number(c?.physical_multiplier) !== contract.multiplier) {
    return 'malto_physical_identity_unverified';
  }
  const q = Number(item?.quantity);
  if (!Number.isSafeInteger(q) || q < 1 || !Number.isSafeInteger(q * contract.multiplier)
    || q * contract.multiplier > 2147483647) return 'physical_quantity_invalid';
  // The MD2 separation path counts whole sacks (Q integer), not loose grams.
  // The stock event is dispatched only upon physical separation, never preview.
  if (contract.kind === 'sealed_sack') return null;
  if (!Array.isArray(identity.presentation_factors)
    || !identity.presentation_factors.some(f => Number(f) === 1000)) {
    return 'malto_fractioned_presentation_unverified';
  }
  return null;
}
