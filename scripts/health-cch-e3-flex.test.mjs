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

test("E3 observations are isolated to the source program version",()=>{
 const x=assess({...base,sessions:[
  make(0),make(1),
  make(2,{programVersionId:"older",sessionCode:"D1",workingSets:99}),
  make(3,{programVersionId:"newer",sessionCode:"E1",workingSets:101})
 ]});
 assert.equal(x.cycle.completedSessions,2);
 assert.equal(x.cycle.comparableSessions,2);
 assert.equal(x.cycle.observedWorkingSets,24);
 assert.deepEqual(x.coverage.stimulusSequence.performed,["A1","B1"]);
 assert.deepEqual(x.coverage.stimulusSequence.pending,["C1","D1","E1"]);
 assert.equal(x.status,"eligible_for_manual_review");
 assert.equal(x.generatesQueue,false);
});

test("unknown source version cannot borrow observations from another cycle",()=>{
 const x=assess({...base,sourceVersionId:null,sessions:[make(0),make(1)]});
 assert.equal(x.cycle.completedSessions,0);
 assert.equal(x.cycle.observedWorkingSets,0);
 assert.equal(x.coverage.plannedCompletedRatio,0);
 assert.equal(x.publishedSourceAligned,false);
 assert.equal(x.readiness,"insufficient");
 assert.equal(x.manualPublicationRequired,true);
});


test("missing dates do not qualify for manual review even with two comparable sessions",()=>{
 const x=assess({...base,sessions:[make(0),make(1),make(2,{occurredAt:null})]});
 assert.equal(x.status,"review_evidence");
 assert.equal(x.readiness,"insufficient");
 assert.equal(x.cycle.observedSpanDays,null);
 assert.equal(x.alternatives.some(a=>a.strategy==="continue_progression"),false);
 assert.ok(x.reasons.some(r=>r.includes("Datas ausentes")));
 assert.equal(x.levelPreserved,"advanced");
 assert.equal(x.generatesQueue,false);
});
test("conflicting duplicate ids are excluded irrespective of arrival order",()=>{
 const first=make(0),contradiction=make(0,{sessionCode:"E2",workingSets:800});
 for(const rows of [[first,contradiction,make(1),make(2)],
                    [contradiction,first,make(1),make(2)]]){
  const x=assess({...base,sessions:rows});
  assert.equal(x.status,"review_evidence");
  assert.equal(x.cycle.completedSessions,2);
  assert.equal(x.cycle.observedWorkingSets,24);
  assert.deepEqual(x.coverage.stimulusSequence.performed,["B1","C1"]);
  assert.ok(x.reasons.some(r=>r.includes("duplicada")));
  assert.equal(x.generatesQueue,false);
 }
});
test("identical duplicate ids are deduplicated without blocking a legitimate review",()=>{
 const x=assess({...base,sessions:[make(0),make(0),make(1),make(2)]});
 assert.equal(x.status,"eligible_for_manual_review");
 assert.equal(x.cycle.completedSessions,3);
 assert.equal(x.cycle.observedWorkingSets,36);
});
