import test from "node:test";
import assert from "node:assert/strict";
import {consentPlan,captureReadiness,reviewFromExistingM4Event as map} from "../.tmp-cch-e5d/e5CaptureContracts.js";
const s={athlete_id:"athlete-a",session_id:"session-a",status:"completed",record_status:"active"};
const e={id:"note-id",athlete_id:"athlete-a",session_id:"session-a",event_type:"note",
 source:"user",occurred_at:"2026-11-19T12:00:00Z",created_by_auth_user_id:"owner-a",
 payload:{contract:"cch-e5-session-review-v1",explicit_confirmation:true,recovery:"good",symptoms:"none"}};
test("explicit authored M4 note becomes review contract without writing",()=>{
 const r=map(e,s,"owner-a");assert.equal(r.review?.source,"explicit_session_review");
 assert.equal(r.review?.recovery,"good");assert.deepEqual(r.missing,[]);
});
test("cross athlete and mismatched session never become recovery",()=>{
 for(const change of [{athlete_id:"athlete-b"},{session_id:"session-b"}])
  assert.equal(map({...e,...change},s,"owner-a").review,null);
});
test("voided, active and paused sessions cannot be associated",()=>{
 for(const change of [{status:"active"},{record_status:"voided"},{status:"paused"}])
  assert.equal(map(e,{...s,...change},"owner-a").review,null);
});
test("system notes or incorrect actor cannot claim explicit user review",()=>{
 for(const change of [{source:"system"},{event_type:"session_completed"},
  {created_by_auth_user_id:null}])
  assert.equal(map({...e,...change},s,"owner-a").review,null);
 assert.equal(map(e,s,"owner-b").review,null);
});
test("unmarked note and M9 ordinal cannot be upgraded to good recovery",()=>{
 for(const payload of [{recovery:"good",symptoms:"none"},
   {contract:"cch-e5-session-review-v1",value_ordinal:5},
   {...e.payload,explicit_confirmation:false},
   {...e.payload,recovery:"5"}])
  assert.equal(map({...e,payload},s,"owner-a").review,null);
});
test("unknown reports do not silently turn into positive recovery",()=>{
 const r=map({...e,payload:{...e.payload,recovery:"unknown",symptoms:"unknown"}},s,"owner-a");
 assert.equal(r.review?.recovery,"unknown");assert.equal(r.review?.symptoms,"unknown");
});
test("missing timestamp and malformed payload are refused",()=>{
 assert.equal(map({...e,occurred_at:"bad"},s,"owner-a").review,null);
 assert.equal(map({...e,payload:null},s,"owner-a").review,null);
});
test("M1 consent contract is declared incompatible until migration and authorization",()=>{
 assert.equal(consentPlan.currentSchemaAccepts,false);
 assert.equal(consentPlan.requiresVersionedMigration,true);
 assert.equal(consentPlan.mayReuseGenericProcessingConsent,false);
 assert.equal(consentPlan.writeAuthorized,false);
});
test("real E5 collection and adaptation stay blocked",()=>{
 const gate=captureReadiness();assert.equal(gate.status,"blocked");
 assert.equal(gate.readyForRealCollection,false);assert.equal(gate.writeAuthorized,false);
 assert.equal(gate.automatedAdaptation,false);
 assert.ok(gate.outstanding.includes("authenticated_rls_homologation"));
});
