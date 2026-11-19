export type ExerciseExecution={
 exposures:number;completed_sets:number;sets_with_reps:number;sets_with_rir:number;
 reps_comparable:number;reps_in_range:number;reps_below_range:number;reps_above_range:number;
 rir_comparable:number;rir_below_plan:number;rir_at_or_above_plan:number;
};
export function interpretExecution(x:ExerciseExecution){
 const ratio=x.reps_comparable>0?x.reps_in_range/x.reps_comparable:null;
 const coverage=x.completed_sets>0?x.sets_with_reps/x.completed_sets:0;
 const rirCoverage=x.completed_sets>0?x.sets_with_rir/x.completed_sets:0;
 const signal=x.exposures<2||x.reps_comparable<4?"insufficient":
   x.reps_below_range>x.reps_in_range?"review_prescription":"reviewable_execution";
 return {signal,rangeAdherence:ratio,repsCoverage:coverage,rirCoverage,
  caveat:"Adherence and RIR do not establish exercise technique or physiological readiness."};
}
