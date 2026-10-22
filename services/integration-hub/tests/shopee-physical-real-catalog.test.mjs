import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShopeeMappingPreview } from '../src/shopee-mapping-preview.mjs';
import { buildShopeeOrderProjectionPreview } from '../src/shopee-order-projection-preview.mjs';

// Sanitized operational identities, listing names and conversion factors seen
// in F6 evidence / canonical cutovers. No customer data or production requests.
const account = 'SHOPEE VIVIANE';
const accountId = '8a8ad166-0317-4597-8be6-e43fb46b4d1b';
const cases = [
  { name: 'Glucodry 4kg sold over the canonical 1kg presentation', code: 'SH-002-006',
    title: 'Glucose de Milho desidratada em Pó - Glucodry - VARIAÇÃO 1 Kg a 4 Kg | SH-002-006', model: '4 Kg',
    product: '92088a70-8cc0-40ef-a39d-564603df6866', unit: 'g', factors: [1000], multipliers: [4000], variants: [null] },
  { name: 'Biscoito 2 pacotes 44 unidades does not confuse 9g per biscuit with stock unit', code: 'SH-0042-018',
    title: 'Biscoito para Alfajor Tradicional ou chocolate | 22 a 24 Unid por Pacote | 9g cada | SH-0042-018',
    model: '2 PACOTE 44 UNI,BISCOITO TRADICIONAL', product: 'c4580ad6-e53a-4a36-9696-a65f2a95da00',
    unit: 'un', factors: [22], multipliers: [44], variants: ['fa0814a0-9cd0-4d8a-b01d-2febdd1d7dcc'] },
  { name: 'Alfajor composed kit retains both physical flavours', code: 'SH-002-015',
    title: 'Alfajor 60g - Kit com 6 UNI. | SH-002-015', model: '', product: '62cf9f63-be04-4261-ad11-569028dd1125',
    unit: 'un', factors: [6, 18], multipliers: [3, 3], variants: ['d89e1dba-ca80-4136-b9f3-225fb80b6dfb','e4d756c8-f324-4ac0-b9ff-6adae24f5310'] },
  { name: 'Porto Gel closed 1kg package remains one physical unit after canonical cutover', code: 'SH-002-011',
    title: 'Emulsificante Porto Gel Variação de 1kg a 5 kg Du Porto | SH-002-011', model: '1 KG',
    product: '6e757550-a9b6-4644-8164-8c802760e373', unit: 'un', factors: [1], multipliers: [1],
    variants: ['ae7c8013-de6c-4806-9450-abcab2202aa9'] },
  { name: 'Pó para Sorvete Doce de Leite corrected mapping', code: 'SH-002-009',
    title: 'Pó para Sorvete Du Porto 1kg – Base para Sorvetes e Gelados Comestíveis Profissional | SH-002-009',
    model: 'DOCE DE LEITE', product: 'f56418bc-9e5b-4291-971d-df2d70e1cba9', unit: 'g', factors: [1000], multipliers: [1000],
    variants: ['939e05c8-7a0c-4837-a659-fd980fd44113'] },
];
for (const c of cases) test(c.name, () => {
  const item = { itemName: c.title, modelName: c.model, quantity: 2, discountedUnitPrice: 27.99 };
  const normalized = { channelAccountId: accountId, orders: [{ orderSn: 'SYNTHETICREAL001', createdAt: '2026-10-22T00:00:00Z', items: [item] }] };
  const variation = c.model.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const mapping = { id: 'sanitized-mapping', marketplace: 'shopee', marketplace_account: account,
    external_item_key: `code:${c.code}|variation:${variation}`,
    components: c.multipliers.map((m, i) => ({ product_id: c.product, variant_id: c.variants[i], physical_multiplier: m, position: i,
      physical_identity: { active: true, unit: c.unit, presentation_factors: c.factors } })) };
  const before = structuredClone(mapping);
  const preview = buildShopeeMappingPreview(normalized, [mapping], { marketplaceAccount: account, requirePhysicalValidation: true });
  assert.equal(preview.orders[0].items[0].mappingStatus, 'recognized');
  const projection = buildShopeeOrderProjectionPreview(normalized, preview, { marketplaceAccount: account });
  assert.equal(projection.orders[0].projectionStatus, 'ready');
  const lines = projection.orders[0].candidate.items;
  assert.deepEqual(lines.map(l => l.quantity), c.multipliers.map(m => m * 2));
  assert.equal(lines.reduce((sum, l) => sum + l.commercialQuantity * l.unitPrice, 0), 55.98);
  assert.deepEqual(mapping, before);
  if (c.unit === 'g') {
    const broken = structuredClone(mapping); broken.components[0].physical_multiplier = 1;
    assert.match(buildShopeeMappingPreview(normalized, [broken], { marketplaceAccount: account, requirePhysicalValidation: true })
      .orders[0].items[0].mappingStatus, /physical_multiplier_mismatch/);
  }
});
