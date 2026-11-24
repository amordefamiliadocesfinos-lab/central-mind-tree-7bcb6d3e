#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript"),assert=require("node:assert/strict");
function load(path,requireFn){
 const js=ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const ctx={exports:{},require:requireFn,Date,Object,Number,Set,Map,Error};
 vm.runInNewContext(js,ctx,{timeout:1500});return ctx.exports;
}
const gap=load("supabase/functions/_shared/nucleo/ac02-knowledge-gaps.ts",()=>{throw Error("import")});
const guide={kind:"nucleo_ac02_roteiro_assuncao_consultivo",moduleCode:"CRM",steps:[],caveats:[]};
const x=gap.inventoryAc02KnowledgeGaps("CRM",null,null,guide);
assert.equal(x.gaps.length,8);
assert.equal(x.summary.documental,3);
assert.equal(x.summary.operacional,2);
assert.equal(x.summary.governanca,2);
assert.equal(x.summary.implantacao,1);
assert.equal(x.gaps[0].state,"recorte_indeterminado");
assert.equal(x.gaps[7].state,"fase_adiada");
assert.equal(x.caveat,"lacunas_do_recorte_nao_ausencia_global");
const coverage={entries:[
 {sectionCode:"FM-03",status:"referencia_core_declarada",sourceReference:"presente_na_revisao"},
 {sectionCode:"FM-08",status:"referencia_core_declarada",sourceReference:"ausente"},
 {sectionCode:"FM-09",status:"referencia_core_declarada",sourceReference:"presente_na_revisao"},
],warnings:["FM-08: uma única seção não comprova documentos distintos"]};
const continuity={completeness:"recorte_consultivo",frontsWithEvidence:1,frontsWithoutEvidence:0};
const y=gap.inventoryAc02KnowledgeGaps("CRM",coverage,continuity,guide);
assert.equal(y.gaps[0].state,"referencia_presente_consulta_pendente");
assert.equal(y.gaps[4].state,"referencia_inexistente_no_recorte");
assert.equal(y.gaps[3].state,"referencia_presente_consulta_pendente");
assert.ok(y.gaps.every(g=>!JSON.stringify(g).includes("private=secret")));
const z=gap.inventoryAc02KnowledgeGaps("CRM",{...coverage,warnings:["Leitura de revisões não comprovadamente completa"]},continuity,guide);
assert.equal(z.gaps[0].state,"recorte_indeterminado");
assert.throws(()=>gap.inventoryAc02KnowledgeGaps("CRM",coverage,continuity,{...guide,moduleCode:"FIN"}));
assert.throws(()=>gap.inventoryAc02KnowledgeGaps("CRM\nBAD",coverage,continuity,guide));
// A complete empty FM read must never imply that source references exist.
const empty={entries:["FM-03","FM-08","FM-09"].map(sectionCode=>({sectionCode,status:"sem_registro",sourceReference:"nao_verificada"})),warnings:[]};
assert.equal(gap.inventoryAc02KnowledgeGaps("CRM",empty,continuity,guide).gaps[4].state,"referencia_inexistente_no_recorte");
assert.equal(gap.inventoryAc02KnowledgeGaps("CRM",{...empty,warnings:["Leitura de revisões não comprovadamente completa"]},continuity,guide).gaps[4].state,"recorte_indeterminado");
const allPresent={...coverage,entries:coverage.entries.map(r=>({...r,sourceReference:"presente_na_revisao"}))};
assert.equal(gap.inventoryAc02KnowledgeGaps("CRM",allPresent,continuity,guide).gaps[4].state,"referencia_presente_consulta_pendente");
const exporter=fs.readFileSync("supabase/functions/_shared/nucleo/ac02-assumption-export.ts","utf8");
assert.ok(exporter.includes("inventoryAc02KnowledgeGaps(code,coverage,continuity,guide)"));
assert.ok(exporter.includes("Inventário de lacunas de conhecimento (consultivo)"));
const view=gap.summarizeAc02DocumentaryReadiness(y);
assert.equal(view.coverage.referencias_presentes_para_consulta,4);
assert.equal(view.coverage.referencias_ausentes_no_recorte,1);
assert.equal(view.coverage.recortes_indeterminados,0);
assert.equal(view.coverage.comprovacoes_externas_pendentes,2);
assert.equal(view.coverage.fases_adiadas,1);
assert.equal(view.readyForOperationalAssumption,false);
assert.equal(view.reviewOrder.includes("G08_SEGURANCA_IMPLANTACAO"),false);
assert.equal(view.categories.length,4);
assert.equal(view.disclaimer,"referencia_documental_nao_equivale_a_prontidao_operacional");
const partialView=gap.summarizeAc02DocumentaryReadiness(x);
assert.equal(partialView.coverage.recortes_indeterminados,5);
assert.equal(partialView.coverage.fases_adiadas,1);
assert.throws(()=>gap.summarizeAc02DocumentaryReadiness({...y,gaps:[...y.gaps,y.gaps[0]]}));
assert.throws(()=>gap.summarizeAc02DocumentaryReadiness({...y,gaps:y.gaps.slice(0,7)}));
assert.ok(exporter.includes("summarizeAc02DocumentaryReadiness(gaps)"));
assert.ok(exporter.includes("Visão de prontidão documental — somente leitura"));
console.log("PASS AC02 readiness: 8 fixed sources, consultative classification, no approval or deferred execution");
