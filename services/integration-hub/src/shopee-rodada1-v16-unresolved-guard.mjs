// Rodada 1 V16: only DL1 remains physically unresolved.
// EMB2 Leite and EMB1 Mix are guarded separately by exact physical contracts.
// The Ivoti 9.8kg original sealed bucket is NOT equivalent to loose grams.
export const R1_V16_UNRESOLVED_PAIRS = Object.freeze({
 '21599903629|238794159646':'r1_dl1_original_sealed_bucket_unverified',
});
export function r1V16UnresolvedBlocker(item,scope){
 if(scope?.channelAccountId!=='b4027369-5abf-4ac1-ab24-862334fae892')return null;
 return R1_V16_UNRESOLVED_PAIRS[String(item?.itemId)+'|'+String(item?.modelId)]??null;
}
