import test from "node:test";
import assert from "node:assert/strict";
import {evaluateV9} from "../.tmp-health-cch-v9/motorV9Decision.js";
const base={data_quality:{status:"reviewable"},periodization_decision:{recovery_context_sufficient:true,negative_performance_signals:0},equipment_provenance:{evidence:[{candidate_load:82.5,exposures:3}]},muscle_volume_response_review:[{comparable_versions:2,observation:"volume_observed_higher"}]};
test("several completed cycles with positive context permits selective review, not auto-prescription",()=>{
 const d=evaluateV9(base,"good","none");assert.equal(d.phase,"selective_review");
 assert.equal(d.equipmentCandidates,1);assert.equal(d.volumeComparableGroups,1);
 assert.ok(d.options.every(o=>o.automaticChange===false));
});
test("pain overrides favorable historical evidence",()=>assert.equal(evaluateV9(base,"good","pain").phase,"review_recovery"));
test("poor recovery overrides favorable historical evidence",()=>assert.equal(evaluateV9(base,"poor","none").phase,"review_recovery"));
test("incomplete recovery coverage is not readiness",()=>assert.equal(evaluateV9({...base,periodization_decision:{recovery_context_sufficient:false,negative_performance_signals:0}},"good","none").phase,"consolidate_evidence"));
test("negative observations require review",()=>assert.equal(evaluateV9({...base,periodization_decision:{recovery_context_sufficient:true,negative_performance_signals:1}},"good","none").phase,"review_performance"));
test("low confidence does not make advanced athlete a beginner",()=>{
 const d=evaluateV9({...base,data_quality:{status:"limited"}},"good","none");
 assert.equal(d.phase,"consolidate_evidence");assert.ok(d.blockers.some(s=>s.includes("não altera nível")));
});
test("fat loss goal is never inferred from history",()=>assert.match(evaluateV9(base,"good","none").options.find(o=>o.goal==="fat_loss").reason,/não é inferida/));
