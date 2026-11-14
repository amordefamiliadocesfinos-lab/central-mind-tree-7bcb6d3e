#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript"),assert=require("node:assert/strict");
function load(file,req){
 const js=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const ctx={exports:{},require:req,Date,Object,Map,Set,Number,RegExp};
 vm.runInNewContext(js,ctx,{timeout:1500});return ctx.exports;
}
const summary=load("supabase/functions/_shared/nucleo/ac02-continuity-summary.ts",()=>{throw Error("unexpected import")});
const id1="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",id2="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const eid="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const fronts=[{id:id1,code:"CRM-01",status:"em_andamento"},{id:id2,code:"CRM-02",status:"bloqueado"}];
const ev=[{id:eid,workstreamId:id1,kind:"workflow_run",observedState:"relatado"}];
const s=summary.summarizeAc02Continuity(fronts,ev,"completa");
assert.equal(s.counts.em_andamento,1);assert.equal(s.counts.bloqueado,1);
assert.equal(s.frontsWithEvidence,1);assert.equal(s.frontsWithoutEvidence,1);
assert.equal(s.nextCandidates[0].code,"CRM-02");
assert.ok(s.nextCandidates.every(x=>!x.reason.includes("homologado")));
assert.equal(s.completeness,"recorte_consultivo");
const partial=summary.summarizeAc02Continuity(fronts,ev,"indeterminada");
assert.equal(partial.completeness,"recorte_incompleto");
const registry=load("supabase/functions/_shared/nucleo/ac02-registry-contract.ts",()=>{throw Error("unexpected registry import")});
const documents=load("supabase/functions/_shared/nucleo/ac02-documentary-coverage.ts",()=>{throw Error("unexpected import")});
const guide=load("supabase/functions/_shared/nucleo/ac02-assumption-guide.ts",()=>{throw Error("no import")});
const exporter=load("supabase/functions/_shared/nucleo/ac02-assumption-export.ts",name=>{
 if(name==="./ac02-registry-contract.ts")return registry;
 if(name==="./ac02-continuity-summary.ts")return summary;
 if(name==="./ac02-documentary-coverage.ts")return documents;
 if(name==="./ac02-assumption-guide.ts")return guide;
 throw Error("unexpected import "+name);
});
const draft=exporter.composeAc02AssumptionExport({
 projection:registry.buildAc02Registry([],"2026-11-14T19:00:00Z"),
 specialist:{moduleId:id1,moduleCode:"CRM",methodRef:null,ecosystemRef:null,scopeRef:null,checkpointRef:null,specialistRole:"secret=value",sourceRefs:["token=hidden"],checkedAt:null,access:"nao_verificado"},
 moduleTitle:"secret=value",preparedAt:"2026-11-14T19:00:00Z",
 technical:{fronts,evidence:ev,evidenceRead:"completa"},
});
assert.match(draft.text,/Síntese operacional da continuidade/);
assert.match(draft.text,/Em andamento: 1/);
assert.match(draft.text,/CRM-02/);
assert.ok(!draft.text.includes("secret=value")&&!draft.text.includes("token=hidden"));
assert.ok(draft.text.includes("não ordens de execução"));
console.log("PASS AC02 macro continuity summary: status counts, source caveats, no invented next action");
