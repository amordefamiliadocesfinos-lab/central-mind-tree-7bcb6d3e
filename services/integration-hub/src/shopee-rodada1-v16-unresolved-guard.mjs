// Rodada 1 V16: fail-closed quarantine for the THREE unresolved official pairs.
// Release only after a new P1 physical fact and independently reviewed P2 guard.
// Leite cannot be assumed to mean Leite Condensado or Leite em Po.
// EMB1 must consume six distinct 100-unit prints, not one generic 600-unit variant.
// Ivoti original sealed bucket cannot be inferred from loose gram inventory.
export const R1_V16_UNRESOLVED_PAIRS = Object.freeze({
  '22694563769|229443539818':'r1_emb2_leite_physical_print_unverified',
  '58222235000|219629112211':'r1_emb1_six_distinct_prints_unverified',
  '21599903629|238794159646':'r1_dl1_original_sealed_bucket_unverified',
});
export function r1V16UnresolvedBlocker(item,scope){
  if (scope?.channelAccountId !== 'b4027369-5abf-4ac1-ab24-862334fae892') return null;
  const key=String(item?.itemId)+'|'+String(item?.modelId);
  return R1_V16_UNRESOLVED_PAIRS[key] ?? null;
}
