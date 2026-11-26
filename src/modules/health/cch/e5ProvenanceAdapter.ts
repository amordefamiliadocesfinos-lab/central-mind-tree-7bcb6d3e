/** E5-B — pure, read-only provenance mapper for existing M3/M4/F21/V8 rows.
 * Not a database client, an equipment registry, or a prescription engine.
 * Recovery check-ins have no session FK: NEVER infer per-session recovery
 * from calendar proximity or ordinal scores without explicit reviewed mapping.
 */
import {validE5Date} from "./longitudinalEvidenceE5.js";
import type {E5Context,E5Observation} from "./longitudinalEvidenceE5";
import type {RecoveryReport,SymptomReport} from "./cycleDecisionModel";

export type E5SessionRow={
 id:string;athlete_id:string;program_version_id:string|null;started_at:string|null;
 status:string;record_status:string;
};
export type E5WorkoutExerciseRow={
 id:string;athlete_id:string;session_id:string;exercise_id:string;status:string;
};
export type E5SetRow={
 id:string;athlete_id:string;session_id:string;workout_exercise_id:string;
 status:string;set_type:string;load_value:number|null;load_unit:string|null;
 reps:number|null;rir:number|null;
};
export type E5EquipmentRow={
 athlete_id:string;session_id:string;workout_exercise_id:string;
 exercise_id:string;equipment_label:string;confirmed_at:string|null;
};
export type E5ConsentRow={
 athlete_id:string;consent_type:string;decision:string;
 occurred_at:string;policy_version:string;
};
/** Explicitly reviewed session-specific reports; NOT raw recovery check-ins. */
export type E5SessionReview={
 athlete_id:string;session_id:string;recovery:RecoveryReport;symptoms:SymptomReport;
 source:"explicit_session_review";reviewed_at:string;
};
export type E5ProvenanceInput={
 athleteId:string;sourceVersionId:string|null;exerciseId:string;
 equipmentLabel:string|null;loadUnit:"kg"|"lb"|null;
 trainingLevel:E5Context["trainingLevel"];dataQuality:E5Context["dataQuality"];
 adverseSignals:number;goalChosenInCurrentReview:boolean;
 sessions:E5SessionRow[];exercises:E5WorkoutExerciseRow[];
 sets:E5SetRow[];equipment:E5EquipmentRow[];consents:E5ConsentRow[];
 /** Supplied only from a validated active-policy registry, never athlete input. */
 activePolicyVersion:string|null;
 sessionReviews:E5SessionReview[];
};
export type E5ProvenanceResult={
 contract:"cch-e5-provenance-v1";
 context:E5Context;
 provenance:{equipmentKey:string|null;equipmentBasis:"confirmed_execution_label"| "unconfirmed";
  eligibleSessionIds:string[];missing:string[];skippedSessions:number};
 writes:false;recoveryInferred:false;consentInferred:false;
};

const isDate=validE5Date;
const explicitTime=(s:string|null):boolean=>!!s&&validE5Date(s)&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(s);
const measured=(value:number|null)=>value!==null&&Number.isFinite(value)&&value>=0;
const decisionType="e5_personalized_review";

/** Most recent explicit E5 decision only. Missing, invalid or tied/conflicting
 * events cannot silently become consent. General M1 processing is NOT E5 consent.
 */
export function hasCurrentE5Consent(
 rows:E5ConsentRow[],athleteId:string,activePolicyVersion:string|null
):boolean{
 // Offline review cannot infer a registry version. With no explicitly
 // verified active policy, fail closed exactly like the candidate SQL.
 if(!activePolicyVersion||!activePolicyVersion.trim())return false;
 const events=rows.filter(r=>r.athlete_id===athleteId&&r.consent_type===decisionType);
 // A malformed decision might be a revocation; its chronology is unknowable.
 if(events.some(r=>!explicitTime(r.occurred_at)||!r.policy_version.trim()||
  !["granted","denied","revoked"].includes(r.decision)))return false;
 events.sort((a,b)=>Date.parse(b.occurred_at)-Date.parse(a.occurred_at));
 if(!events.length)return false;
 const top=Date.parse(events[0].occurred_at);
 const tied=events.filter(r=>Date.parse(r.occurred_at)===top);
 // Two decisions at the same timestamp are ambiguous, even if both granted.
 return tied.length===1&&tied[0].decision==="granted"&&
  tied[0].policy_version===activePolicyVersion;
}
export function mapE5Provenance(input:E5ProvenanceInput):E5ProvenanceResult{
 const missing=new Set<string>();
 // Consent must be resolved before any personalized evidence is assembled.
 const consent=hasCurrentE5Consent(input.consents,input.athleteId,input.activePolicyVersion);
 if(!consent){
  if(!input.activePolicyVersion?.trim())missing.add("active_e5_policy_version_missing");
  missing.add("explicit_e5_consent_missing");
  return {contract:"cch-e5-provenance-v1",
   context:{athleteId:input.athleteId,sourceVersionId:input.sourceVersionId,exerciseId:input.exerciseId,
    equipmentId:null,loadUnit:null,trainingLevel:input.trainingLevel,goalChosen:input.goalChosenInCurrentReview,
    consentToPersonalizedReview:false,dataQuality:"limited",adverseSignals:0,observations:[]},
   provenance:{equipmentKey:null,equipmentBasis:"unconfirmed",eligibleSessionIds:[],missing:[...missing].sort(),skippedSessions:0},
   writes:false,recoveryInferred:false,consentInferred:false};
 }
 const label=input.equipmentLabel?.trim()??"";
 const targetUnit=input.loadUnit;
 // This is a *provenance comparison key* from the execution label, not a
 // physical equipment UUID or independent verification of a gym machine.
 const labelValid=label.length>=2&&label.length<=100;
 const equipmentKey=labelValid&&targetUnit?
  JSON.stringify(["confirmed_execution_label",input.exerciseId,label,targetUnit]):null;
 if(!equipmentKey)missing.add("equipment_label_or_unit_missing");

 const scopedSessions=input.sessions.filter(s=>s.athlete_id===input.athleteId);
 const sessionById=new Map<string,E5SessionRow>();
 const ambiguousSessions=new Set<string>();
 for(const s of scopedSessions){
  if(!s.id||ambiguousSessions.has(s.id))continue;
  const prior=sessionById.get(s.id);
  if(prior&&JSON.stringify([prior.program_version_id,prior.started_at,prior.status,prior.record_status])!==
   JSON.stringify([s.program_version_id,s.started_at,s.status,s.record_status])){
   ambiguousSessions.add(s.id);sessionById.delete(s.id);
  }else sessionById.set(s.id,s);
 }
 for(const [id,s] of sessionById){
  if(s.status!=="completed"||s.record_status!=="active"||!input.sourceVersionId||
   s.program_version_id!==input.sourceVersionId||!isDate(s.started_at))sessionById.delete(id);
 }
 if(ambiguousSessions.size)missing.add("ambiguous_session_identity");
 const exerciseBySession=new Map<string,E5WorkoutExerciseRow[]>();
 for(const e of input.exercises){
  if(e.athlete_id!==input.athleteId||e.exercise_id!==input.exerciseId||
   e.status!=="completed"||!sessionById.has(e.session_id))continue;
  const arr=exerciseBySession.get(e.session_id)??[];
  arr.push(e);exerciseBySession.set(e.session_id,arr);
 }
 const results:E5Observation[]=[];
 let skipped=0;
 for(const [sessionId,items] of exerciseBySession){
  if(items.length!==1){missing.add("ambiguous_exercise_instance");skipped++;continue;}
  const ex=items[0];const session=sessionById.get(sessionId)!;
  const confirmation=input.equipment.filter(eq=>
   eq.athlete_id===input.athleteId&&eq.session_id===sessionId&&
   eq.workout_exercise_id===ex.id&&eq.exercise_id===input.exerciseId);
  if(!equipmentKey||confirmation.length!==1||
   confirmation[0].equipment_label.trim()!==label||!isDate(confirmation[0].confirmed_at)){
   missing.add("execution_equipment_unconfirmed_or_ambiguous");skipped++;continue;
  }
  const working=input.sets.filter(s=>s.athlete_id===input.athleteId&&
   s.session_id===sessionId&&s.workout_exercise_id===ex.id&&
   s.status==="completed"&&s.set_type==="working");
  if(!working.length||new Set(working.map(s=>s.id)).size!==working.length||working.some(s=>!s.id||!measured(s.load_value)||
   !measured(s.reps)||!Number.isInteger(s.reps)||s.reps===0||!measured(s.rir)||s.load_unit!==targetUnit)||
   new Set(working.map(s=>s.load_value)).size!==1){
   // No arbitrary representative load when sets differ or are incomplete.
   missing.add("complete_same_unit_and_load_sets_missing");skipped++;continue;
  }
  const reviews=input.sessionReviews.filter(r=>r.athlete_id===input.athleteId&&
   r.session_id===sessionId&&r.source==="explicit_session_review");
  const latest=reviews.sort((a,b)=>Date.parse(b.reviewed_at)-Date.parse(a.reviewed_at));
  const topTime=latest.length?Date.parse(latest[0].reviewed_at):null;
  const tied=latest.filter(r=>Date.parse(r.reviewed_at)===topTime);
  const review=reviews.every(r=>explicitTime(r.reviewed_at)&&Date.parse(r.reviewed_at)>=Date.parse(session.started_at!))&&tied.length===1?latest[0]:null;
  if(!review)missing.add("session_recovery_review_missing");
  // The descriptive values below summarize multiple sets conservatively;
  // the gate E5-A still NEVER prescribes volume or load.
  results.push({
   id:ex.id,athleteId:input.athleteId,sessionId,programVersionId:session.program_version_id!,
   exerciseId:input.exerciseId,equipmentId:equipmentKey,loadUnit:targetUnit,
   occurredAt:session.started_at,completed:true,voided:false,
   workingSets:working.length,reps:Math.min(...working.map(s=>s.reps!)),
   rir:Math.min(...working.map(s=>s.rir!)),load:working[0].load_value,
   recovery:review?.recovery??"unknown",symptoms:review?.symptoms??"unknown"
  });
 }
 if(results.length<2)missing.add("repeated_comparable_sessions_missing");

 if(!input.goalChosenInCurrentReview)missing.add("current_goal_confirmation_missing");
 const context:E5Context={
  athleteId:input.athleteId,sourceVersionId:input.sourceVersionId,
  exerciseId:input.exerciseId,equipmentId:equipmentKey,loadUnit:targetUnit,
  trainingLevel:input.trainingLevel,goalChosen:input.goalChosenInCurrentReview,
  consentToPersonalizedReview:consent,dataQuality:ambiguousSessions.size?"limited":input.dataQuality,
  adverseSignals:input.adverseSignals,observations:results
 };
 return {contract:"cch-e5-provenance-v1",context,
  provenance:{equipmentKey,equipmentBasis:results.length?"confirmed_execution_label":"unconfirmed",
   eligibleSessionIds:results.map(x=>x.sessionId),missing:[...missing].sort(),skippedSessions:skipped},
  writes:false,recoveryInferred:false,consentInferred:false
 };
}
