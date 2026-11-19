import test from "node:test";
import assert from "node:assert/strict";
import {assessFlexiblePeriodizationE3 as assess} from "../.tmp-cch-e3/periodizationFlexibleE3.js";

const make=(i,opts={})=>({
 id:String(i),occurredAt:`2026-11-${String(i+1).padStart(2,"0")}T12:00:00Z`,
 programVersionId:"source",sessionCode:["A1","B1","C1","D1","E1"][i%5],
 status:"completed",valid:true,workingSets:12,exerciseDataComparable:true,recoveryObserved:true,...opts
});
const base={goal:"hypertrophy",trainingLevel:"advanced",dataQuality:"reviewable",
 recovery:"good",symptoms:"none",adversePerformanceSignals:0,
 sessions:[make(0),make(1),make(2)],sourceVersionId:"source",
 currentPublishedVersionId:"source",proposedVersionId:"draft",plannedStimuli:["A1","B1","C1","D1","E1"],
 preferredAvailability:5};
test("advanced level preserved and no writes, even in reviewable context",()=>{
 const x=assess(base);
 assert.equal(x.levelPreserved,"advanced");
 assert.equal(x.status,"eligible_for_manual_review");
 assert.equal(x.manualPublicationRequired,true);
 assert.equal(x.generatesQueue,false);
 assert.equal(x.checkpoint.calendarDeadline,null);
 assert.equal(x.checkpoint.mandatorySessionCount,null);
 assert.deepEqual(x.coverage.stimulusSequence.pending,["D1","E1"]);
});
test("3/4/5 actual sessions never creates a fixed-week prescription",()=>{
 for(const n of [3,4,5,7]){
  const x=assess({...base,sessions:Array.from({length:n},(_,i)=>make(i))});
  assert.equal(x.cycle.completedSessions,n);
  assert.equal(x.checkpoint.calendarDeadline,null);
  assert.equal(x.checkpoint.mandatorySessionCount,null);
  assert.equal(x.generatesQueue,false);
 }
});
test("long pauses remain observations, not failed schedule",()=>{
 const x=assess({...base,sessions:[make(0),make(1,{occurredAt:"2026-12-15T00:00:00Z"})]});
 assert.ok(x.cycle.observedSpanDays>30);
 assert.equal(x.status,"eligible_for_manual_review");
});
test("insufficient evidence never downgrades training level or predicts load",()=>{
 const x=assess({...base,dataQuality:"limited",sessions:[make(0,{exerciseDataComparable:false})]});
 assert.equal(x.levelPreserved,"advanced");
 assert.equal(x.readiness,"insufficient");
 assert.equal(x.alternatives.some(a=>a.strategy==="continue_progression"),false);
});
test("pain or inadequate recovery overrides volume metrics",()=>{
 for(const context of [{symptoms:"pain"},{recovery:"poor"}]){
  const x=assess({...base,...context});
  assert.equal(x.status,"review_recovery");
  assert.equal(x.checkpoint.type,"review_now");
  assert.equal(x.generatesQueue,false);
 }
});
test("no comparisons across divergent published versions",()=>{
 const x=assess({...base,currentPublishedVersionId:"other"});
 assert.equal(x.publishedSourceAligned,false);
 assert.equal(x.readiness,"insufficient");
});
test("voided and active sessions not counted; duplicate ids do not double count",()=>{
 const x=assess({...base,sessions:[make(0),make(0),make(1,{status:"voided"}),make(2,{status:"active"})]});
 assert.equal(x.cycle.completedSessions,1);
 assert.equal(x.cycle.observedWorkingSets,12);
});
test("missing dates or sets produce null instead of false precision",()=>{
 const x=assess({...base,sessions:[make(0),make(1,{occurredAt:null,workingSets:null})]});
 assert.equal(x.cycle.observedSpanDays,null);
 assert.equal(x.cycle.observedWorkingSets,null);
});
test("unknown goal cannot be invented by program",()=>{
 const x=assess({...base,goal:"unsure"});
 assert.equal(x.objective,"unsure");
 assert.equal(x.readiness,"insufficient");
});
test("planned-vs-performed compares session codes not weekly goals",()=>{
 const x=assess({...base,plannedStimuli:["A1","B1"],sessions:[make(0),make(1),make(2)]});
 assert.deepEqual(x.coverage.stimulusSequence.unplanned,["C1"]);
 assert.equal(x.coverage.plannedCompletedRatio,1);
 assert.match(x.coverage.comparativeCaveat,/descritiva/);
});

test("no proposed version means observation only; cannot imply eligible draft",()=>{
 const x=assess({...base,proposedVersionId:null});
 assert.equal(x.status,"review_evidence");
 assert.equal(x.readiness,"insufficient");
 assert.equal(x.alternatives.some(a=>a.strategy==="continue_progression"),false);
});
