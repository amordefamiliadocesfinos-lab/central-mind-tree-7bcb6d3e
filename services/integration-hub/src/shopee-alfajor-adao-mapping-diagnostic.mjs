import { readLiveShopeeOrderIntakeBatch } from './core-bridge.mjs';
import { buildShopeeMappingPreview } from './shopee-mapping-preview.mjs';

// Fixed-scope, IAM-protected and read-only. No caller-supplied account, model or order.
export const ALFAJOR_ADAO_ACCOUNT = 'b4027369-5abf-4ac1-ab24-862334fae892';
const PRODUCT = '62cf9f63-be04-4261-ad11-569028dd1125';
const BRANCO = 'd89e1dba-ca80-4136-b9f3-225fb80b6dfb';
const MEIO_AMARGO = 'e4d756c8-f324-4ac0-b9ff-6adae24f5310';
const MODELS = Object.freeze([["21698187551","139659739038",6,0],["21698187551","139659739039",0,6],["21698187551","139659739040",3,3],["18599184676","229452998566",18,0],["18599184676","229452998567",0,18],["18599184676","229452998568",9,9],["22398139644","159796178241",36,0],["22398139644","159796178238",0,36],["22398139644","159796178244",18,18],["22398139644","159796178242",72,0],["22398139644","159796178245",0,72],["22398139644","159796178243",36,36],["22398139644","159796178246",108,0],["22398139644","159796178239",0,108],["22398139644","159796178247",54,54],["22398139644","159796178248",144,0],["22398139644","159796178249",0,144],["22398139644","159796178240",72,72],["22997344559","209628761598",504,0],["22997344559","209628761599",0,504],["22997344559","209628761597",252,252]]);

export async function previewAlfajorAdaoMappings({ readBatch = readLiveShopeeOrderIntakeBatch } = {}) {
  const batch = await readBatch({ channel_account_id: ALFAJOR_ADAO_ACCOUNT, limit: 1 });
  if (!batch?.ok || !Array.isArray(batch.payload?.mappings)
      || batch.payload?.marketplace_account !== 'SHOPEE ADÃO') {
    return { ok: false, code: 'mapping_catalog_unavailable', written: 0 };
  }
  const order = {
    orderSn: 'diagnostic-no-order', externalStatus: 'DIAGNOSTIC_ONLY',
    items: MODELS.map(([itemId, modelId]) => ({
      itemId, modelId, itemName: 'Alfajor 60g', modelName: 'DIAGNOSTIC_ONLY',
      itemSku: null, modelSku: null, quantity: 1,
    })),
  };
  const options = { channelAccountId: ALFAJOR_ADAO_ACCOUNT,
    marketplaceAccount: 'SHOPEE ADÃO', requirePhysicalValidation: true };
  const normalized = { source: 'shopee_open_platform', environment: 'live',
    channelAccountId: ALFAJOR_ADAO_ACCOUNT, orders: [order] };
  const preview = buildShopeeMappingPreview(normalized, batch.payload.mappings, options);
  const items = preview.orders[0].items.map((entry, index) => {
    const [itemId, modelId, white, dark] = MODELS[index];
    const actual = entry.components.map(component => ({
      product_id: component.productId, variant_id: component.variantId,
      physical_quantity: component.physicalQuantity,
    }));
    const expected = [[BRANCO, white], [MEIO_AMARGO, dark]]
      .filter(([, qty]) => qty > 0);
    const componentsMatch = entry.mappingStatus === 'recognized'
      && actual.length === expected.length
      && actual.every(component => component.product_id === PRODUCT
        && expected.some(([variantId, qty]) =>
          component.variant_id === variantId && component.physical_quantity === qty));
    return { item_id: itemId, model_id: modelId, mapping_id: entry.mappingId,
      mapping_status: entry.mappingStatus, components_match: componentsMatch,
      components: actual };
  });
  const negativePayload = {
    ...normalized,
    orders: [{ ...order, items: [
      { ...order.items[0], modelId: '999999999999999' },
      { ...order.items[0], itemId: '999999999999999' },
    ] }],
  };
  const negative = buildShopeeMappingPreview(negativePayload, batch.payload.mappings, options)
    .orders[0].items.every(entry => entry.mappingStatus === 'needs_mapping');
  const wrongAccount = buildShopeeMappingPreview(normalized, batch.payload.mappings, {
    ...options, channelAccountId: '00000000-0000-4000-8000-000000000000',
    marketplaceAccount: 'SHOPEE OUTRA',
  }).orders[0].items.every(entry => entry.mappingStatus === 'needs_mapping');
  const recognized = items.filter(entry => entry.components_match).length;
  return {
    ok: recognized === MODELS.length && negative && wrongAccount,
    mode: 'mapping_diagnostic', selected: items.length, recognized,
    blocked: items.length - recognized, written: 0,
    negative_tests: { unknown_model: negative, wrong_account: wrongAccount },
    items,
  };
}
