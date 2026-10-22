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

export function mappingPhysicalBlocker(item, mapping) {
  const components = mapping.components?.length ? mapping.components : [mapping];
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
