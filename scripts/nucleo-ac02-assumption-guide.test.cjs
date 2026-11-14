#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript"),assert=require("node:assert/strict");
const load=(p,req)=>{
 const js=ts.transpileModule(fs.readFileSync(p,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const ctx={exports:{},require:req,Date,Set,Map,Object,Number,Error};vm.runInNewContext(js,ctx,{timeout:1500});return ctx.exports;
};
const guide=load("supabase/functions/_shared/nucleo/ac02-assumption-guide.ts",()=>{throw Error("no deps")});
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const coverage={kind:"nucleo_ac02_cobertura_documental_consultiva",entries:[
 {sectionCode:"FM-03",status:"referencia_core_declarada"},
 {sectionCode:"FM-08",status:"sem_registro"},
 {sectionCode:"FM-09",status:"referencia_core_declarada"},
 ],warnings:["FM-08: método/ecossistema sem revisão na leitura"],operationalCheckpointVerified:false,distinctMethodAndEcosystemVerified:false};
const continuity={kind:"nucleo_ac02_resumo_continuidade_consultivo",completeness:"recorte_incompleto",counts:{planejado:1,em_andamento:1,bloqueado:1,em_validacao:0,concluido:0},frontsWithEvidence:0,frontsWithoutEvidence:3,nextCandidates:[],warnings:["Recorte técnico parcial"]};
const g=guide.buildAc02AssumptionGuide("CRM",coverage,continuity,["Mandato não certificado"]);
assert.equal(g.steps.length,6);
assert.equal(g.steps[1].state,"referencia_disponivel");
assert.equal(g.steps[2].state,"consulta_necessaria");
assert.equal(g.steps[3].state,"referencia_disponivel");
assert.equal(g.steps[4].state,"recorte_incompleto");
assert.ok(g.steps[3].evidence.includes("não comprova"));
assert.ok(g.steps[5].action.includes("Camada Mestre"));
assert.equal(g.status,"nao_homologado");
const absent=guide.buildAc02AssumptionGuide("CRM",null,null,[]);
assert.equal(absent.steps[1].state,"consulta_necessaria");
assert.equal(absent.steps[4].state,"consulta_necessaria");
assert.throws(()=>guide.buildAc02AssumptionGuide("CRM\nEVIL",null,null,[]));
const exportedSource=fs.readFileSync("supabase/functions/_shared/nucleo/ac02-assumption-export.ts","utf8");
assert.ok(exportedSource.includes("buildAc02AssumptionGuide(code,coverage,continuity,unresolved)"));
assert.ok(exportedSource.includes("Roteiro de recuperação de contexto para o sucessor"));
console.log("PASS AC02 succession guide: 6 consultative steps, no operational checkpoint or mandate presumed");
