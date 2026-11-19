import test from "node:test";import assert from "node:assert/strict";
import {assessDraftPublicationStructure} from "../.tmp-health-cch-e2f22/publicationStructure.js";
const valid={session_template_id:"active",is_optional:false,planned_sets_min:3,planned_sets_max:4,reps_min:6,reps_max:10,rir_target:2,rest_seconds:120};
test("active session with complete exercise passes visual structural mirror",()=>{
 const result=assessDraftPublicationStructure([{id:"active",status:"active"}],[valid]);
 assert.equal(result.publicationReady,true);
});
test("disabled sessions are not required, unlike previous UI",()=>{
 const result=assessDraftPublicationStructure([{id:"active",status:"active"},{id:"disabled",status:"disabled"}],[valid]);
 assert.equal(result.publicationReady,true);assert.equal(result.activeTemplateCount,1);
});
test("disabled-only program fails despite an exercise",()=>{
 const result=assessDraftPublicationStructure([{id:"active",status:"disabled"}],[valid]);
 assert.equal(result.publicationReady,false);assert.equal(result.activeTemplateCount,0);
});
test("an active empty session cannot be published",()=>{
 const result=assessDraftPublicationStructure([{id:"active",status:"active"}],[]);
 assert.equal(result.templatesWithoutExercises.length,1);assert.equal(result.publicationReady,false);
});
test("required incomplete prescription blocks publishing",()=>{
 const result=assessDraftPublicationStructure([{id:"active",status:"active"}],[{...valid,rir_target:null}]);
 assert.equal(result.publicationReady,false);
});
test("F22 ignores incomplete optional prescriptions for structural publication",()=>{
 const result=assessDraftPublicationStructure([{id:"active",status:"active"}],[{...valid,is_optional:true,reps_max:null}]);
 assert.equal(result.publicationReady,true);
});
test("RIR above F22 threshold is blocked although M3 can store it",()=>{
 const result=assessDraftPublicationStructure([{id:"active",status:"active"}],[{...valid,rir_target:8}]);
 assert.equal(result.publicationReady,false);
});
test("a non-positive rest blocks publishing",()=>{
 assert.equal(assessDraftPublicationStructure([{id:"active",status:"active"}],[{...valid,rest_seconds:0}]).publicationReady,false);
});
