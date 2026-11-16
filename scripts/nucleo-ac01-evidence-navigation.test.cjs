#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),ts=require("typescript");
const root="src/components/nucleo/";
const parent=fs.readFileSync(root+"NucleoSpecialistContributions.tsx","utf8");
const desk=fs.readFileSync(root+"NucleoContributionDesk.tsx","utf8");
const gov=fs.readFileSync(root+"NucleoAC01DocumentGovernance.tsx","utf8");
assert(parent.includes("const openCycleEvidence=(contributionId:string)=>{"));
assert(parent.includes('if(saving||uncertainRef.current||reading||readError)return;'));
assert(parent.includes('rows.some(item=>item.id===contributionId&&item.module_id===moduleId)'));
assert(parent.includes('setFocusedCycleContribution({contributionId,seq:++targetCounter.current})'));
assert(parent.includes('setArea("ciclo");setFlowStep("decidir")'));
assert(parent.includes('requestedContribution={focusedCycleContribution}'));
assert(parent.includes('onOpenCycleEvidence={openCycleEvidence}'));
assert(parent.includes('onOpenPendingReview={openPendingReview}'));
assert(parent.includes('requestedReview={requestedReview}'));
assert(parent.includes('setArea("fila");setFlowStep("refinar")'));
assert(parent.includes('setFocusedCycleContribution(null)'),"Reset focus on module change");
assert(desk.includes('onOpenCycleEvidence(selected.id)'));
assert(desk.includes("Examinar provas e pendências no ciclo AC-01"));
assert(desk.includes('<NucleoAC01ReviewTrail key={selected.id}'));
assert(gov.includes('requestedContribution?:{contributionId:string;seq:number}|null;'));
assert(gov.includes('contributions.some(c=>c.module_id===moduleId&&c.id===requestedContribution.contributionId)'));
assert(gov.includes('setSelectedId(requestedContribution.contributionId)'));
assert(gov.includes('setTab("decisao");setReviewHistoryOpen(false)'));
assert(gov.includes('setQuery("");setCategory("todas");setTargetId("")'));
assert(gov.includes('id="nucleo-ac01-selected-evidence"'));
assert(gov.includes('onOpenPendingReview(item.contributionId,item.issues)'));
assert(!/\.insert\(|\.upsert\(|\.rpc\(/.test(""+
 parent.slice(parent.indexOf("const openCycleEvidence="),parent.indexOf("const goToFlow="))+
 desk.slice(desk.indexOf("onOpenCycleEvidence&&<Button"),desk.indexOf("onOpenCycleEvidence(selected.id)")+45)+
 gov.slice(gov.indexOf("requestedContribution)return"),gov.indexOf("requestedContribution,moduleId,contributions]"))),
 "Navigation has no writes");
for(const [name,s] of [["parent",parent],["desk",desk],["gov",gov]]){
 const out=ts.transpileModule(s,{fileName:name+".tsx",compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
 assert.equal(out.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0,name+" parse");
}
console.log("AC-01 focus navigation: same contribution across tabs, no authority or writes.");
