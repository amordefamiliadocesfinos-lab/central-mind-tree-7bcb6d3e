import test from "node:test";import assert from "node:assert/strict";
import {interpretVolume,decideCyclePhase} from "../.tmp-health-cch-volume/multiCycleEvidence.js";
test("more observed volume is not considered tolerance",()=>assert.equal(interpretVolume({muscle_id:"a",comparable_versions:2,recent_observed_sets_per_7_days:12,previous_observed_sets_per_7_days:8,observation:"volume_observed_higher"}),"higher_observed_only"));
test("uncomparable volume cannot imply progress",()=>assert.equal(interpretVolume({muscle_id:"a",comparable_versions:1,recent_observed_sets_per_7_days:12,previous_observed_sets_per_7_days:null,observation:"insufficient"}),"insufficient"));
test("recovery coverage is required for selective review",()=>{
 assert.equal(decideCyclePhase(3,"reviewable",false,0),"confirm_recovery_context");
 assert.equal(decideCyclePhase(3,"reviewable",true,1),"review_performance");
 assert.equal(decideCyclePhase(3,"reviewable",true,0),"selective_progression_review");
});
test("many cycles do not override poor data",()=>assert.equal(decideCyclePhase(5,"limited",true,0),"consolidate_measurement"));
