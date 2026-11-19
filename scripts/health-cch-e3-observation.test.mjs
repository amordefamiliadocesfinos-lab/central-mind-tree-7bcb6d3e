import test from "node:test";
import assert from "node:assert/strict";
import {mapM3M4F21Observations as map} from "../.tmp-cch-e3b/e3ObservationAdapter.js";
const s=(id,status="completed",record_status="active",template="ta",version="va")=>({
 id,program_version_id:version,session_template_id:template,started_at:"2026-11-01T12:00:00Z",
 status,record_status
});
const t=[{id:"ta",program_version_id:"va",code:"A1",status:"active"},
 {id:"tb",program_version_id:"vb",code:"B1",status:"disabled"}];
const working=(id,reps=8,rir=2)=>({session_id:id,status:"completed",set_type:"working",
 reps,rir,load_value:70,load_unit:"kg"});
test("maps completed nonvoided sessions from owned M3 versions only",()=>{
 const v=map([s("a"),s("b","active"),s("c","completed","voided"),
  s("d","completed","active","tb","vb")],[working("a"),working("d")],t,["va"]);
 assert.equal(v.totalValidSessions,1);
 assert.deepEqual(v.observations.map(x=>x.sessionCode),["A1"]);
});
test("unknown template is explicitly uncategorized, not invented",()=>{
 const v=map([s("a","completed","active","missing")],[working("a")],t,["va"]);
 assert.equal(v.uncategorizedSessions,1);
 assert.equal(v.observations[0].sessionCode,"");
});
test("sets must be working completed; incomplete reps or RIR are not comparable",()=>{
 const v=map([s("a"),s("b")],[working("a"),working("b",null)],
  t,["va"]);
 assert.equal(v.observations.find(x=>x.id==="a").exerciseDataComparable,true);
 assert.equal(v.observations.find(x=>x.id==="b").exerciseDataComparable,false);
 assert.equal(v.observations[1].workingSets,1);
});
test("absence of sets does not infer comparable workout",()=>{
 const v=map([s("a")],[],t,["va"]);
 assert.equal(v.missingWorkingSetData,1);
 assert.equal(v.observations[0].workingSets,null);
 assert.equal(v.observations[0].exerciseDataComparable,false);
});
test("different template version cannot relabel a completed session",()=>{
 const v=map([s("a","completed","active","tb","va")],[working("a")],t,["va","vb"]);
 assert.equal(v.uncategorizedSessions,1);
});
test("pagination cap is reported instead of claiming full-history completeness",()=>{
 const v=map([s("a")],[working("a")],t,["va"],true);
 assert.equal(v.sourceTruncated,true);
});
test("does not infer recovery from completed sets",()=>{
 const v=map([s("a")],[working("a")],t,["va"]);
 assert.equal(v.observations[0].recoveryObserved,false);
});
