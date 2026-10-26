import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildShopeeApiExternalItemKey,
  buildShopeeMappingPreview,
  SHOPEE_MAPPING_PREVIEW_CONTRACT,
} from '../src/shopee-mapping-preview.mjs';

const CHANNEL_ACCOUNT_ID = '8a8ad166-0317-4597-8be6-e43fb46b4d1b';
const ACCOUNT = 'SHOPEE VIVIANE';

function normalizedItem(overrides = {}) {
  return {
    itemId: '58261505740',
    modelId: '149554569657',
    itemSku: null,
    modelSku: null,
    itemName: 'Glucose de Milho desidratada em Pó - Glucodry - VARIAÇÃO 1 Kg a 4 Kg | SH-002-006',
    modelName: '1 Kg',
    quantity: 1,
    originalUnitPrice: 20,
    discountedUnitPrice: 18,
    identityEvidence: {
      itemId: '58261505740',
      modelId: '149554569657',
      itemSku: null,
      modelSku: null,
    },
    ...overrides,
  };
}

function normalizedPayload(items = [normalizedItem()]) {
  return {
    source: 'shopee_open_platform',
    environment: 'live',
    channelAccountId: CHANNEL_ACCOUNT_ID,
    orders: [{
      orderSn: '261014HX0XSUQU',
      externalStatus: 'READY_TO_SHIP',
      items,
    }],
  };
}

test('derives the legacy external item key from API item/model names', () => {
  assert.equal(
    buildShopeeApiExternalItemKey(normalizedItem()),
    'code:SH-002-006|variation:1 kg',
  );

  assert.equal(
    buildShopeeApiExternalItemKey({
      itemName: 'Produto',
      modelName: 'Variação A',
      modelSku: 'MODEL 123',
    }),
    'sku:model-123|variation:variacao a',
  );
});

test('recognizes an exact pilot-account mapping and preserves external item/model identity', () => {
  const preview = buildShopeeMappingPreview(normalizedPayload(), [{
    id: 'mapping-1',
    marketplace: 'shopee',
    channel_account_id: CHANNEL_ACCOUNT_ID,
    marketplace_account: ACCOUNT,
    external_item_key: 'code:SH-002-006|variation:1 kg',
    product_id: 'product-1',
    variant_id: 'variant-1',
    physical_multiplier: 1000,
    components: [{
      product_id: 'product-1',
      variant_id: 'variant-1',
      physical_multiplier: 1000,
      position: 0,
    }],
  }], { marketplaceAccount: ACCOUNT });

  const item = preview.orders[0].items[0];
  assert.equal(item.mappingStatus, 'recognized');
  assert.equal(item.itemId, '58261505740');
  assert.equal(item.modelId, '149554569657');
  assert.equal(item.mappingId, 'mapping-1');
  assert.equal(item.components[0].physicalQuantity, 1000);
  assert.equal(preview.operationalWrites, false);
});

test('does not match a different variation from the same listing code', () => {
  const preview = buildShopeeMappingPreview(normalizedPayload(), [{
    id: 'mapping-2kg',
    marketplace: 'shopee',
    channel_account_id: CHANNEL_ACCOUNT_ID,
    marketplace_account: ACCOUNT,
    external_item_key: 'code:SH-002-006|variation:2 kg',
    product_id: 'product-2kg',
    variant_id: null,
    physical_multiplier: 2000,
  }], { marketplaceAccount: ACCOUNT });

  assert.equal(preview.orders[0].items[0].mappingStatus, 'needs_mapping');
});

test('does not leak mappings from another Shopee account', () => {
  const preview = buildShopeeMappingPreview(normalizedPayload(), [{
    id: 'other-account',
    marketplace: 'shopee',
    channel_account_id: 'b4027369-5abf-4ac1-ab24-862334fae892',
    marketplace_account: 'SHOPEE ADÃO',
    external_item_key: 'code:SH-002-006|variation:1 kg',
    product_id: 'wrong-product',
    variant_id: null,
    physical_multiplier: 1,
  }], { marketplaceAccount: ACCOUNT });

  assert.equal(preview.orders[0].items[0].mappingStatus, 'needs_mapping');
});

test('allows exact legacy marketplace_account fallback only when channel_account_id is absent', () => {
  const preview = buildShopeeMappingPreview(normalizedPayload(), [{
    id: 'legacy-exact-account',
    marketplace: 'shopee',
    channel_account_id: null,
    marketplace_account: ACCOUNT,
    external_item_key: 'code:SH-002-006|variation:1 kg',
    product_id: 'legacy-product',
    variant_id: null,
    physical_multiplier: 1000,
  }], { marketplaceAccount: ACCOUNT });

  assert.equal(preview.orders[0].items[0].mappingStatus, 'recognized');
  assert.equal(preview.orders[0].items[0].mappingId, 'legacy-exact-account');
});

test('fails safely on ambiguous or invalid mappings without choosing a product', () => {
  const shared = {
    marketplace: 'shopee',
    channel_account_id: CHANNEL_ACCOUNT_ID,
    marketplace_account: ACCOUNT,
    external_item_key: 'code:SH-002-006|variation:1 kg',
  };

  const ambiguous = buildShopeeMappingPreview(normalizedPayload(), [
    { ...shared, id: 'a', product_id: 'p1', physical_multiplier: 1 },
    { ...shared, id: 'b', product_id: 'p2', physical_multiplier: 1 },
  ], { marketplaceAccount: ACCOUNT });
  assert.equal(ambiguous.orders[0].items[0].mappingStatus, 'ambiguous');

  const invalid = buildShopeeMappingPreview(normalizedPayload(), [
    { ...shared, id: 'invalid', product_id: null, physical_multiplier: 0 },
  ], { marketplaceAccount: ACCOUNT });
  assert.equal(invalid.orders[0].items[0].mappingStatus, 'invalid_mapping');
});

test('real observed pilot examples remain unresolved when the exact mapping is absent', () => {
  const items = [
    normalizedItem({
      itemId: '23298665306',
      modelId: '0',
      itemName: 'Alfajor 60g - Kit com 6 UNI. – Sabor Irresistível com Doce de Leite e Chocolate Premium | SH-002-015',
      modelName: null,
      quantity: 2,
    }),
    normalizedItem(),
  ];

  const realExistingMappingsSubset = [
    {
      id: 'existing-2kg',
      marketplace: 'shopee',
      channel_account_id: CHANNEL_ACCOUNT_ID,
      marketplace_account: ACCOUNT,
      external_item_key: 'code:SH-002-006|variation:2 kg',
      product_id: '92088a70-8cc0-40ef-a39d-564603df6866',
      variant_id: null,
      physical_multiplier: 2000,
    },
    {
      id: 'existing-alfajor-18',
      marketplace: 'shopee',
      channel_account_id: null,
      marketplace_account: ACCOUNT,
      external_item_key: 'code:SH-002-014|variation:',
      product_id: '62cf9f63-be04-4261-ad11-569028dd1125',
      variant_id: null,
      physical_multiplier: 18,
    },
  ];

  const preview = buildShopeeMappingPreview(normalizedPayload(items), realExistingMappingsSubset, {
    marketplaceAccount: ACCOUNT,
  });

  assert.deepEqual(
    preview.orders[0].items.map((item) => item.mappingStatus),
    ['needs_mapping', 'needs_mapping'],
  );
});

test('contract remains preview-only', () => {
  assert.equal(SHOPEE_MAPPING_PREVIEW_CONTRACT.marketplace, 'shopee');
  assert.equal(SHOPEE_MAPPING_PREVIEW_CONTRACT.operationalWrites, false);
  assert.deepEqual(
    SHOPEE_MAPPING_PREVIEW_CONTRACT.statuses,
    ['recognized', 'needs_mapping', 'ambiguous', 'invalid_mapping'],
  );
});

function exactMapping(overrides = {}) {
  return { id: 'exact', marketplace: 'shopee', channel_account_id: CHANNEL_ACCOUNT_ID,
    marketplace_account: ACCOUNT, external_item_key: 'code:SH-002-006|variation:1 kg',
    product_id: 'legacy', physical_multiplier: 1000, ...overrides };
}

test('SKU priority and normalized title fallback match the legacy key format', () => {
  assert.equal(buildShopeeApiExternalItemKey({ modelSku: 'MODEL', itemSku: 'ITEM', modelName: '1 Kg' }), 'sku:model|variation:1 kg');
  assert.equal(buildShopeeApiExternalItemKey({ modelSku: ' ', itemSku: 'ITEM', modelName: '1 Kg' }), 'sku:item|variation:1 kg');
  assert.equal(buildShopeeApiExternalItemKey({ itemName: 'Açúcar Especial!', modelName: 'Pacote 1 Kg' }), 'title:acucar especial|pacote 1 kg');
});

test('named legacy mappings from every other account and mismatched scoped mappings are excluded', () => {
  for (const account of ['SHOPEE ADÃO', 'SHOPEE PRISCILA', 'SHOPEE CELIVIO']) {
    const preview = buildShopeeMappingPreview(normalizedPayload(), [exactMapping({ channel_account_id: null, marketplace_account: account })], { marketplaceAccount: ACCOUNT });
    assert.equal(preview.orders[0].items[0].mappingStatus, 'needs_mapping');
  }
  for (const mapping of [exactMapping({ channel_account_id: 'different' }), exactMapping({ marketplace: 'other' }), exactMapping({ marketplace: 'SHOPEE' }), exactMapping({ external_item_key: 'code:SH-002-006|variation:1 kg extra' })]) {
    assert.equal(buildShopeeMappingPreview(normalizedPayload(), [mapping], { marketplaceAccount: ACCOUNT }).orders[0].items[0].mappingStatus, 'needs_mapping');
  }
});

test('explicit composition is complete, ordered and supersedes the legacy header', () => {
  const input = normalizedPayload([normalizedItem({ quantity: 3, itemSku: null, modelSku: null })]);
  const mappings = [exactMapping({ components: [
    { product_id: 'second', variant_id: 'variant-second', physical_multiplier: 2, position: 2 },
    { product_id: 'first', variant_id: null, physical_multiplier: 5, position: 1 },
  ] })];
  const before = JSON.stringify({ input, mappings });
  const item = buildShopeeMappingPreview(input, mappings, { marketplaceAccount: ACCOUNT }).orders[0].items[0];
  assert.deepEqual(item.components.map(c => [c.productId, c.physicalQuantity]), [['first', 15], ['second', 6]]);
  assert.equal(item.itemId, '58261505740');
  assert.equal(item.modelId, '149554569657');
  assert.equal('productId' in item, false);
  assert.equal('variantId' in item, false);
  assert.equal(JSON.stringify({ input, mappings }), before);
});

test('invalid explicit composition fails closed without dropping rows or using the legacy header', () => {
  for (const components of [
    [{ product_id: 'p', physical_multiplier: Infinity }],
    [{ product_id: null, physical_multiplier: 1 }],
    [{ product_id: 'good', physical_multiplier: 1 }, { product_id: 'bad', physical_multiplier: 0 }],
    { product_id: 'p', physical_multiplier: 1 },
  ]) {
    const item = buildShopeeMappingPreview(normalizedPayload(), [exactMapping({ components })], { marketplaceAccount: ACCOUNT }).orders[0].items[0];
    assert.equal(item.mappingStatus, 'invalid_mapping');
    assert.deepEqual(item.components, []);
  }
});

test('legacy header is used only when explicit composition is absent or empty', () => {
  for (const components of [undefined, []]) {
    const item = buildShopeeMappingPreview(normalizedPayload([normalizedItem({ quantity: 2 })]), [exactMapping({ components })], { marketplaceAccount: ACCOUNT }).orders[0].items[0];
    assert.equal(item.mappingStatus, 'recognized');
    assert.equal(item.components[0].physicalQuantity, 2000);
  }
});

test('external SKU identity is preserved and duplicate scoped and legacy matches remain ambiguous', () => {
  const input = normalizedPayload([normalizedItem({ itemSku: 'ITEM', modelSku: 'MODEL' })]);
  const key = 'sku:model|variation:1 kg';
  const item = buildShopeeMappingPreview(input, [exactMapping({ external_item_key: key })], { marketplaceAccount: ACCOUNT }).orders[0].items[0];
  assert.equal(item.itemSku, 'ITEM');
  assert.equal(item.modelSku, 'MODEL');
  const ambiguous = buildShopeeMappingPreview(input, [exactMapping({ external_item_key: key }), exactMapping({ id: 'legacy', external_item_key: key, channel_account_id: null })], { marketplaceAccount: ACCOUNT }).orders[0].items[0];
  assert.equal(ambiguous.mappingStatus, 'ambiguous');
  assert.deepEqual(ambiguous.components, []);
});


test('F1.1 official item/model identity has precedence over provisional title mappings', () => {
  const mappings = [
    exactMapping({ id: 'provisional', product_id: 'wrong', physical_multiplier: 999 }),
    exactMapping({
      id: 'official', external_item_id: '58261505740',
      external_model_id: '149554569657', external_item_key: 'outdated-title',
      product_id: 'correct', physical_multiplier: 2,
    }),
  ];
  const item = buildShopeeMappingPreview(normalizedPayload(), mappings, { marketplaceAccount: ACCOUNT }).orders[0].items[0];
  assert.equal(item.mappingStatus, 'recognized');
  assert.equal(item.mappingId, 'official');
  assert.equal(item.components[0].productId, 'correct');
  assert.equal(item.components[0].physicalQuantity, 2);
});

test('F1.1 model ID differentiates variants and account boundary remains mandatory', () => {
  const mappings = [
    exactMapping({ id: 'wrong-model', external_item_id: '58261505740',
      external_model_id: 'different-model', external_item_key: 'outdated' }),
    exactMapping({ id: 'wrong-account', channel_account_id: 'another-account',
      external_item_id: '58261505740', external_model_id: '149554569657',
      external_item_key: 'outdated' }),
  ];
  const item = buildShopeeMappingPreview(normalizedPayload(), mappings, { marketplaceAccount: ACCOUNT }).orders[0].items[0];
  assert.equal(item.mappingStatus, 'needs_mapping');
});

test('F1.1 does not fallback from identity-bound mismatches to legacy title matching', () => {
  const item = buildShopeeMappingPreview(normalizedPayload(), [
    exactMapping({ id: 'bound-other-model', external_item_id: '58261505740',
      external_model_id: 'different-model' }),
  ], { marketplaceAccount: ACCOUNT }).orders[0].items[0];
  assert.equal(item.mappingStatus, 'needs_mapping');
});

test('F1.1 official non-variation model zero must be explicitly mapped', () => {
  const zero = normalizedItem({ itemId: '23393253848', modelId: '0',
    itemName: 'Alfajor Kit 18', modelName: '' });
  const item = buildShopeeMappingPreview(normalizedPayload([zero]), [
    exactMapping({ id: 'nonvariant', external_item_id: '23393253848',
      external_model_id: '0', external_item_key: 'outdated', physical_multiplier: 18 }),
  ], { marketplaceAccount: ACCOUNT }).orders[0].items[0];
  assert.equal(item.mappingStatus, 'recognized');
  assert.equal(item.mappingId, 'nonvariant');
});

test('F1.1 duplicate official identities fail closed instead of picking a product', () => {
  const identity = { external_item_id: '58261505740', external_model_id: '149554569657' };
  const item = buildShopeeMappingPreview(normalizedPayload(), [
    exactMapping({ ...identity, id: 'first', external_item_key: 'other' }),
    exactMapping({ ...identity, id: 'second', external_item_key: 'other' }),
  ], { marketplaceAccount: ACCOUNT }).orders[0].items[0];
  assert.equal(item.mappingStatus, 'ambiguous');
  assert.deepEqual(item.components, []);
});
