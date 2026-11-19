import test from "node:test";
import assert from "node:assert/strict";
import { buildCycleDecisionBrief } from "../.tmp-health-cch/cycleDecisionModel.js";

const strong = {
  data_quality: {status:"reviewable"},
  exercise_assessments: [{decision:"progress_candidate"}, {decision:"maintain"}],
  load_trends: [{signal:"stable_observed",exposures:5}, {signal:"reps_increased_observed",exposures:3}],
  data_gaps: [],
};
test("complete evidence and athlete good recovery can propose selective progression", () => {
  const result=buildCycleDecisionBrief(strong,"good","none","hypertrophy","continue_progression");
  assert.equal(result.allowProgression,true);
  assert.equal(result.recommendation,"continue_progression");
});
test("pain blocks changes even with strong evidence",()=>{
  const result=buildCycleDecisionBrief(strong,"good","pain","hypertrophy","continue_progression");
  assert.equal(result.allowProgression,false);
  assert.equal(result.recommendation,"recovery_review");
});
test("missing recovery is not interpreted as good",()=>{
  const result=buildCycleDecisionBrief(strong,"unknown","none","hypertrophy","continue_progression");
  assert.equal(result.allowProgression,false);
});
test("limited data never lowers the athlete's training level",()=>{
  const result=buildCycleDecisionBrief({data_quality:{status:"limited"}},"good","none","strength","consolidate");
  assert.equal(result.recommendation,"consolidate");
  assert.equal(result.allowProgression,false);
  assert.match(result.reasons.join(" "),/não altera o nível/);
});
test("negative evidence prevents automatic volume",()=>{
  const report={...strong,load_trends:[{signal:"review",exposures:3}]};
  const result=buildCycleDecisionBrief(report,"good","none","muscle_priority","continue_progression");
  assert.equal(result.allowVolumeProposal,false);
  assert.equal(result.recommendation,"recovery_review");
});
test("targeted volume is available only for explicitly chosen goal and strategy",()=>{
  const allowed=buildCycleDecisionBrief(strong,"good","none","muscle_priority","continue_progression");
  assert.equal(allowed.allowVolumeProposal,true);
  assert.equal(buildCycleDecisionBrief(strong,"good","none","strength","continue_progression").allowVolumeProposal,false);
  assert.equal(buildCycleDecisionBrief(strong,"good","none","muscle_priority","consolidate").allowVolumeProposal,false);
});
test("uncertain pain blocks all automatic progressions",()=>{
  assert.equal(buildCycleDecisionBrief(strong,"good","unknown","hypertrophy","continue_progression").allowProgression,false);
});
test("fat loss is not inferred from training history",()=>{
  const result=buildCycleDecisionBrief(strong,"good","none","fat_loss","consolidate");
  assert.match(result.reasons.join(" "),/não determina necessidade/);
});
