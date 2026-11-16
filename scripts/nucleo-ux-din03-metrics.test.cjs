#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),ts=require("typescript");
const pure=fs.readFileSync("src/lib/nucleo/progressMetricsV30.ts","utf8");
const js=ts.transpileModule(pure,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleRef={exports:{}};
new Function("module","exports",js)(moduleRef,moduleRef.exports);
const {factualFraction,operationalMetrics}=moduleRef.exports;
assert.deepEqual(factualFraction(0,0),{numerator:0,denominator:0,percent:null});
assert.equal(factualFraction(0,7).percent,0);
assert.equal(factualFraction(1,3).percent,33);
assert.equal(factualFraction(2,3).percent,67);
assert.equal(factualFraction(7,7).percent,100);
assert.equal(factualFraction(8,7).percent,null);
assert.equal(factualFraction(-1,7).percent,null);
assert.equal(factualFraction(1.3,7).percent,null);
const records=[
 {code:"NUC",kind:"modulo",status:"concluido",next_action:"",evidence_state:"comprovada"},
 {code:"CRM",kind:"modulo",status:"concluido",next_action:"",evidence_state:"comprovada"},
 {code:"CRM-F1",kind:"frente",status:"concluido",next_action:"Revisar",evidence_state:"comprovada"},
 {code:"CRM-F2",kind:"frente",status:"bloqueado",next_action:"",evidence_state:"relatada"},
 {code:"CRM-F2.1",kind:"subfrente",status:"em_validacao",next_action:"Validar",evidence_state:"sem_evidencia"}
];
const m=operationalMetrics(records);
assert.equal(m.total,3,"Do not count governance roots or modules");
assert.deepEqual(m.nextAction,{numerator:2,denominator:3,percent:67});
assert.deepEqual(m.completedDeclared,{numerator:1,denominator:3,percent:33});
assert.deepEqual(m.evidenceDeclaredM3,{numerator:1,denominator:3,percent:33});
assert.equal(operationalMetrics(records.slice(0,2)).nextAction.percent,null,"0/0 must not display a fictitious 0%");
const ui=fs.readFileSync("src/components/nucleo/NucleoPanoramaDinV30.tsx","utf8");
for(const token of [
 'NucleoFractionBar','Cobertura dos registros M3','showCoverage',
 'Com próxima ação registrada','Frentes concluídas declaradas',
 'Evidência declarada como comprovada no M3','Não representa evidência técnica M4 examinada',
 'factualFraction(n,total).percent','role="img"','não mensurável',
 'factualFraction(n,group.records.length).percent'
])assert(ui.includes(token),"Missing visible truth/coverage: "+token);
console.log("UX-DIN-03: factual percentages, zero denominator, M3-only coverage and visual labels PASS");
