#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const {rank,isNucleoLabel}=require("./nucleo-m4-prioritize-review.cjs");
const ROOT="amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e";
const base={schema_version:"nucleo-m4-discovery-v1",repository:ROOT,checked_at:"2026-11-12T13:00:00Z",
  read_only:true,automatic_core_write:false};
const rec=(kind,key,title,status,known=false)=>({
  kind,external_key:String(key),title,source:"github",
  reference_url:"https://github.com/"+ROOT+"/"+(kind==="pull_request"?"pull/":"actions/runs/")+key,
  source_status:status,classification:known?"known_source":"unassigned_candidate",
  existing_explicit_mapping:known?"NUC-M4":null,
});
const records=[
  rec("pull_request",650,"Núcleo M4 — evolução","merged"),
  rec("workflow_run",900,"Nucleo M4 — CI","success"),
  rec("pull_request",651,"Núcleo M3 — análise","open"),
  rec("workflow_run",901,"Nucleo M3 — CI","failure"),
  rec("pull_request",652,"CRM — correção","merged"),
  rec("pull_request",636,"Núcleo M4 — já integrado","merged",true),
  rec("pull_request",649,"Núcleo M1 — já no Core","merged"),
];
const result=rank({...base,records},[{kind:"pull_request",source:"github",external_key:"649"}]);
assert.deepEqual(result.counts,{total:7,review_priority:2,pending_or_failed:2,already_known:2,outside_priority:1});
assert.equal(result.items[0].priority,2);
assert.ok(result.items.every(r=>r.proposed_workstream_code===null&&r.core_write_allowed===false&&r.approval===null));
assert.equal(result.items.find(x=>x.external_key==="652").queue,"fora_da_triagem_prioritaria");
assert.equal(result.items.find(x=>x.external_key==="651").queue,"revisao_de_pendencia_ou_falha");
assert.equal(result.items.find(x=>x.external_key==="649").queue,"ja_conhecida");
assert.ok(isNucleoLabel("Núcleo 2.0"));
assert.ok(!isNucleoLabel("Nuclear"));
assert.throws(()=>rank({...base,read_only:false,records},[]),/Invalid/);
assert.throws(()=>rank({...base,records:[records[0],records[0]]},[]),/Duplicate/);
assert.throws(()=>rank({...base,records:[{...records[0],external_key:"bad"}]},[]),/Invalid discovery candidate/);
console.log("M4 priority review: 11 checks PASS; all proposals remain unassigned/read-only.");
