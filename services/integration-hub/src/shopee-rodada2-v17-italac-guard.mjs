// Rodada 2 V17 / Shopee Adão / Italac ML1+ML2.
//
// Source: published, verified commercial Item+Model identities in Matriz V17.
// A physical product measured in grams does not certify unopened 395g units
// nor a sealed original 27-unit box. A channel "stock 0" is not inventory.
// Quarantine is deliberately unconditional until the physical stock ledger,
// canonical unit identity and appropriate dispatch entrypoints are homologated.
export const ITALAC_ADAO_ACCOUNT = 'b4027369-5abf-4ac1-ab24-862334fae892';
export const ITALAC_PRODUCT = '0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b';
export const ITALAC_R2_V17_MODELS = Object.freeze({
 '22494563568|229430754376': Object.freeze({sellerSku:'AF-MLIT-003UN',units395g:3,grams:1185,family:'ML1'}),
 '22494563568|229430754377': Object.freeze({sellerSku:'AF-MLIT-006UN',units395g:6,grams:2370,family:'ML1'}),
 '22494563568|229430754374': Object.freeze({sellerSku:'AF-MLIT-009UN',units395g:9,grams:3555,family:'ML1'}),
 '22494563568|229430754375': Object.freeze({sellerSku:'AF-MLIT-012UN',units395g:12,grams:4740,family:'ML1'}),
 '23695375744|169421574726': Object.freeze({sellerSku:'AF-MLIT-027CX',units395g:27,grams:10665,family:'ML2',requiresOriginalSealedBox:true}),
});
export const ITALAC_R2_V17_ITEM_IDS = Object.freeze(['22494563568','23695375744']);
export const ITALAC_R2_V17_BLOCK = 'r2_italac_original_units_unverified';
export const ITALAC_R2_V17_BOX_BLOCK = 'r2_italac_original_27_box_unverified';
export function italacR2V17PhysicalBlocker(item,scope={}){
 const contract=ITALAC_R2_V17_MODELS[String(item?.itemId??'')+'|'+String(item?.modelId??'')];
 if(!contract)return null;
 if(scope?.channelAccountId!==ITALAC_ADAO_ACCOUNT)return 'r2_italac_account_unverified';
 return contract.requiresOriginalSealedBox?ITALAC_R2_V17_BOX_BLOCK:ITALAC_R2_V17_BLOCK;
}
export function italacR2V17ReservedIdentity(item,scope={}){
 if(scope?.channelAccountId!==ITALAC_ADAO_ACCOUNT)return false;
 const itemId=String(item?.itemId??'').trim();
 const sku=String(item?.modelSku??item?.itemSku??'').trim().toUpperCase();
 return ITALAC_R2_V17_ITEM_IDS.includes(itemId)||sku.startsWith('AF-MLIT-');
}
