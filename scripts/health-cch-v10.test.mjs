import test from "node:test";import assert from "node:assert/strict";
import {interpretExecution} from "../.tmp-health-cch-v10/executionEvidence.js";
const x={exposures:4,completed_sets:12,sets_with_reps:12,sets_with_rir:10,
 reps_comparable:12,reps_in_range:9,reps_below_range:2,reps_above_range:1,
 rir_comparable:10,rir_below_plan:2,rir_at_or_above_plan:8};
test("real completed sets permit descriptive plan adherence",()=>{
 const y=interpretExecution(x);assert.equal(y.signal,"reviewable_execution");assert.equal(y.rangeAdherence,0.75);
});
test("zero planned targets avoids division by zero",()=>{
 const y=interpretExecution({...x,reps_comparable:0,reps_in_range:0});assert.equal(y.signal,"insufficient");assert.equal(y.rangeAdherence,null);
});
test("substantial below-range sets signal review, not forced progression",()=>{
 const y=interpretExecution({...x,reps_below_range:8,reps_in_range:3});assert.equal(y.signal,"review_prescription");
});
test("single exposure is not enough even with completed sets",()=>assert.equal(interpretExecution({...x,exposures:1}).signal,"insufficient"));
test("missing RIR is not imputed",()=>assert.equal(interpretExecution({...x,sets_with_rir:0}).rirCoverage,0));
