// Read-only evidence for the intake guard. Missing identities remain local to a
// mapping; transport failures fail the batch closed, never invent catalog facts.
export async function attachMappingPhysicalCatalog(core, mappings) {
  const identities = mappings.flatMap(m => [m, ...(m.components ?? [])]);
  const productIds = [...new Set(identities.map(c => c.product_id).filter(Boolean))];
  if (!productIds.length) return { mappings };
  const results = await Promise.all([
    core.from('products').select('id,unit,is_active,deleted_at').in('id', productIds).limit(1000),
    core.from('product_variants').select('id,product_id,unit,is_active').in('product_id', productIds).limit(1000),
    core.from('commercial_presentations').select('product_id,variant_id,conversion_factor,is_active,composition_mode')
      .in('product_id', productIds).limit(1000),
  ]);
  if (results.some(r => r.error || !Array.isArray(r.data) || r.data.length >= 1000)) {
    return { error: 'intake_physical_catalog_unavailable' };
  }
  const [products, variants, presentations] = results.map(r => r.data);
  const physical = c => {
    const p = products.find(p => p.id === c.product_id);
    const v = c.variant_id ? variants.find(v => v.id === c.variant_id && v.product_id === c.product_id) : null;
    return {
      active: p?.is_active === true && p.deleted_at == null && (!c.variant_id || v?.is_active === true),
      unit: v?.unit ?? p?.unit ?? null,
      presentation_factors: presentations.filter(p => p.product_id === c.product_id
        && (p.variant_id ?? null) === (c.variant_id ?? null) && p.is_active === true && p.composition_mode === 'single')
        .map(p => Number(p.conversion_factor)),
    };
  };
  return { mappings: mappings.map(m => ({ ...m, physical_identity: physical(m),
    components: (m.components ?? []).map(c => ({ ...c, physical_identity: physical(c) })) })) };
}
