#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const {reconcile}=require("./nucleo-m4-reconcile-review.cjs");
const root="https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/";
const base=[
  {workstream_code:"NUC-M4",source:"github",kind:"pull_request",external_key:"622",observed_state:"verificado",snapshot:{merged:true,merge_commit_sha:"a".repeat(40)}},
  {workstream_code:"NUC-M3",source:"github",kind:"workflow_run",external_key:"43103257248",observed_state:"verificado",snapshot:{conclusion:"success"}},
];
const row=(kind,key,code,state,sha)=>({
  workstream_code:code,source:"github",kind,external_key:key,reference_url:root+(kind==="pull_request"?"pull/":"actions/runs/")+key,
  source_status:state,source_sha:sha,verified_at_source:state==="merged"||state==="success",
});
const manifest=records=>({schema_version:"nucleo-m4-refresh-manifest-v1",read_only:true,
  requires_human_review:true,repository:"amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e",
  checked_at:"2026-11-12T12:00:00Z",records});
const pr=row("pull_request","622","NUC-M4","merged","a".repeat(40));
const ci=row("workflow_run","43103257248","NUC-M3","success","b".repeat(40));
const prNew=row("pull_request","626","NUC-M4","merged","c".repeat(40));
let result=reconcile(manifest([pr,ci,prNew]),base);
assert.deepEqual(result.counters,{existing:2,new:1,divergent:0,blocked:0});
assert.equal(result.requires_human_review,true);
assert.equal(result.read_only,true);
assert.equal(result.requires_stop,false);
assert.equal(result.proposals.find(p=>p.external_key==="626").classification,"new");

// Recorrência idempotente: adicionar a referência existente muda new -> existing.
result=reconcile(manifest([pr,ci,prNew]),[...base,{...prNew,observed_state:"verificado",snapshot:{merged:true,merge_sha:"c".repeat(40)}}]);
assert.deepEqual(result.counters,{existing:3,new:0,divergent:0,blocked:0});

// Divergência de SHA não pode ser sobrescrita silenciosamente.
const divergence=reconcile(manifest([{...pr,source_sha:"f".repeat(40)}]),base);
assert.equal(divergence.counters.divergent,1);
assert.equal(divergence.requires_stop,true);

// PR aberta ou CI falho nunca é classificada como nova evidência aprovada.
const blocked=reconcile(manifest([row("pull_request","999","NUC-M4","open",null)]),base);
assert.equal(blocked.counters.blocked,1);
assert.equal(blocked.requires_stop,true);

// Identidade repetida no manifesto.
assert.throws(()=>reconcile(manifest([pr,pr]),base),/Duplicate identity/);

// Vínculo fora do Núcleo.
assert.throws(()=>reconcile(manifest([{...prNew,workstream_code:"CRM"}]),base),/Unknown source mapping/);

// URL adulterada, inclusive query.
assert.throws(()=>reconcile(manifest([{...prNew,reference_url:"https://evil.example/"}]),base),/Invalid official URL/);
assert.throws(()=>reconcile(manifest([{...prNew,reference_url:prNew.reference_url+"?redirect=x"}]),base),/Invalid official URL/);

// Mesmo ID externo sob outra frente é bloqueado e jamais incluído como "new".
const crossed=reconcile(manifest([{...prNew,workstream_code:"NUC-M2"}]),
  [...base,{...prNew,observed_state:"verificado",snapshot:{merged:true,merge_commit_sha:"c".repeat(40)}}]);
assert.equal(crossed.counters.blocked,1);
assert.equal(crossed.requires_stop,true);

// Manifesto não confiável.
assert.throws(()=>reconcile({...manifest([pr]),read_only:false},base),/Untrusted manifest contract/);

// Ausência do estado atual não é evidência de duplicata.
assert.equal(reconcile(manifest([pr]),[]).counters.new,1);

console.log("M4 reconcile: 11 cenários sintéticos PASS; nenhuma escrita no Core.");
