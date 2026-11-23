import test from "node:test";
import assert from "node:assert/strict";
import {selectF24ComparableHistory as select} from "../.tmp-cch-f24-g2/f24ComparableHistory.js";
const row=(x={})=>({sessionId:"prior",sessionStartedAt:"2026-11-20T10:00:00Z",
  workoutExerciseId:"prior-set",exerciseId:"supino",equipmentLabel:"Máquina A",
  loadValue:80,loadUnit:"kg",reps:8,rir:2,completedAt:"2026-11-20T10:30:00Z",...x});
test("same confirmed equipment takes priority over newer different equipment",()=>{
 const x=select("supino"," máquina a ",[
  row({sessionId:"newer",equipmentLabel:"Máquina B",sessionStartedAt:"2026-11-22T10:00:00Z",loadValue:130}),
  row()
 ]);
 assert.equal(x?.loadValue,80);
 assert.equal(x?.sessionId,"prior");
});
test("missing machine provenance and other exercise fail closed without load comparison",()=>{
 for(const equipment of [null,"", "Máquina B"])assert.equal(select("supino",equipment,[row()]),null);
 assert.equal(select("supino","Máquina A",[row({equipmentLabel:null})]),null);
 assert.equal(select("outro","Máquina A",[row()]),null);
});
test("invalid sets and chronology are not shown as comparable",()=>{
 for(const bad of [
  {reps:0},{loadValue:null},{loadValue:NaN},{loadUnit:"bodyweight"},
  {completedAt:null},{sessionStartedAt:"invalid"}
 ])assert.equal(select("supino","Máquina A",[row(bad)]),null);
});
test("latest comparable session and completed set wins; no arithmetic inference",()=>{
 const x=select("supino","Máquina A",[row(),row({sessionId:"new",
   sessionStartedAt:"2026-11-21T10:00:00Z",completedAt:"2026-11-21T11:00:00Z",loadValue:85,reps:6})]);
 assert.equal(x?.loadValue,85);assert.equal(x?.reps,6);assert.equal(x?.rir,2);
});
