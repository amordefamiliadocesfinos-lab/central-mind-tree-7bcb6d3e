// P2 isolated, PURE identity/routing gate. NOT imported by live entrypoints.
// This module never authorizes writes, stock mutation, migrations or runtime release.
// Official IDs read from Lovable Cloud commercial/purchase presentations (2026-11-04).
const ROWS=Object.freeze([
  Object.freeze({family:'italac',presentation:'ML2_original_box',productId:'0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b',commercialId:'b1bdfd2f-0278-4273-9e19-2544c8a3d758',purchaseId:'1a72b347-97ba-414a-9ef9-783c2d175ea3',factor:10665,stockState:'originalBoxes27'}),
  Object.freeze({family:'italac',presentation:'ML1_intact_unit',productId:'0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b',commercialId:'008d57c4-63b6-4c30-80fd-161ca368fd66',purchaseId:null,factor:395,stockState:'intactUnits395'}),
  Object.freeze({family:'sorbato',presentation:'original_package_1kg',productId:'6f43ad65-74d5-4db9-b931-1ecd6d124987',commercialId:'684d4a55-5d3a-4c18-be47-818a1a3bc074',purchaseId:'c9d1d89d-366a-42c0-b691-f56bad36af7f',factor:1000,stockState:'originalPackages1kg'}),
  Object.freeze({family:'acido',presentation:'original_package_1kg',productId:'ef118d1c-e7c7-45e3-b796-3a9908840f3c',commercialId:'f093c456-f757-4efe-b575-8177b8b1d607',purchaseId:'1c7268cd-fcd9-4d98-aa14-65f76ef72a0b',factor:1000,stockState:'originalPackages1kg'}),
  Object.freeze({family:'ivoti',presentation:'original_bucket_98',productId:'d913f0f2-4893-4985-9976-fcd9119a57b1',commercialId:'40809f6d-687c-493b-ac4d-67a602cceba0',purchaseId:'fcd94ec6-1fc6-4bab-bc6f-8436279ca737',factor:9800,stockState:'originalBuckets98'}),
]);
export const P2_FOUR_SEALED_PRESENTATIONS=ROWS;
// Caller supplies the official product and presentation IDs, not a title, SKU or gram balance.
// kind: 'sale' or 'purchase'. Negative result is FAIL-CLOSED for the four products.
export function inspectFourSealedPhysicalRouting({kind,productId,presentationId,commercialQuantity,operationalQuantity,variantId=null}={}){
  if(kind!=='sale'&&kind!=='purchase')return Object.freeze({recognized:false,blocked:true,reason:'p2_unknown_direction',operationalWrites:false});
  const applicable=ROWS.filter(x=>x.productId===productId);
  if(!applicable.length)return Object.freeze({recognized:false,blocked:false,reason:'p2_unrelated_product',operationalWrites:false});
  if(variantId!==null)return Object.freeze({recognized:true,blocked:true,reason:'p2_unexpected_variant',operationalWrites:false});
  const row=applicable.find(x=>(kind==='sale'?x.commercialId:x.purchaseId)===presentationId);
  if(!row)return Object.freeze({recognized:true,blocked:true,reason:'p2_unknown_or_missing_presentation',operationalWrites:false});
  if(!Number.isSafeInteger(commercialQuantity)||commercialQuantity<1
    ||!Number.isSafeInteger(operationalQuantity)||operationalQuantity!==commercialQuantity*row.factor)
    return Object.freeze({recognized:true,blocked:true,reason:'p2_quantity_or_conversion_mismatch',operationalWrites:false});
  return Object.freeze({recognized:true,blocked:false,requiresVerifiedPhysicalLedger:true,
    family:row.family,presentation:row.presentation,stockState:row.stockState,
    count:commercialQuantity,gramsEquivalent:operationalQuantity,
    operationalWrites:false,requiresAuthorizedTransactionalEntrypoint:true});
}
