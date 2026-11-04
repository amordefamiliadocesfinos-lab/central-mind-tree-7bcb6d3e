// Rodada 1 V16 Adão: commercial "Leite" was physically confirmed by
// the user as the ACTIVE "Leite em Pó" variant (not Leite Condensado).
// EMB1 is a fixed six-print assortment: 100 wrappers of each physical print.
export const R1_EMB_ACCOUNT='b4027369-5abf-4ac1-ab24-862334fae892';
export const R1_EMB_PRODUCT='af7fe3c4-863c-4d1f-9fcd-b4ecb92e5322';
export const R1_EMB2_LEITE_KEY='22694563769|229443539818';
export const R1_EMB1_MIX_KEY='58222235000|219629112211';
export const R1_EMB_SIX=Object.freeze([
  ['Brigadeiro','1af56d5f-476a-4645-9182-b420cac5c190'],
  ['Amendoim','04503e7e-0733-48ab-8d58-8633dd0eb5ca'],
  ['Morango','c8d80c3b-d5ce-4cab-a488-c0e807113e91'],
  ['Maracujá','5651be95-eb59-4660-b65a-e5d59f8b4008'],
  ['Beijinho','e8a87c08-77db-4c77-bc53-a512ad40830e'],
  ['Leite em Pó','5c73cec6-7e40-4cea-934f-7b22d234a405'],
].map(([name,variant])=>Object.freeze({name,variant})));
export const R1_EMB_LEITE_VARIANT=R1_EMB_SIX[5].variant;
const okPhysical=(c,expectedVariant,expectedMultiplier)=>
  c?.product_id===R1_EMB_PRODUCT &&
  c?.variant_id===expectedVariant &&
  c?.physical_identity?.active===true &&
  c?.physical_identity?.unit==='un' &&
  Number(c?.physical_multiplier)===expectedMultiplier &&
  Array.isArray(c?.physical_identity?.presentation_factors) &&
  c.physical_identity.presentation_factors.some(f=>Number(f)===100);

export function r1EmballagePhysicalBlocker(item,components,scope){
  if(scope?.channelAccountId!==R1_EMB_ACCOUNT)return 'r1_emb_account_unverified';
  const key=String(item?.itemId)+'|'+String(item?.modelId);
  const isLeite=key===R1_EMB2_LEITE_KEY;
  const isMix=key===R1_EMB1_MIX_KEY;
  if(!isLeite&&!isMix)return 'r1_emb_unknown_model';
  const expected=isLeite?1:6;
  if(!Array.isArray(components)||components.length!==expected)
    return 'r1_emb_composition_invalid';
  if(isLeite){
    if(!okPhysical(components[0],R1_EMB_LEITE_VARIANT,1000))
      return 'r1_emb_leite_identity_unverified';
  }else{
    // Every exact print must appear once, never a generic "Variados" alias.
    const expectedVariants=new Set(R1_EMB_SIX.map(v=>v.variant));
    const actual=new Set();
    for(const c of components){
      if(!expectedVariants.has(c?.variant_id) ||
         !okPhysical(c,c.variant_id,100) ||
         actual.has(c.variant_id))return 'r1_emb_mix_identity_unverified';
      actual.add(c.variant_id);
    }
    if(actual.size!==6)return 'r1_emb_mix_identity_unverified';
  }
  const q=Number(item?.quantity);
  const total=isLeite?1000:600;
  if(!Number.isSafeInteger(q)||q<1||!Number.isSafeInteger(q*total) ||
    q*total>2147483647)return 'physical_quantity_invalid';
  return null;
}
