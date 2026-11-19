import test from "node:test";
import assert from "node:assert/strict";
import {alternativesE2,adjacentSwapE2} from "../.tmp-cch-e2b/e2Alternatives.js";
const muscles=[{exercise_id:"A",muscle_group_id:"chest",role:"primary"},{exercise_id:"B",muscle_group_id:"chest",role:"primary"},{exercise_id:"C",muscle_group_id:"back",role:"primary"}];
const eq=[{source_exercise_id:"A",target_exercise_id:"B",equivalence_type:"same_primary_muscle",confidence:"provisional"},{source_exercise_id:"A",target_exercise_id:"C",equivalence_type:"same_pattern",confidence:"provisional"}];
test("only catalog equivalences with shared primary muscles become alternatives",()=>{
 const a=alternativesE2("A",eq,muscles,["A","B","C"]);assert.equal(a.length,1);assert.equal(a[0].targetId,"B");
});
test("provisional catalog links are never called proven",()=>{
 assert.equal(alternativesE2("A",eq,muscles,["A","B"])[0].isProvisional,true);
});
test("absence of known primary muscles produces no alternative",()=>assert.deepEqual(alternativesE2("X",eq,muscles,["B"]),[]));
test("inactive replacements are excluded",()=>assert.deepEqual(alternativesE2("A",eq,muscles,["A"]),[]));
const rows=[{id:"x",exercise_id:"A",session_template_id:"t",sequence_order:1},{id:"y",exercise_id:"B",session_template_id:"t",sequence_order:2},{id:"z",exercise_id:"C",session_template_id:"other",sequence_order:3}];
test("only same-template neighboring positions swap",()=>{
 assert.deepEqual(adjacentSwapE2(rows,"y","up")?.otherId,"x");
 assert.equal(adjacentSwapE2(rows,"y","down"),null);
});
test("boundary and unknown exercise do not generate mutations",()=>{
 assert.equal(adjacentSwapE2(rows,"x","up"),null);assert.equal(adjacentSwapE2(rows,"missing","down"),null);
});
test("nonadjacent sequences are held for review",()=>{
 assert.equal(adjacentSwapE2([{...rows[0]},{...rows[1],sequence_order:3}],"x","down"),null);
});
