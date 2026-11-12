#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const {groupRuns}=require("./nucleo-m4-group-ci-review.cjs");
const source={schema_version:"nucleo-m4-prioritized-review-v1",read_only:true,
  automatic_core_write:false,source_checked_at:"2026-11-12T15:19:00Z",
  items:[
    {kind:"workflow_run",external_key:"101",source_title:"Nucleo M4 - CI",
     source_status:"success",queue:"revisao_prioritaria",reference_url:"https://github.com/org/repo/actions/runs/101"},
    {kind:"workflow_run",external_key:"102",source_title:"Nucleo M4 - CI",
     source_status:"success",queue:"revisao_prioritaria",reference_url:"https://github.com/org/repo/actions/runs/102"},
    {kind:"workflow_run",external_key:"103",source_title:"Nucleo M3 - CI",
     source_status:"success",queue:"revisao_prioritaria",reference_url:"https://github.com/org/repo/actions/runs/103"},
    {kind:"workflow_run",external_key:"104",source_title:"Nucleo M3 - CI",
     source_status:"failure",queue:"revisao_de_pendencia_ou_falha",reference_url:"https://github.com/org/repo/actions/runs/104"},
    {kind:"pull_request",external_key:"200",source_title:"Núcleo M4 - PR",
     source_status:"merged",queue:"revisao_prioritaria",reference_url:"https://github.com/org/repo/pull/200"},
  ]};
const r=groupRuns(source,[{source:"github",kind:"workflow_run",external_key:"101"}]);
assert.deepEqual(r.counts,{workflows:2,runs:3,known_in_core:1,representative_candidates:2});
assert.equal(r.groups.find(g=>g.workflow==="Nucleo M4 - CI").representative_id,"102");
assert.deepEqual(r.groups.find(g=>g.workflow==="Nucleo M4 - CI").all_run_ids,["102","101"]);
assert.ok(r.groups.every(g=>g.proposed_workstream_code===null&&g.core_write_allowed===false));
assert.throws(()=>groupRuns({...source,read_only:false},[]),/Invalid input/);
assert.throws(()=>groupRuns({...source,items:[...source.items,source.items[0]]},[]),/Duplicate workflow run ID/);
assert.throws(()=>groupRuns({...source,items:[{...source.items[0],source_status:"failure"}]},[]),/Invalid CI source/);
console.log("M4 group CI: 7 checks PASS; no loss of run IDs or Core writes.");
