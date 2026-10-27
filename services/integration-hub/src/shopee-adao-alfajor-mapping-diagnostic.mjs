import { readLiveShopeeOrderIntakeBatch } from './core-bridge.mjs';
import { buildShopeeMappingPreview } from './shopee-mapping-preview.mjs';

// Fixed-scope, IAM-only, read-only diagnostic for Alfajor Adão. No writes.
export const ADA0_ALFAJOR_ACCOUNT = 'b4027369-5abf-4ac1-ab24-862334fae892';
export const WHITE = 'd89e1dba-ca80-4136-b9f3-225fb80b6dfb';
export const DARK = 'e4d756c8-f324-4ac0-b9ff-6adae24f5310';
export const EXPECTED = Object.freeze([["21698187551","139659739038",6,0],["21698187551","139659739039",0,6],["21698187551","139659739040",3,3],["18599184676","229452998566",18,0],["18599184676","229452998567",0,18],["18599184676","229452998568",9,9],["22398139644","159796178241",36,0],["22398139644","159796178238",0,36],["22398139644","159796178244",18,18],["22398139644","159796178242",72,0],["22398139644","159796178245",0,72],["22398139644","159796178243",36,36],["22398139644","159796178246",108,0],["22398139644","159796178239",0,108],["22398139644","159796178247",54,54],["22398139644","159796178248",144,0],["22398139644","159796178249",0,144],["22398139644","159796178240",72,72],["22997344559","209628761598",504,0],["22997344559","209628761599",0,504],["22997344559","209628761597",252,252]]);
export async function previewAdaoAlfajorMappings({ readBatch = readLiveShopeeOrderIntakeBatch } = {}) {
  const batch = await readBatch({ channel_account_id: ADA0_ALFAJOR_ACCOUNT, limit: 1 });
  if (!batch?.ok || !Array.isArray(batch.payload?.mappings) || batch.payload.marketplace_account !== 'SHOPEE ADÃO') {
    return { ok: false, code: 'mapping_catalog_unavailable', written: 0 };
  }
  const normalized = {
    source: 'shopee_open_platform', environment: 'live', channelAccountId: ADA0_ALFAJOR_ACCOUNT,
    orders: [{ orderSn: 'diagnostic-no-order', externalStatus: 'DIAGNOSTIC_ONLY',
      items: EXPECTED.map(([itemId, modelId]) => ({ itemId, modelId, modelName: 'Alfajor 60g',
        itemName: 'Alfajor Artesanal 60g Doce de Leite', itemSku: null, modelSku: null, quantity: 1 })) }],
  };
  const preview = buildShopeeMappingPreview(normalized,batch.payload.mappings,{
    channelAccountId: ADA0_ALFAJOR_ACCOUNT,marketplaceAccount:'SHOPEE ADÃO',requirePhysicalValidation:true
  });
  const resolved = preview?.orders?.[0]?.items;
  if (!Array.isArray(resolved) || resolved.length !== EXPECTED.length) {
    return { ok: false, code: 'preview_shape_invalid', written: 0 };
  }
  const items = resolved.map((item,index) => {
    const [itemId,modelId,white,dark] = EXPECTED[index];
    const components = (item.components ?? []).map(c => ({ product_id:c.productId,variant_id:c.variantId,physical_quantity:c.physicalQuantity }));
    const actualWhite = components.filter(c=>c.variant_id===WHITE).reduce((s,c)=>s+c.physical_quantity,0);
    const actualDark = components.filter(c=>c.variant_id===DARK).reduce((s,c)=>s+c.physical_quantity,0);
    const physicallyCorrect = components.length === (white > 0 && dark > 0 ? 2 : 1)
      && components.every(c=>c.product_id==='62cf9f63-be04-4261-ad11-569028dd1125'
        && (c.variant_id===WHITE||c.variant_id===DARK))
      && actualWhite===white && actualDark===dark;
    const recognized = item.itemId===itemId && item.modelId===modelId
      && item.mappingStatus==='recognized' && physicallyCorrect;
    return { item_id:itemId,model_id:modelId,mapping_id:item.mappingId??null,
      recognized,mapping_status:item.mappingStatus,expected:{white,dark},
      actual:{white:actualWhite,dark:actualDark},components };
  });
  return { ok:true,mode:'mapping_diagnostic',account:'adao',selected:items.length,
    recognized:items.filter(i=>i.recognized).length,blocked:items.filter(i=>!i.recognized).length,
    written:0,items };
}
