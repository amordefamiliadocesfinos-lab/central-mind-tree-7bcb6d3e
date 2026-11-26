import test from "node:test";
import assert from "node:assert/strict";
import {describeRecoveryContext,buildCycleDecisionBrief} from "../src/modules/health/cch/cycleDecisionModel.ts";
const context={as_of_date:"2026-11-25",recovery_observed_days:3,fatigue_observed_days:2};
const source={sourceAligned:true,state:"observed_needs_interpretation",context};
test("aligned observations describe coverage without claiming readiness",()=>{
 const result=describeRecoveryContext(source);
 assert.match(result.summary,/25\/11\/2026/);
 assert.match(result.detail,/3 dia\(s\)/);
 assert.match(result.detail,/não confirmam prontidão/);
});
test("missing, unaligned, malformed, empty or unknown data do not assert recovery",()=>{
 for(const patch of [{sourceAligned:false},{state:"unknown"},{context:null},{context:{...context,as_of_date:"2026-02-30"}},{context:{...context,fatigue_observed_days:-1}},{context:{...context,recovery_observed_days:0,fatigue_observed_days:0}}]){
  assert.equal(describeRecoveryContext({...source,...patch}).summary,"Cobertura de recuperação não confirmada.");
 }
});
const evidence={data_quality:{status:"reviewable"},exercise_assessments:[{decision:"progress_candidate"}]};
test("explicit goal and current self-report are mandatory for progression",()=>{
 for(const [goal,recovery,symptoms] of [["unsure","good","none"],["strength","unknown","none"],["strength","good","unknown"],["strength","good","pain"],["strength","poor","none"]]){
  assert.equal(buildCycleDecisionBrief(evidence,recovery,symptoms,goal,"continue_progression").allowProgression,false);
 }
});
test("strength review can be recommended but does not imply automatic volume or publication",()=>{
 const result=buildCycleDecisionBrief(evidence,"good","none","strength","continue_progression");
 assert.equal(result.allowProgression,true);
 assert.equal(result.recommendation,"continue_progression");
 assert.equal(result.allowVolumeProposal,false);
});
