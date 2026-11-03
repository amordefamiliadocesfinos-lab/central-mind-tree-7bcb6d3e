import { DU_PORTO_ADAO_ACCOUNT_ID, DU_PORTO_PRODUCT_ID, DU_PORTO_FLAVOR_VARIANTS } from './shopee-po-sorvete-adao-v12-contract.mjs';

// Compare exact physical composition of sealed 1 kg packets to known official model.
export function duPortoPhysicalBlocker(item, components, scope, packCounts) {
  if (scope?.channelAccountId !== DU_PORTO_ADAO_ACCOUNT_ID) return 'du_porto_account_unverified';
  const expected = new Map();
  packCounts.forEach((count, index) => {
    if (count > 0) expected.set(DU_PORTO_FLAVOR_VARIANTS[index], count * 1000);
  });
  if (components.length !== expected.size) return 'du_porto_composition_invalid';
  const seen = new Set();
  let totalGrams = 0;
  for (const c of components) {
    const identity = c?.physical_identity;
    const grams = Number(c?.physical_multiplier);
    const variant = c?.variant_id;
    if (c?.product_id !== DU_PORTO_PRODUCT_ID || !expected.has(variant)
      || seen.has(variant) || identity?.active !== true || identity?.unit !== 'g'
      || !Array.isArray(identity.presentation_factors)
      || !identity.presentation_factors.some(f => Number(f) === 1000)
      || grams !== expected.get(variant)) return 'du_porto_physical_identity_unverified';
    seen.add(variant);
    totalGrams += grams;
  }
  const q = Number(item?.quantity);
  if (!Number.isSafeInteger(q) || q <= 0 || !Number.isSafeInteger(totalGrams * q)
    || totalGrams * q > 2147483647) return 'physical_quantity_invalid';
  return null;
}
