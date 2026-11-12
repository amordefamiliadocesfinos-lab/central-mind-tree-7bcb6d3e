#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const compiled = ts.transpileModule(
 fs.readFileSync("src/lib/nucleo/supervision-provenance.ts","utf8"),
 {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}
).outputText;
const sandbox={exports:{}};
vm.runInNewContext(compiled,sandbox,{timeout:1000});
const {safeNucleoSourceUrl,findNucleoFindingSources}=sandbox.exports;
const root="https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e";
const record=(id,key,kind="pull_request",url=root+"/pull/"+key)=>({
 id,source:"github",kind,external_key:key,title:"Evidência "+id,reference_url:url,
 checked_at:"2026-11-12T10:00:00Z",recorded_at:"2026-11-12T09:00:00Z"
});
let checked=0;
function check(name,fn){fn();checked++;console.log("PASS "+checked+" "+name)}
check("PR canônica",()=>assert.equal(safeNucleoSourceUrl(root+"/pull/655",record("x","655")),root+"/pull/655"));
check("CI canônica",()=>{const x=record("x","432", "workflow_run",root+"/actions/runs/432");
 assert.equal(safeNucleoSourceUrl(x.reference_url,x),x.reference_url)});
check("bloqueio de URL externa",()=>assert.equal(safeNucleoSourceUrl("https://evil.example/pull/655",record("x","655")),null));
check("bloqueio de query e fragmento",()=>assert.equal(safeNucleoSourceUrl(root+"/pull/655?bad=1",record("x","655")),null));
check("bloqueio de ID diferente",()=>assert.equal(safeNucleoSourceUrl(root+"/pull/656",record("x","655")),null));
check("bloqueio de hash não numérico",()=>assert.equal(safeNucleoSourceUrl(root+"/pull/not-id",record("x","not-id")),null));
check("fonte supabase não vira link GitHub",()=>assert.equal(safeNucleoSourceUrl(root+"/pull/655",{...record("x","655"),source:"supabase"}),null));
check("registro original preservado",()=>{
 const x=record("x","655");const before=JSON.stringify(x);
 const sources=findNucleoFindingSources({evidenceIds:["x"]},[x]);
 assert.equal(sources.length,1);assert.equal(sources[0].id,"x");
 assert.equal(sources[0].checkedAt,x.checked_at);assert.equal(JSON.stringify(x),before)
});
check("nenhum ID alheio é exposto",()=>{
 const sources=findNucleoFindingSources({evidenceIds:["x"]},[record("x","655"),record("y","656")]);
 assert.equal(sources.length,1);assert.equal(sources[0].externalKey,"655");
});
check("alerta sem fonte retorna array vazio",()=>{
 const sources=findNucleoFindingSources({evidenceIds:[]},[record("x","655")]);
 assert.equal(sources.length,0);
});
const component=fs.readFileSync("src/components/nucleo/NucleoSupervisionPanel.tsx","utf8");
check("validação de identidade e grant ativos",()=>{
 for(const token of ["client.auth.getUser()","app_admin_capabilities","nucleo_manage",
   'eq("auth_user_id", uid)','eq("active", true)','is("revoked_at", null)'])
  assert.ok(component.includes(token), "missing "+token);
});
check("revalidação por sessão e visibilidade",()=>{
 assert.ok(component.includes("onAuthStateChange"));
 assert.ok(component.includes("visibilitychange"));
 assert.ok(component.includes("setLoaded(false)"));
});
check("bloqueio em consulta parcial e separação da demo",()=>{
 assert.ok(component.includes("fronts.length < 500"));
 assert.ok(component.includes("(depCheck.data?.length ?? 500) < 500"));
 assert.ok(component.includes("evidence.length < MAX_EVIDENCE"));
 assert.ok(component.includes("buildM5DemoSnapshot(demoCase)"));
});
console.log("M5 V2: "+checked+" testes isolados de proveniência e contratos de sessão PASS.");
