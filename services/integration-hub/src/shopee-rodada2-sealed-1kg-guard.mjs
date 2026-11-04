// Rodada 2, Shopee Adao. These are the two confirmed published offers,
// NOT proofs of an intact original 1kg bag in physical inventory.
// A commercial presentation of 1000g is not a sealed-stock ledger.
// Do not alias a loose gram balance as a sellable original sealed package.
export const R2_ADAO_ACCOUNT_ID='b4027369-5abf-4ac1-ab24-862334fae892';
export const R2_SEALED_PENDING=Object.freeze({
  '23994544114|189613441090':Object.freeze({
    family:'sorbato',sellerSku:'AF-SORB-001KG',
    productId:'6f43ad65-74d5-4db9-b931-1ecd6d124987',
    gramsPerSealedPackage:1000,
    reason:'r2_sorbato_original_sealed_package_unverified',
  }),
  '58211501155|219189984127':Object.freeze({
    family:'acido_citrico',sellerSku:'AF-ACID-001KG',
    productId:'ef118d1c-e7c7-45e3-b796-3a9908840f3c',
    gramsPerSealedPackage:1000,
    reason:'r2_acido_original_sealed_package_unverified',
  }),
});
export const R2_RESERVED_ITEM_IDS=Object.freeze([
  '23994544114','58211501155',
  // Banned historical acid listings: never reinterpret or map as active.
  '58211483673','58261478969',
]);
export const R2_RESERVED_SKU_PREFIXES=Object.freeze(['AF-SORB-','AF-ACID-']);
export function r2SealedPackageBlocker(item,scope={}){
  const key=String(item?.itemId)+'|'+String(item?.modelId);
  const contract=R2_SEALED_PENDING[key];
  if(!contract)return null;
  if(scope?.channelAccountId!==R2_ADAO_ACCOUNT_ID)return 'r2_channel_account_unverified';
  // Intentionally unconditional: an exact UUID and 1000g are still not proof
  // of the unbroken original package, regardless of hypothetical mapping data.
  return contract.reason;
}
export function r2RequiresOfficialIdentity(item,scope={}){
  if(scope?.channelAccountId!==R2_ADAO_ACCOUNT_ID)return false;
  const id=String(item?.itemId??'').trim();
  const sku=String(item?.modelSku??item?.itemSku??'').trim().toUpperCase();
  return R2_RESERVED_ITEM_IDS.includes(id)||
    R2_RESERVED_SKU_PREFIXES.some(prefix=>sku.startsWith(prefix));
}
