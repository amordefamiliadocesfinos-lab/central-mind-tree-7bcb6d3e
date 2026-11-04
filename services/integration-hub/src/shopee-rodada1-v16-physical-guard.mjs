// Shopee Adão Rodada 1 V16 — physical protections ONLY for proven BL1,
// CS1, FR1 and current CP1 model pairs. DL1 and EMB1/EMB2 are not authorized.
export const R1_ADAO_ACCOUNT_ID = 'b4027369-5abf-4ac1-ab24-862334fae892';
export const R1_PRODUCTS = Object.freeze({
  blister:'b4b3640d-f0e2-4266-9322-a846536e6219',
  sextavada:'e4f0486b-a92e-412a-b38a-acf606967af9',
  flor:'1bf18fc4-3287-4b90-91a8-77dfed74fecf',
  papelao:'fe46fcd4-7e2a-484e-a60c-eab4e9a9fa86',
});
// For CP1, one commercial unit is 100, 100 or 75 *individual boxes*.
// The existing 25-unit presentations are catalog units, NOT the quantity sold.
export const R1_CP_PRESENTATIONS = Object.freeze({
  'd3d9291b-e408-4c80-bc04-05d4284cac8d':'3f90e895-ad37-4034-b93d-e89ffcbd4774',
  'e30eb4a6-6a1e-4e09-8930-c075b45c80a6':'7f51318d-2bf3-449a-a064-22446f66a510',
  '53fea998-5787-416a-b606-b4a7e60b404e':'6388f8ac-a768-4678-b52d-69a9438624f5',
});
export const R1_V16_PROTECTED_MODELS = Object.freeze({
  '22795004937|209190436706':Object.freeze({product:R1_PRODUCTS.blister,variant:null,multiplier:10,kind:'blister'}),
  '58212319829|219190507797':Object.freeze({product:R1_PRODUCTS.sextavada,variant:null,multiplier:10,kind:'sextavada'}),
  '22099402766|119728063517':Object.freeze({product:R1_PRODUCTS.flor,variant:null,multiplier:24,kind:'flor'}),
  '22099402766|119728063518':Object.freeze({product:R1_PRODUCTS.flor,variant:null,multiplier:48,kind:'flor'}),
  '22099402766|119728063519':Object.freeze({product:R1_PRODUCTS.flor,variant:null,multiplier:72,kind:'flor'}),
  '22099402766|119728063520':Object.freeze({product:R1_PRODUCTS.flor,variant:null,multiplier:96,kind:'flor'}),
  '22099402766|119728063521':Object.freeze({product:R1_PRODUCTS.flor,variant:null,multiplier:120,kind:'flor'}),
  '22299532770|239453506473':Object.freeze({product:R1_PRODUCTS.papelao,variant:'d3d9291b-e408-4c80-bc04-05d4284cac8d',multiplier:100,kind:'papelao'}),
  '22299532770|239453506474':Object.freeze({product:R1_PRODUCTS.papelao,variant:'e30eb4a6-6a1e-4e09-8930-c075b45c80a6',multiplier:100,kind:'papelao'}),
  '22299532770|239453506475':Object.freeze({product:R1_PRODUCTS.papelao,variant:'53fea998-5787-416a-b606-b4a7e60b404e',multiplier:75,kind:'papelao'}),
});
export function rodada1V16PhysicalBlocker(item,components,scope,contract){
  if(scope?.channelAccountId!==R1_ADAO_ACCOUNT_ID)return 'r1_account_unverified';
  if(components.length!==1)return 'r1_composition_invalid';
  const c=components[0],identity=c?.physical_identity;
  if(c?.product_id!==contract.product || c?.variant_id!==contract.variant
    || identity?.active!==true || identity?.unit!=='un'
    || Number(c?.physical_multiplier)!==contract.multiplier){
    return 'r1_physical_identity_unverified';
  }
  const q=Number(item?.quantity);
  if(!Number.isSafeInteger(q) || q<1 || !Number.isSafeInteger(q*contract.multiplier)
    || q*contract.multiplier>2147483647)return 'physical_quantity_invalid';
  if(contract.kind==='papelao'){
    if(!Array.isArray(identity.presentation_factors)
      || !identity.presentation_factors.some(f=>Number(f)===25)){
      return 'r1_cp_presentation_unverified';
    }
  }
  return null;
}
