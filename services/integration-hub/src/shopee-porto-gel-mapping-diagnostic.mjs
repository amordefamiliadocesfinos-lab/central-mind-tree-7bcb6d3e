import { readLiveShopeeOrderIntakeBatch } from './core-bridge.mjs';
import { buildShopeeMappingPreview } from './shopee-mapping-preview.mjs';

// Deliberately fixed-scope diagnostic. IAM-protected route, no user-supplied IDs,
// no order writer, no Shopee POST, no token exposure.
export const PORTO_GEL_VIVIANE_ACCOUNT = '8a8ad166-0317-4597-8be6-e43fb46b4d1b';
const MODELS = Object.freeze([
  ['209190015956', '1 KG'],
  ['209190015957', '2 KG'],
  ['209190015958', '3 KG'],
  ['209190015959', '4 KG'],
]);

export async function previewPortoGelVivianeMappings({
  readBatch = readLiveShopeeOrderIntakeBatch,
} = {}) {
  const batch = await readBatch({ channel_account_id: PORTO_GEL_VIVIANE_ACCOUNT, limit: 1 });
  if (!batch?.ok || !Array.isArray(batch.payload?.mappings)
    || batch.payload?.marketplace_account !== 'SHOPEE VIVIANE') {
    return { ok: false, code: 'mapping_catalog_unavailable', written: 0 };
  }
  const normalized = {
    source: 'shopee_open_platform', environment: 'live',
    channelAccountId: PORTO_GEL_VIVIANE_ACCOUNT,
    orders: [{
      orderSn: 'diagnostic-no-order',
      externalStatus: 'DIAGNOSTIC_ONLY',
      items: MODELS.map(([modelId, modelName]) => ({
        itemId: '23399466897', modelId, modelName,
        itemName: 'Emulsificante Porto Gel SH-002-011',
        itemSku: null, modelSku: null, quantity: 1,
      })),
    }],
  };
  const preview = buildShopeeMappingPreview(normalized, batch.payload.mappings, {
    channelAccountId: PORTO_GEL_VIVIANE_ACCOUNT,
    marketplaceAccount: 'SHOPEE VIVIANE',
    requirePhysicalValidation: true,
  });
  const items = preview.orders[0].items.map(item => ({
    item_id: item.itemId,
    model_id: item.modelId,
    commercial_quantity: 1,
    mapping_status: item.mappingStatus,
    mapping_id: item.mappingId,
    components: item.components.map(c => ({
      product_id: c.productId, variant_id: c.variantId,
      physical_quantity: c.physicalQuantity,
    })),
  }));
  return {
    ok: true, mode: 'mapping_diagnostic', selected: items.length,
    recognized: items.filter(i => i.mapping_status === 'recognized').length,
    blocked: items.filter(i => i.mapping_status !== 'recognized').length,
    written: 0, items,
  };
}
