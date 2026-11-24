import test from "node:test";
import assert from "node:assert/strict";
import {validateG5FEnvironment, PRODUCTION_PROJECT_ID, PRODUCTION_HOST} from "./health-cch-f24-g5f-preflight.mjs";

const candidate = {isolated:"true",projectId:"11111111-2222-4333-8444-555555555555",targetUrl:"https://g5f-homologacao.lovable.app",hasExplicitApproval:"true"};
test("G5-F rejects missing authorization, not merely different hostname",()=>{
 assert.equal(validateG5FEnvironment({...candidate,hasExplicitApproval:"false"}).ok,false);
 assert.equal(validateG5FEnvironment({...candidate,isolated:"false"}).ok,false);
});
test("G5-F rejects official project and host independently",()=>{
 assert.equal(validateG5FEnvironment({...candidate,projectId:PRODUCTION_PROJECT_ID}).ok,false);
 assert.equal(validateG5FEnvironment({...candidate,targetUrl:"https://"+PRODUCTION_HOST}).ok,false);
 assert.equal(validateG5FEnvironment({...candidate,targetUrl:"https://"+PRODUCTION_HOST+"/saude"}).ok,false);
});
test("G5-F rejects invalid or credential-bearing urls",()=>{
 for(const targetUrl of ["javascript:alert(1)","http://g5f-homologacao.lovable.app",
 "https://name:password@g5f-homologacao.lovable.app",
 "https://g5f-homologacao.lovable.app?token=abc", "https://example.com"]) {
   assert.equal(validateG5FEnvironment({...candidate,targetUrl}).ok,false,targetUrl);
 }
});
test("G5-F accepts a syntactically separate approved candidate but never calls it authenticated proof",()=>{
 const r=validateG5FEnvironment(candidate);
 assert.equal(r.ok,true);
 assert.equal(r.mode,"STATIC_PREFLIGHT_ONLY");
 assert.match(r.note,/does not certify/);
});
