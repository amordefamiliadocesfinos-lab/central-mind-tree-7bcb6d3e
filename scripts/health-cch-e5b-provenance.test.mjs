import test from "node:test";
import assert from "node:assert/strict";
import {mapE5Provenance as map,hasCurrentE5Consent} from "../.tmp-cch-e5b/e5ProvenanceAdapter.js";
import {assessE5Evidence as assess} from "../.tmp-cch-e5b/longitudinalEvidenceE5.js";
const session=(n,extra={})=>({id:"s"+n,athlete_id:"a",program_version_id:"v1",
 started_at:"2026-11-0"+n+"T10:00:00Z",status:"completed",record_status:"active",...extra});
const exercise=(n,extra={})=>({id:"e"+n,athlete_id:"a",session_id:"s"+n,
 exercise_id:"bench",status:"completed",...extra});
const set=(n,k,extra={})=>({id:"set"+n+"-"+k,athlete_id:"a",session_id:"s"+n,
 workout_exercise_id:"e"+n,status:"completed",set_type:"working",
 load_value:80,load_unit:"kg",reps:8,rir:2,...extra});
const equipment=(n,extra={})=>({athlete_id:"a",session_id:"s"+n,
 workout_exercise_id:"e"+n,exercise_id:"bench",equipment_label:"Machine A",
 confirmed_at:"2026-11-0"+n+"T10:20:00Z",...extra});
const review=(n,extra={})=>({athlete_id:"a",session_id:"s"+n,recovery:"good",
 symptoms:"none",source:"explicit_session_review",reviewed_at:"2026-11-0"+n+"T11:00:00Z",...extra});
const consent={athlete_id:"a",consent_type:"e5_personalized_review",
 decision:"granted",occurred_at:"2026-11-04T10:00:00Z",policy_version:"e5-v1"};
const base={athleteId:"a",sourceVersionId:"v1",exerciseId:"bench",equipmentLabel:"Machine A",
 loadUnit:"kg",trainingLevel:"advanced",dataQuality:"reviewable",
 adverseSignals:0,goalChosenInCurrentReview:true,
 sessions:[session(1),session(2)],exercises:[exercise(1),exercise(2)],
 sets:[set(1,1),set(1,2),set(2,1),set(2,2)],
 equipment:[equipment(1),equipment(2)],sessionReviews:[review(1),review(2)],
 consents:[consent],activePolicyVersion:"e5-v1"};
test("confirmed label yields provenance key, not invented physical UUID",()=>{
 const r=map(base),gate=assess(r.context);
 assert.equal(r.provenance.equipmentBasis,"confirmed_execution_label");
 assert.equal(r.context.observations.length,2);
 assert.equal(gate.state,"descriptive_review_only");
 assert.equal(gate.numericIncrement,null);assert.equal(gate.autoAdapt,false);
 assert.equal(r.writes,false);assert.equal(r.recoveryInferred,false);assert.equal(r.consentInferred,false);
});
test("absent equipment and historical unconfirmed labels cannot pass",()=>{
 for(const equipmentRows of [[],[equipment(1)], [equipment(1,{confirmed_at:null}),equipment(2)]]){
  const r=map({...base,equipment:equipmentRows});
  assert.equal(assess(r.context).state,"blocked");
  assert.ok(r.provenance.missing.includes("execution_equipment_unconfirmed_or_ambiguous"));
 }
});
test("cross athlete, version and voided sessions excluded",()=>{
 const r=map({...base,sessions:[session(1),session(2,{program_version_id:"v0"}),
  session(3,{record_status:"voided"}),session(4,{athlete_id:"b"})],
  exercises:[...base.exercises,exercise(3),exercise(4)]});
 assert.deepEqual(r.provenance.eligibleSessionIds,["s1"]);
 assert.equal(assess(r.context).state,"blocked");
});
test("different units, ambiguous exercises and mixed loads are not converted or averaged",()=>{
 const r=map({...base,exercises:[...base.exercises,exercise(1,{id:"dup"})],
  sets:[set(1,1),set(1,2),set(2,1),set(2,2,{load_value:82})]});
 assert.equal(r.context.observations.length,0);
 assert.equal(assess(r.context).state,"blocked");
 const lb=map({...base,sets:[set(1,1,{load_unit:"lb"}),set(2,1,{load_unit:"lb"})]});
 assert.equal(lb.context.observations.length,0);
});
test("raw calendar checkins cannot be silently interpreted as session recovery",()=>{
 const r=map({...base,sessionReviews:[]});
 assert.equal(r.context.observations.length,2);
 assert.deepEqual(r.context.observations.map(o=>o.recovery),["unknown","unknown"]);
 assert.equal(assess(r.context).state,"blocked");
});
test("M1 generic processing and revoked or ambiguous E5 consent cannot authorize E5",()=>{
 const generic={...consent,consent_type:"health_data_processing"};
 for(const consents of [[generic],[consent,{...consent,decision:"revoked",occurred_at:"2026-11-05T10:00:00Z"}],
  [consent,{...consent,decision:"revoked"}]]){
  assert.equal(hasCurrentE5Consent(consents,"a","e5-v1"),false);
  assert.equal(assess(map({...base,consents}).context).state,"blocked");
 }
 assert.equal(hasCurrentE5Consent([consent],"b","e5-v1"),false);
});
test("E5 offline review requires a trusted current policy version, not arbitrary historical consent",()=>{
 assert.equal(hasCurrentE5Consent([consent],"a",null),false);
 assert.equal(hasCurrentE5Consent([consent],"a",""),false);
 assert.equal(hasCurrentE5Consent([consent],"a","e5-v2"),false);
 assert.equal(hasCurrentE5Consent([consent],"a","e5-v1"),true);
 for(const version of [null,"","e5-v2"]){
  const r=map({...base,activePolicyVersion:version});
  assert.equal(r.context.consentToPersonalizedReview,false);
  assert.equal(assess(r.context).state,"blocked");
 }
 const conflicting=[consent,{...consent}];
 assert.equal(hasCurrentE5Consent(conflicting,"a","e5-v1"),false);
 assert.equal(assess(map({...base,consents:conflicting}).context).state,"blocked");
 const outdated=[consent,{...consent,decision:"granted",
  policy_version:"e5-v0",occurred_at:"2026-11-06T10:00:00Z"}];
 assert.equal(hasCurrentE5Consent(outdated,"a","e5-v1"),false);
});
test("goal registry alone is not an explicit current choice",()=>{
 const r=map({...base,goalChosenInCurrentReview:false});
 assert.equal(r.context.goalChosen,false);assert.equal(assess(r.context).state,"blocked");
});
test("unconfirmed recovery symptoms keep athlete advanced but block readiness",()=>{
 const r=map({...base,sessionReviews:[review(1),review(2,{symptoms:"pain"})]});
 const gate=assess(r.context);
 assert.equal(gate.state,"blocked");assert.equal(gate.levelPreserved,"advanced");
 assert.equal(gate.numericIncrement,null);assert.equal(gate.volumeChange,null);
});
test("duplicate or conflicting equipment confirmations are blocked",()=>{
 const r=map({...base,equipment:[equipment(1),equipment(1),equipment(2)]});
 assert.equal(r.context.observations.length,1);assert.equal(assess(r.context).state,"blocked");
});
