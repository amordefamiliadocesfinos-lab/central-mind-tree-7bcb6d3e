// ACP1 V19 — only the three published current models on the Adão account.
// Current product confirmed by responsible owner: one active CAIXA CORAÇÃO DE COLHER
// per published eight-piece kit. The separate shipping carton remains
// logistics/process-owned, not an inferred physical order component.
// Food product is 8 x 60g = 480g per offer; 0.8kg is shipping GROSS mass.
export const ACP1_ACCOUNT='b4027369-5abf-4ac1-ab24-862334fae892';
export const ACP1_ITEM='23897384257';
export const ACP1_PRODUCT='62cf9f63-be04-4261-ad11-569028dd1125';
export const ACP1_VARIANTS=Object.freeze({
  branco:'d89e1dba-ca80-4136-b9f3-225fb80b6dfb',
  meioAmargo:'e4d756c8-f324-4ac0-b9ff-6adae24f5310',
});
export const ACP1_MODELS=Object.freeze({
  '189196728216':Object.freeze({label:'8 Branco',white:8,dark:0,sellerSku:'AF-ALF60-CXP-008-BR'}),
  '189196728217':Object.freeze({label:'8 Meio Amargo',white:0,dark:8,sellerSku:'AF-ALF60-CXP-008-MA'}),
  '189196728218':Object.freeze({label:'Mix 4 Branco + 4 Meio Amargo',white:4,dark:4,sellerSku:'AF-ALF60-CXP-008-MX'}),
});
export const ACP1_HISTORICAL_MODEL='189593476122';
export const ACP1_GROSS_SHIPPING_GRAMS=800;
export const ACP1_FOOD_GRAMS=480;
export const ACP1_HEART_BOX='e090a32c-a214-40aa-a409-e57c8ea9273c';
export function acp1Candidate(item,accountId){
  if(accountId!==ACP1_ACCOUNT||String(item?.itemId)!==ACP1_ITEM) return null;
  const model=ACP1_MODELS[String(item?.modelId)];
  if(!model) return {blocked:'acp1_v19_unknown_or_historical_model'};
  const quantity=Number(item?.quantity);
  if(!Number.isSafeInteger(quantity)||quantity<=0||quantity>100000)
    return {blocked:'acp1_v19_invalid_offer_quantity'};
  const components=[
    ...(model.white?[{product_id:ACP1_PRODUCT,variant_id:ACP1_VARIANTS.branco,
       physical_multiplier:model.white,position:0}]:[]),
    ...(model.dark?[{product_id:ACP1_PRODUCT,variant_id:ACP1_VARIANTS.meioAmargo,
       physical_multiplier:model.dark,position:model.white?1:0}]:[]),
    {product_id:ACP1_HEART_BOX,variant_id:null,physical_multiplier:1,
      position:Number(Boolean(model.white))+Number(Boolean(model.dark))},
  ];
  return {itemId:ACP1_ITEM,modelId:String(item.modelId),quantity,
    pricePerOffer:null,foodGrams:ACP1_FOOD_GRAMS*quantity,
    grossShippingGrams:ACP1_GROSS_SHIPPING_GRAMS*quantity,
    components,operationalMappingReady:true,
    blocker:null,
    historicalModelPreserved:ACP1_HISTORICAL_MODEL};
}

export function acp1PhysicalBlocker(item,components,scope){
  const candidate=acp1Candidate(item,scope?.channelAccountId);
  if(!candidate)return 'acp1_v19_account_or_item_unverified';
  if(candidate.blocked)return candidate.blocked;
  if(!Array.isArray(components)||components.length!==candidate.components.length)
    return 'acp1_v19_composition_invalid';
  for(let i=0;i<components.length;i++){
    const actual=components[i],expected=candidate.components[i];
    if(actual?.product_id!==expected.product_id
      ||(actual.variant_id??null)!==(expected.variant_id??null)
      ||Number(actual.physical_multiplier)!==expected.physical_multiplier
      ||Number(actual.position)!==expected.position
      ||actual.physical_identity?.active!==true
      ||actual.physical_identity?.unit!=='un')
      return 'acp1_v19_physical_identity_unverified';
  }
  return null;
}
