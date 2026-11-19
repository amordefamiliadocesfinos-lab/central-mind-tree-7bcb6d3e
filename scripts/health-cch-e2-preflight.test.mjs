import test from "node:test";
import assert from "node:assert/strict";
import {assessE2Preflight} from "../.tmp-cch-e2-preflight/e2Preflight.js";
const base={versionStatus:"published",activeVersionId:"v2",publishedVersionId:"v2",
 advisorSourceVersionId:"v2",advisorLoading:false,advisorError:null,
 advisorQuality:"reviewable",trainingLevel:"advanced"};
test("published version stays read-only even if evidence is reviewable",()=>{
 const x=assessE2Preflight(base);
 assert.equal(x.state,"published_read_only");
 assert.equal(x.canInspectDraft,false);
 assert.equal(x.publishedWriteProtected,true);
});
test("published with no source must not invent readiness",()=>{
 const x=assessE2Preflight({...base,advisorSourceVersionId:null});
 assert.equal(x.state,"published_read_only");
 assert.equal(x.sourceAligned,false);
 assert.ok(x.missingEvidence.some(s=>s.includes("Origem")));
});
test("draft with valid source remains manual review",()=>{
 const x=assessE2Preflight({...base,versionStatus:"draft",activeVersionId:"draft1"});
 assert.equal(x.state,"draft_review");
 assert.equal(x.canInspectDraft,true);
});
test("draft loading, partial evidence or mismatch is not progression",()=>{
 for(const x of [
  {...base,versionStatus:"draft",advisorLoading:true},
  {...base,versionStatus:"draft",advisorQuality:"partial"},
  {...base,versionStatus:"draft",advisorSourceVersionId:"other"},
 ])assert.equal(assessE2Preflight(x).state,"draft_evidence_pending");
});
test("advanced with missing records is not reclassified",()=>{
 const x=assessE2Preflight({...base,versionStatus:"draft",advisorQuality:"limited"});
 assert.equal(x.state,"draft_evidence_pending");
 assert.equal(x.canInspectDraft,true);
});
test("unavailable version does not imply a draft",()=>{
 assert.equal(assessE2Preflight({...base,activeVersionId:null,versionStatus:null}).state,"unavailable");
});
