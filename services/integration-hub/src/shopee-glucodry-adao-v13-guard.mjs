// Glucodry Shopee Adão V13: original Model IDs preserved; GD1 is loose grams,
// GD2 is one ORIGINAL sealed 25 kg sack, represented through its presentation.
export const GLUCODRY_ADAO_ACCOUNT_ID = 'b4027369-5abf-4ac1-ab24-862334fae892';
export const GLUCODRY_PRODUCT_ID = '92088a70-8cc0-40ef-a39d-564603df6866';
export const GLUCODRY_GD1_PRESENTATION_ID = '12aae767-df81-4f41-b39d-078424fade04';
export const GLUCODRY_GD2_PRESENTATION_ID = '8dd3b126-36bd-4bb2-a695-bdbfefdc8507';
export const GLUCODRY_ADAO_MODELS = Object.freeze({
  '23194995930|129656931741': Object.freeze({ kind: 'fractioned_g', multiplier: 1000 }),
  '23194995930|129656931742': Object.freeze({ kind: 'fractioned_g', multiplier: 2000 }),
  '23194995930|129656931739': Object.freeze({ kind: 'fractioned_g', multiplier: 3000 }),
  '23194995930|129656931740': Object.freeze({ kind: 'fractioned_g', multiplier: 4000 }),
  '58272221478|219196635353': Object.freeze({ kind: 'sealed_sack', multiplier: 1 }),
});

export function glucodryAdaoPhysicalBlocker(item, components, scope, contract) {
  if (scope?.channelAccountId !== GLUCODRY_ADAO_ACCOUNT_ID) return 'glucodry_account_unverified';
  if (components.length !== 1) return 'glucodry_composition_invalid';
  const c = components[0];
  const identity = c?.physical_identity;
  if (c?.product_id !== GLUCODRY_PRODUCT_ID || c?.variant_id != null
    || identity?.active !== true || identity?.unit !== 'g'
    || Number(c?.physical_multiplier) !== contract.multiplier) {
    return 'glucodry_physical_identity_unverified';
  }
  const q = Number(item?.quantity);
  if (!Number.isSafeInteger(q) || q < 1 || !Number.isSafeInteger(q * contract.multiplier)
    || q * contract.multiplier > 2147483647) return 'physical_quantity_invalid';
  if (contract.kind === 'sealed_sack') {
    // Current DB separation path accepts quantity=1 and commercial_quantity=1.
    // Never reinterpret the sack as 25,000 loose grams or allow Q>1.
    if (q !== 1) return 'glucodry_gd2_multiple_sacks_unsupported';
    return null;
  }
  if (!Array.isArray(identity.presentation_factors)
    || !identity.presentation_factors.some(f => Number(f) === 1000)) {
    return 'glucodry_fractioned_presentation_unverified';
  }
  return null;
}
