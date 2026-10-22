import test from 'node:test';
import assert from 'node:assert/strict';
import { mappingPhysicalBlocker } from '../src/shopee-mapping-physical-guard.mjs';
import { attachMappingPhysicalCatalog } from '../../../supabase/functions/integration-core-bridge/mapping-physical-catalog.mjs';

const item = { itemName: 'Pó para Sorvete Du Porto 1kg | SH-002-009', modelName: 'DOCE DE LEITE', quantity: 1 };
const component = { product_id: 'p', variant_id: 'v', physical_multiplier: 1000,
  physical_identity: { active: true, unit: 'g', presentation_factors: [1000, 2000] } };
const mapping = { ...component, components: [component] };

test('Du Porto 1kg cannot become 1g even with a valid positive mapping', () => {
  assert.equal(mappingPhysicalBlocker(item, { ...mapping, physical_multiplier: 1000,
    components: [{ ...component, physical_multiplier: 1 }] }), 'physical_multiplier_mismatch');
  assert.equal(mappingPhysicalBlocker(item, mapping), null);
  assert.equal(mappingPhysicalBlocker({ ...item, quantity: 3 }, mapping), null);
});

test('explicit model mass wins over listing size, without parsing SKU numbers as ranges', () => {
  assert.equal(mappingPhysicalBlocker({ ...item, itemName: 'Glucodry 1 Kg a 4 Kg | SH-002-006', modelName: '2 Kg' },
    { components: [{ ...component, physical_multiplier: 2000 }] }), null);
  assert.equal(mappingPhysicalBlocker({ ...item, itemName: 'Produto 0,5 kg | SH-002-009' },
    { components: [{ ...component, physical_multiplier: 500, physical_identity: { ...component.physical_identity, presentation_factors: [500] } }] }), null);
});

test('unknown, ranged and multipack mass require review rather than inferred conversion', () => {
  for (const name of ['Produto sem peso', 'Produto 1 a 4 kg', 'Produto 1kg / 2kg', 'Kit 2 pacotes 1kg', 'Produto 2x1kg']) {
    assert.equal(mappingPhysicalBlocker({ ...item, itemName: name }, mapping), 'sold_mass_unverified', name);
  }
  assert.equal(mappingPhysicalBlocker({ ...item, modelName: '1 a 4 kg' }, mapping), 'sold_mass_unverified');
});

test('missing/inactive catalog evidence, unsupported units and invalid quantities fail closed', () => {
  for (const physical_identity of [undefined, { ...component.physical_identity, active: false }]) {
    assert.equal(mappingPhysicalBlocker(item, { components: [{ ...component, physical_identity }] }), 'physical_identity_unverified');
  }
  assert.equal(mappingPhysicalBlocker(item, { components: [{ ...component, physical_identity: { ...component.physical_identity, unit: 'ml' } }] }), 'physical_unit_requires_review');
  assert.equal(mappingPhysicalBlocker(item, { components: [{ ...component, physical_identity: { ...component.physical_identity, presentation_factors: [2000] } }] }), 'physical_presentation_unverified');
  assert.equal(mappingPhysicalBlocker({ ...item, quantity: 2147483647 }, mapping), 'physical_quantity_invalid');
});

test('unit-count kits retain existing component precedence; weighted splits are not guessed', () => {
  const un = { ...component, physical_multiplier: 3, physical_identity: { active: true, unit: 'un' } };
  assert.equal(mappingPhysicalBlocker({ ...item, itemName: 'Alfajor 60g kit 6 unidades' }, { components: [un, un] }), null);
  assert.equal(mappingPhysicalBlocker(item, { components: [component, component] }), 'physical_composition_requires_review');
});

function fakeCore(patch = {}) {
  const rows = {
    products: [{ id: 'p', unit: 'g', is_active: true, deleted_at: null }],
    product_variants: [{ id: 'v', product_id: 'p', unit: 'g', is_active: true }],
    commercial_presentations: [{ product_id: 'p', variant_id: 'v', conversion_factor: 1000, is_active: true, composition_mode: 'single' }],
    ...patch,
  };
  return { from(name) { return { select() { return this; }, in() { return this; },
    limit() { return Promise.resolve(rows[name] instanceof Error ? { error: rows[name] } : { data: rows[name] }); } }; } };
}

test('Core evidence uses exact active physical identity and active single presentation only; no mutations', async () => {
  const original = { product_id: 'p', variant_id: 'v', physical_multiplier: 1, components: [{ product_id: 'p', variant_id: 'v', physical_multiplier: 1 }] };
  const result = await attachMappingPhysicalCatalog(fakeCore(), [original]);
  assert.deepEqual(result.mappings[0].components[0].physical_identity, { active: true, unit: 'g', presentation_factors: [1000] });
  assert.equal(result.mappings[0].components[0].physical_multiplier, 1);
  assert.equal(original.components[0].physical_identity, undefined);
  const missing = await attachMappingPhysicalCatalog(fakeCore({ product_variants: [] }), [original]);
  assert.equal(missing.mappings[0].components[0].physical_identity.active, false);
  const wrongPresentation = await attachMappingPhysicalCatalog(fakeCore({ commercial_presentations: [
    { product_id: 'p', variant_id: 'other', is_active: true, composition_mode: 'single', conversion_factor: 1000 },
    { product_id: 'p', variant_id: 'v', is_active: false, composition_mode: 'single', conversion_factor: 1000 },
  ] }), [original]);
  assert.deepEqual(wrongPresentation.mappings[0].components[0].physical_identity.presentation_factors, []);
});

test('catalog read errors or truncation stop the batch instead of treating it as valid evidence', async () => {
  for (const patch of [{ products: new Error('unavailable') }, { product_variants: Array(1000).fill({}) }]) {
    assert.equal((await attachMappingPhysicalCatalog(fakeCore(patch), [mapping])).error, 'intake_physical_catalog_unavailable');
  }
});
