const MASS_IN_GRAMS = { g: 1, kg: 1000, mg: 0.001 };

// Accept only one explicit mass. Ranges/multiple sizes are deliberately not
// guessed. A model's explicit size takes precedence over the generic title.
function explicitMass(text) {
  const matches = [...String(text ?? '').toLowerCase().matchAll(/\b(\d+(?:[.,]\d+)?)\s*(kg|mg|g)\b/g)];
  if (matches.length !== 1) return null;
  // "1 a 4 kg" / "1-4kg" do not describe a single sold presentation.
  if (/\d\s*(?:a|até|ate|[-–/|])\s*\d+(?:[.,]\d+)?\s*(?:kg|mg|g)\b/i.test(String(text))) return null;
  if (/\b\d+\s*[x×]|\b(?:kit|caixa|pacote)s?\s*(?:com|de)?\s*\d|\b\d+\s*(?:pacotes|sacos|unidades)\b/i.test(String(text))) return null;
  const m = matches[0];
  return Number(m[1].replace(',', '.')) * MASS_IN_GRAMS[m[2]];
}

// Original sealed packages are counted per package, never as loose grams/units.
const SEALED = Object.freeze({
 '58253351845|179728184791':['c4580ad6-e53a-4a36-9696-a65f2a95da00','e25d7363-8c77-4cce-878d-af23fef3c333','cx'],
 '58253351845|179728184792':['c4580ad6-e53a-4a36-9696-a65f2a95da00','a36f690f-39db-4ecd-a8f7-1cc27a266a44','cx'],
 '23899479158|209190157982':['c70dd4b4-bc59-4d88-81ef-1a8c47315560','1a3d59a6-4712-4afd-811a-5a72aad76fa9','g'],
 '23899479158|209190157983':['c70dd4b4-bc59-4d88-81ef-1a8c47315560','f6588f52-6e28-4ce9-b492-a95c847d5c0c','g'],
});
export function mappingPhysicalBlocker(item, mapping) {
  const components = mapping.components?.length ? mapping.components : [mapping];
  const sealed = SEALED[String(item?.itemId)+'|'+String(item?.modelId)];
  if (sealed) {
    if (components.length !== 1) return 'sealed_composition_invalid';
    const c=components[0], identity=c.physical_identity;
    if (c.product_id!==sealed[0] || c.variant_id!==sealed[1]
      || identity?.active!==true || identity?.unit!==sealed[2]
      || Number(c.physical_multiplier)!==1) return 'sealed_physical_identity_unverified';
    return null;
  }
  for (const c of components) {
    const identity = c.physical_identity;
    if (!identity || identity.active !== true || !identity.unit) return 'physical_identity_unverified';
    const multiplier = Number(c.physical_multiplier);
    const quantity = Number(item.quantity) * multiplier;
    if (!Number.isFinite(multiplier) || multiplier <= 0 || !Number.isSafeInteger(quantity) || quantity <= 0
      || quantity > 2147483647) return 'physical_quantity_invalid';
    const scale = MASS_IN_GRAMS[String(identity.unit).trim().toLowerCase()];
    if (!scale && String(identity.unit).trim().toLowerCase() !== 'un') return 'physical_unit_requires_review';
    if (scale) {
      // Weighted compositions need explicit commercial composition evidence;
      // this guard does not infer a kit's physical split from its title.
      if (components.length !== 1) return 'physical_composition_requires_review';
      const modelHasMass = /\b\d+(?:[.,]\d+)?\s*(?:kg|mg|g)\b/i.test(String(item.modelName ?? ''));
      const grams = explicitMass(modelHasMass ? item.modelName : item.itemName);
      if (grams === null || grams <= 0) return 'sold_mass_unverified';
      if (Math.abs(multiplier * scale - grams) > 0.000001) return 'physical_multiplier_mismatch';
      if (!identity.presentation_factors?.some(f => Number.isFinite(Number(f)) && Number(f) > 0
        && Number.isSafeInteger(multiplier / Number(f)) && multiplier / Number(f) >= 1)) return 'physical_presentation_unverified';
    }
  }
  return null;
}
