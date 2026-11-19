export type VolumeEvidence={muscle_id:string;comparable_versions:number;
 recent_observed_sets_per_7_days:number|null;previous_observed_sets_per_7_days:number|null;
 observation:string};
export function interpretVolume(v:VolumeEvidence){
 if(v.comparable_versions<2 || v.recent_observed_sets_per_7_days===null
   || v.previous_observed_sets_per_7_days===null)return "insufficient";
 if(v.recent_observed_sets_per_7_days>v.previous_observed_sets_per_7_days)return "higher_observed_only";
 if(v.recent_observed_sets_per_7_days<v.previous_observed_sets_per_7_days)return "lower_observed_only";
 return "stable_observed_only";
}
export function decideCyclePhase(versions:number,quality:string,recoveryCovered:boolean,negativeSignals:number){
 if(versions<2)return "collect_more_cycles";
 if(quality!=="reviewable")return "consolidate_measurement";
 if(!recoveryCovered)return "confirm_recovery_context";
 if(negativeSignals>0)return "review_performance";
 return "selective_progression_review";
}
