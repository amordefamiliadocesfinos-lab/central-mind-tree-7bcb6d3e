// P4 read-only projection for the seven already-persisted official Shopee Adao identities.
// Registration of a commercial order is NOT proof of physical stock, opening or shipment.
// No historical SKU/title fallback, no Ivoti inference.
export const R2_ADAO_ACCOUNT_ID = 'b4027369-5abf-4ac1-ab24-862334fae892';
export const R2_ORIGINAL_MODELS = Object.freeze({
  '22494563568|229430754376': Object.freeze({productId:'0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b',modelGrams:1185,unitsPerOffer:3,presentationFactor:395,presentationId:'008d57c4-63b6-4c30-80fd-161ca368fd66'}),
  '22494563568|229430754377': Object.freeze({productId:'0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b',modelGrams:2370,unitsPerOffer:6,presentationFactor:395,presentationId:'008d57c4-63b6-4c30-80fd-161ca368fd66'}),
  '22494563568|229430754374': Object.freeze({productId:'0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b',modelGrams:3555,unitsPerOffer:9,presentationFactor:395,presentationId:'008d57c4-63b6-4c30-80fd-161ca368fd66'}),
  '22494563568|229430754375': Object.freeze({productId:'0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b',modelGrams:4740,unitsPerOffer:12,presentationFactor:395,presentationId:'008d57c4-63b6-4c30-80fd-161ca368fd66'}),
  '23695375744|169421574726': Object.freeze({productId:'0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b',modelGrams:10665,unitsPerOffer:1,presentationFactor:10665,presentationId:'b1bdfd2f-0278-4273-9e19-2544c8a3d758'}),
  '23994544114|189613441090': Object.freeze({productId:'6f43ad65-74d5-4db9-b931-1ecd6d124987',modelGrams:1000,unitsPerOffer:1,presentationFactor:1000,presentationId:'684d4a55-5d3a-4c18-be47-818a1a3bc074'}),
  '58211501155|219189984127': Object.freeze({productId:'ef118d1c-e7c7-45e3-b796-3a9908840f3c',modelGrams:1000,unitsPerOffer:1,presentationFactor:1000,presentationId:'f093c456-f757-4efe-b575-8177b8b1d607'}),
});
export function r2OriginalContract(item,channelAccountId) {
  if(channelAccountId !== R2_ADAO_ACCOUNT_ID)return null;
  return R2_ORIGINAL_MODELS[String(item?.itemId ?? '')+'|'+String(item?.modelId ?? '')] ?? null;
}
export function r2OriginalMappingBlocker(item,mapping,scope={}) {
  const key=String(item?.itemId ?? '')+'|'+String(item?.modelId ?? '');
  const contract=R2_ORIGINAL_MODELS[key];
  if(!contract)return null;
  if(scope.channelAccountId!==R2_ADAO_ACCOUNT_ID)return 'r2_original_account_unverified';
  const cs=Array.isArray(mapping?.components)&&mapping.components.length?mapping.components:[mapping];
  if(cs.length!==1)return 'r2_original_composition_invalid';
  const c=cs[0], identity=c.physical_identity;
  if(c.product_id!==contract.productId || c.variant_id!=null
      || Number(c.physical_multiplier)!==contract.modelGrams
      || identity?.active!==true || identity?.unit!=='g'
      || !identity.presentation_factors?.some(f=>Number(f)===contract.presentationFactor))
    return 'r2_original_physical_identity_unverified';
  return null;
}
export function r2OriginalProjectedLine(item,component,channelAccountId) {
  const contract=r2OriginalContract(item,channelAccountId);
  if(!contract)return null;
  const q=Number(item.quantity);
  if(!Number.isSafeInteger(q)||q<=0||q*contract.modelGrams>2147483647
      ||component.productId!==contract.productId ||component.variantId!=null
      ||Number(component.physicalMultiplier)!==contract.modelGrams)
    return {blocked:'r2_original_projection_invalid'};
  const count=q*contract.unitsPerOffer;
  if(!Number.isSafeInteger(count)||count<=0)return {blocked:'r2_original_commercial_count_invalid'};
  return {commercialQuantity:count,physicalMultiplier:contract.presentationFactor,
    physicalQuantity:q*contract.modelGrams,commercialPresentationId:contract.presentationId};
}
