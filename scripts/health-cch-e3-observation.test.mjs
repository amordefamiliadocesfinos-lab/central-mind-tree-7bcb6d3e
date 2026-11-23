import test from "node:test";
import assert from "node:assert/strict";
import {mapM3M4F21Observations as map,viewE3ReadSnapshot} from "../.tmp-cch-e3b/e3ObservationAdapter.js";
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

test("E3 read scope switches redact previous athlete history before new request resolves",()=>{
 const old={scopeKey:JSON.stringify(["athlete-A","program-A"]),
  data:map([s("secret-A")],[working("secret-A")],t,["va"]),
  loading:false,error:null};
 const nextScope=JSON.stringify(["athlete-B","program-B"]);
 const masked=viewE3ReadSnapshot(nextScope,old);
 assert.equal(masked.observations.length,0);
 assert.equal(masked.totalValidSessions,0);
 assert.equal(masked.loading,true);
 assert.equal(masked.error,null);
 assert.equal(masked.sourceTruncated,false);
 const correct=viewE3ReadSnapshot(old.scopeKey,old);
 assert.equal(correct.totalValidSessions,1);
 assert.equal(correct.observations[0].id,"secret-A");
});
test("E3 read scope redacts previous program even for same athlete",()=>{
 const state={scopeKey:JSON.stringify(["athlete-A","program-A"]),
  data:map([s("record-A")],[working("record-A")],t,["va"]),
  loading:false,error:"old error"};
 const masked=viewE3ReadSnapshot(JSON.stringify(["athlete-A","program-B"]),state);
 assert.deepEqual(masked.observations,[]);
 assert.equal(masked.error,null);
 assert.equal(masked.loading,true);
 const loggedOut=viewE3ReadSnapshot(null,state);
 assert.equal(loggedOut.loading,false);
 assert.equal(loggedOut.totalValidSessions,0);
});
test("E3 scope cannot be confused by delimiter-containing athlete/program IDs",()=>{
 const a=JSON.stringify(["a|b","c"]);
 const b=JSON.stringify(["a","b|c"]);
 assert.notEqual(a,b);
 assert.equal(viewE3ReadSnapshot(b,{
  scopeKey:a,data:map([s("record")],[working("record")],t,["va"]),
  loading:false,error:null
 }).observations.length,0);
});
