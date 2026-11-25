import test from "node:test";
import assert from "node:assert/strict";
import {assessE5Evidence as assess} from "../.tmp-cch-e5/longitudinalEvidenceE5.js";
const obs=(id,opts={})=>({
 id,athleteId:"athlete-a",programVersionId:"version-a",sessionId:"session-"+id,
 exerciseId:"bench",equipmentId:"machine-1",loadUnit:"kg",
 occurredAt:"2026-11-0"+id+"T12:00:00Z",completed:true,voided:false,
 workingSets:3,reps:8,rir:2,load:80,recovery:"good",symptoms:"none",...opts
});
const base={athleteId:"athlete-a",sourceVersionId:"version-a",exerciseId:"bench",
 equipmentId:"machine-1",loadUnit:"kg",trainingLevel:"advanced",
 goalChosen:true,consentToPersonalizedReview:true,dataQuality:"reviewable",
 adverseSignals:0,observations:[obs("1"),obs("2")]};
test("two comparable observations permit descriptive review, never automatic prescription",()=>{
 const r=assess(base);
 assert.equal(r.state,"descriptive_review_only");assert.equal(r.comparableSessions,2);
 assert.equal(r.levelPreserved,"advanced");assert.equal(r.numericIncrement,null);
 assert.equal(r.volumeChange,null);assert.equal(r.autoPublish,false);assert.equal(r.autoAdapt,false);
 assert.equal(r.causalClaim,false);
});
test("single session and duplicate sets never meet comparison gate",()=>{
 for(const observations of [[obs("1")],[obs("1"),obs("1",{id:"other"})]]){
  const r=assess({...base,observations});
  assert.equal(r.state,"blocked");assert.equal(r.comparableSessions,1);
 }
});
test("cross athlete, version, machine and units cannot be pooled",()=>{
 const observations=[obs("1"),obs("2",{athleteId:"athlete-b"}),
  obs("3",{programVersionId:"older"}),obs("4",{equipmentId:"machine-2"}),
  obs("5",{loadUnit:"lb"}),obs("6",{exerciseId:"row"})];
 const r=assess({...base,observations});
 assert.equal(r.comparableSessions,1);assert.equal(r.state,"blocked");
 assert.deepEqual(r.evidenceIds,["1"]);
});
test("voided, active and incomplete observations cannot inflate evidence",()=>{
 const r=assess({...base,observations:[obs("1"),obs("2",{voided:true}),
 obs("3",{completed:false}),obs("4",{rir:null}),obs("5",{occurredAt:null})]});
 assert.equal(r.comparableSessions,1);assert.equal(r.state,"blocked");
});
test("recovery, pain, unknown context and adverse signals block intensity inference",()=>{
 for(const change of [
  {observations:[obs("1"),obs("2",{symptoms:"pain"})]},
  {observations:[obs("1"),obs("2",{recovery:"poor"})]},
  {observations:[obs("1"),obs("2",{recovery:"unknown"})]},
  {adverseSignals:1},{adverseSignals:NaN}
 ]){const r=assess({...base,...change});assert.equal(r.state,"blocked");}
});
test("unknown equipment, quality, consent or athlete goal remain blocked",()=>{
 for(const change of [{equipmentId:null},{loadUnit:null},{sourceVersionId:null},
  {dataQuality:"partial"},{consentToPersonalizedReview:false},{goalChosen:false}]){
  const r=assess({...base,...change});
  assert.equal(r.state,"blocked");
  assert.equal(r.levelPreserved,"advanced");
  assert.equal(r.numericIncrement,null);
 }
});
test("range is descriptive and never mixed across machines or versions",()=>{
 const r=assess({...base,observations:[obs("1",{load:70}),obs("2",{load:85}),
  obs("3",{equipmentId:"machine-2",load:200})]});
 assert.deepEqual(r.observedLoadRange,{min:70,max:85});
 assert.equal(r.causalClaim,false);assert.equal(r.autoAdapt,false);
});

test("contradictory same-session observations block review regardless of order",()=>{
 const bad=obs("1",{id:"other",symptoms:"pain"});
 for(const observations of [[obs("1"),bad,obs("2")],[bad,obs("1"),obs("2")]]){
  const r=assess({...base,observations});
  assert.equal(r.state,"blocked");assert.equal(r.comparableSessions,1);
  assert.equal(r.autoAdapt,false);
 }
});
test("impossible calendar dates cannot count as comparable evidence",()=>{
 const r=assess({...base,observations:[obs("1"),obs("2",{occurredAt:"2026-02-30T12:00:00Z"})]});
 assert.equal(r.comparableSessions,1);assert.equal(r.state,"blocked");
});
