import test from 'node:test';
import assert from 'node:assert/strict';
import { mappingPhysicalBlocker } from '../src/shopee-mapping-physical-guard.mjs';
import { buildShopeeOrderProjectionPreview } from '../src/shopee-order-projection-preview.mjs';
const base=(itemId,modelId,product_id,variant_id,unit)=>({
 item:{itemId,modelId,quantity:1},
 mapping:{components:[{product_id,variant_id,physical_multiplier:1,physical_identity:{active:true,unit}}]},
});
test('BA3 sealed box is recognized only with exact live physical identity',()=>{
 const x=base('58253351845','179728184791','c4580ad6-e53a-4a36-9696-a65f2a95da00','e25d7363-8c77-4cce-878d-af23fef3c333','cx');
 assert.equal(mappingPhysicalBlocker(x.item,x.mapping),null);
 x.mapping.components[0].variant_id='a36f690f-39db-4ecd-a8f7-1cc27a266a44';
 assert.equal(mappingPhysicalBlocker(x.item,x.mapping),'sealed_physical_identity_unverified');
});
test('CB3 original sack cannot silently use loose grams',()=>{
 const x=base('23899479158','209190157982','c70dd4b4-bc59-4d88-81ef-1a8c47315560','1a3d59a6-4712-4afd-811a-5a72aad76fa9','g');
 assert.equal(mappingPhysicalBlocker(x.item,x.mapping),null);
 x.mapping.components[0].physical_multiplier=20000;
 assert.equal(mappingPhysicalBlocker(x.item,x.mapping),'sealed_physical_identity_unverified');
});
test('BA3 projection carries matching sealed commercial presentation',()=>{
 const payload={channelAccountId:'b4027369-5abf-4ac1-ab24-862334fae892',orders:[{orderSn:'test-sealed',createdAt:'2026-10-30',items:[{itemId:'58253351845',modelId:'179728184791',quantity:1}]}]};
 const map={marketplaceAccount:'SHOPEE ADÃO',orders:[{orderSn:'test-sealed',items:[{itemId:'58253351845',modelId:'179728184791',mappingStatus:'recognized',quantity:1,components:[{productId:'c4580ad6-e53a-4a36-9696-a65f2a95da00',variantId:'e25d7363-8c77-4cce-878d-af23fef3c333',physicalQuantity:1,commercialQuantity:1,physicalMultiplier:1}]}]}]};
 const result=buildShopeeOrderProjectionPreview(payload,map);
 assert.equal(result.orders[0].candidate.items[0].commercialPresentationId,'fe7a5361-d53e-44ba-a340-1ba3079a3b5b');
});
