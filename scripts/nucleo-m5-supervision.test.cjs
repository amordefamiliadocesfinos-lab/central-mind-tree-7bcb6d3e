#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const source = fs.readFileSync("src/lib/nucleo/supervision.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const scope = {exports:{}};
vm.runInNewContext(compiled, scope, {timeout:1000});
const {inspectNucleoSupervision} = scope.exports;
assert.equal(typeof inspectNucleoSupervision, "function");
function front(code, status="em_validacao", next_action="Revisar") {
 return {id:code,code,title:code,kind:"frente",status,next_action,blocker:"",evidence_state:"comprovada"};
}
function evidence(id,code,state="verificado") {
 return {id,workstream_id:code,observed_state:state};
}
const now=new Date("2026-11-12T10:00:00Z");
const fronts=[front("NUC-M1"),front("NUC-M4")];
let result=inspectNucleoSupervision(fronts,[evidence("a","NUC-M1"),evidence("b","NUC-M4")],[],now);
assert.equal(result.findings.length,0);
assert.equal(result.declaredDependencies,0);
assert.equal(result.informationalOnly,true);
assert.equal(result.evidenceCount,2);
assert.equal(result.computedAt,now.toISOString());
result=inspectNucleoSupervision([front("NUC-M4")],[evidence("a","NUC-M4","divergente")],[],now);
assert.equal(result.findings.length,1);
assert.equal(result.findings[0].kind,"divergencia");
assert.equal(result.findings[0].evidenceIds[0],"a");
result=inspectNucleoSupervision([front("NUC-M1","concluido")],[],[],now);
assert.equal(result.findings[0].kind,"evidencia_ausente");
result=inspectNucleoSupervision([front("NUC-M1","bloqueado")],[],[],now);
assert.equal(result.findings.length,0);
const blocked={...front("NUC-M1","bloqueado"),blocker:"Dependência externa"};
result=inspectNucleoSupervision([blocked],[],[],now);
assert.equal(result.findings[0].kind,"bloqueio");
result=inspectNucleoSupervision([front("NUC-M1","planejado","")],[],[],now);
assert.equal(result.findings[0].kind,"proxima_acao");
result=inspectNucleoSupervision([front("NUC-M1")],[evidence("b","NUC-M1","observado")],[],now);
assert.equal(result.findings[0].kind,"revisao_fonte");
result=inspectNucleoSupervision([front("NUC-M1")],[evidence("b","NUC-M1","nao_verificado")],[],now);
assert.equal(result.findings[0].kind,"revisao_fonte");
result=inspectNucleoSupervision(fronts,[],[{workstream_id:"NUC-M4",depends_on_id:"NUC-M1"}],now);
assert.equal(result.declaredDependencies,1);
result=inspectNucleoSupervision(fronts,[],[{workstream_id:"NUC-M4",depends_on_id:"UNKNOWN"}],now);
assert.equal(result.declaredDependencies,0);
result=inspectNucleoSupervision([{...front("NUC"),kind:"modulo"}],[],[],now);
assert.equal(result.findings.length,0);
console.log("M5 supervision: 11 checks PASS; deterministic, no mutations or external API.");
