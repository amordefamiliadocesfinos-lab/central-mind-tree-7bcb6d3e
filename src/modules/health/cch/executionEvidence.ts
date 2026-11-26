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

/** F24 P5: compare recorded work within one exercise/session, never infer fatigue or prescribe dose. */
export type F24GuidanceSet={id:string;status:string;set_type:string;reps:number|null;rir:number|null;load_value:number|null;load_unit:string};
export type F24ExecutionSignal="below_reps"|"below_rir"|null;
export function assessF24ExecutionSignal(sets:readonly F24GuidanceSet[],minimum:number|null,rirTarget:number|null):F24ExecutionSignal{
 const work=sets.filter(s=>s.status==="completed"&&s.set_type==="working");
 if(work.length<2||new Set(work.map(s=>s.id)).size!==work.length||work.some(s=>!s.id.trim()))return null;
 // Compare only measured sets at the same recorded load and unit. No cross-machine or cross-session trend.
 const first=work[0];
 if(first.load_value===null||!Number.isFinite(first.load_value)||first.load_value<0||
    !["kg","lb"].includes(first.load_unit)||
    work.some(s=>s.load_value!==first.load_value||s.load_unit!==first.load_unit))return null;
 if(minimum!==null&&Number.isInteger(minimum)&&minimum>0&&
    work.every(s=>s.reps!==null&&Number.isInteger(s.reps)&&s.reps>0&&s.reps<minimum))return "below_reps";
 if(rirTarget!==null&&Number.isFinite(rirTarget)&&rirTarget>0&&
    work.every(s=>s.rir!==null&&Number.isFinite(s.rir)&&s.rir>=0&&s.rir<rirTarget))return "below_rir";
 return null;
}
