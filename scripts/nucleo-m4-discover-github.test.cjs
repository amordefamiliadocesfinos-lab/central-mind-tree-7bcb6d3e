#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const {discover,strictUrl}=require("./nucleo-m4-discover-github.cjs");
const root="https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/";
const mk=(pr,run)=>async url=>{
  if(url.includes("/pulls?"))return {ok:true,json:async()=>pr};
  if(url.includes("/actions/runs?"))return {ok:true,json:async()=>({workflow_runs:run})};
  throw Error("Unexpected request "+url);
};
const pr=(id,title="PR")=>({number:id,title,state:"closed",html_url:root+"pull/"+id,merge_commit_sha:"a".repeat(40),updated_at:"2026-11-12T14:00:00Z"});
const run=id=>({id,name:"CI",status:"completed",conclusion:"success",html_url:root+"actions/runs/"+id,head_sha:"b".repeat(40)});
(async()=>{
  let out=await discover(mk([pr(608),pr(999)],[run(43115167528),run(99999999)]),"",{pageLimit:1});
  assert.deepEqual(out.counts,{total:4,known:2,unassigned:2});
  assert.equal(out.read_only,true);
  assert.equal(out.automatic_core_write,false);
  assert.ok(out.records.every(x=>x.proposed_workstream_code===null && x.requires_human_assignment));
  assert.equal(out.records.find(x=>x.external_key==="608").existing_explicit_mapping,"NUC-M1");
  assert.equal(out.records.find(x=>x.external_key==="999").classification,"unassigned_candidate");

  out=await discover(mk([],[]),"",{pageLimit:1});
  assert.equal(out.counts.total,0);

  await assert.rejects(()=>discover(mk([{...pr(999),html_url:"https://evil.example/pull/999"}],[]),"",{pageLimit:1}),/Invalid GitHub evidence URL/);
  await assert.rejects(()=>discover(mk([{...pr(999),html_url:root+"pull/999?redirect=1"}],[]),"",{pageLimit:1}),/Invalid GitHub evidence URL/);
  await assert.rejects(()=>discover(async()=>({ok:false,status:403}),"",{pageLimit:1}),/HTTP 403/);
  await assert.rejects(()=>discover(async url=>({ok:true,json:async()=>url.includes("/pulls?")?{}:{workflow_runs:[]}}),"",{pageLimit:1}),/listing must be an array/);
  await assert.rejects(()=>discover(mk([],[]),"",{pageLimit:4}),/Unsafe page limit/);
  await assert.rejects(()=>discover(mk([{...pr(1),number:"1"}],[]),"",{pageLimit:1}),/Invalid GitHub identity/);
  assert.throws(()=>strictUrl(root+"pull/608#x","pull_request",608),/Invalid GitHub evidence URL/);
  assert.throws(()=>strictUrl(root+"pull/609","pull_request",608),/Invalid GitHub evidence URL/);
  console.log("M4 discovery: 10 checks PASS; without assignment or Core writes.");
})().catch(err=>{console.error(err);process.exitCode=1;});
