#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),ts=require("typescript");
const file="src/lib/nucleo/ac01PendingReviewGuidanceV13.ts";
const js=ts.transpileModule(fs.readFileSync(file,"utf8"),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(js.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
const mod={exports:{}};new Function("module","exports",js.outputText)(mod,mod.exports);
const items=mod.exports.preparePendingReviewGuidance([
 "historico_incompleto","decisao_pendente","origem_sem_fm",
 "divergencia_de_origem","publicacao_sem_decisao_no_recorte","sem_decisao_aprovada",
 "decisao_pendente",
]);
assert.equal(items.length,6);
assert(items.every(x=>x.resolved===false));
assert(items.every(x=>["comentario","solicitar_refinamento"].includes(x.action)));
assert.equal(items.find(x=>x.issue==="decisao_pendente").action,"comentario");
const desk=fs.readFileSync("src/components/nucleo/NucleoContributionDesk.tsx","utf8");
const parent=fs.readFileSync("src/components/nucleo/NucleoSpecialistContributions.tsx","utf8");
const governance=fs.readFileSync("src/components/nucleo/NucleoAC01DocumentGovernance.tsx","utf8");
assert(desk.includes('requestedReview?.contributionId===selected.id'),"Only selected contribution receives guidance");
assert(desk.includes('setSelectedId(requestedReview.contributionId)'),"Targeted navigation required");
assert(desk.includes('setState("todas");setQuery("")'),"Visible selected record despite filters");
assert(desk.includes('Nenhuma pendência é encerrada por este atalho'));
assert(desk.includes('<NucleoAC01ReviewTrail key={selected.id}'),"Reuse existing writer");
assert(parent.includes('setRequestedReview(previous=>({contributionId,issues,seq:'));
assert(parent.includes('setArea("fila")'),"Navigate into existing specialist area");
assert(parent.includes('onOpenPendingReview={openPendingReview}'));
assert(parent.includes('requestedReview={requestedReview}'));
assert(governance.includes('onOpenPendingReview(item.contributionId,item.issues)'),"Use actual queue record IDs");
assert(governance.includes('Abrir ações de revisão existentes'));
assert(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/.test(fs.readFileSync(file,"utf8")));
for(const [name,source] of [["desk",desk],["parent",parent],["gov",governance]]){
 const compiled=ts.transpileModule(source,{fileName:name+".tsx",compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
 assert.equal(compiled.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0,name+" syntax");
}
console.log("AC-01: pendencias lead to existing revision writer, no approval or implied resolution.");
