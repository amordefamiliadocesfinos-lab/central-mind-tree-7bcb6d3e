#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),ts=require("typescript");
const read=p=>fs.readFileSync(p,"utf8");
const atlas=read("src/components/nucleo/NucleoOperationalAtlas.tsx");
const fm=read("src/components/nucleo/NucleoModuleKnowledge.tsx");
const ac01=read("src/components/nucleo/NucleoSpecialistContributions.tsx");
for(const [name,source] of [["Atlas",atlas],["FM",fm],["AC01",ac01]]){
 const result=ts.transpileModule(source,{fileName:name+".tsx",compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
 assert.equal(result.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0,name+" syntax");
}
for(const stage of ["vincular","versoes","refinar","vigencia","historico"]){
 assert(fm.includes('onOpenAc01Stage("'+stage+'")'),"FM route absent: "+stage);
 assert(ac01.includes('id:"'+stage+'"'),"Existing AC01 stage absent: "+stage);
}
assert(fm.includes("disabled={saving}"),"Do not navigate during FM write");
assert(atlas.includes("if(fmDraftState.busy||specialistDraftState.busy)"),"Block navigation on ambiguous write");
assert(atlas.includes('openSpecialistPanel("documentos")'),"Reuse existing specialist panel");
assert(atlas.includes('selectModuleArea("especialista")'),"Navigate within existing Atlas");
assert(atlas.includes("setAc01Request(previous=>"),"Repeated click must work");
assert(atlas.includes("requestedStage={ac01Request}"),"Deliver AC01 target request");
assert(atlas.includes("onOpenAc01Stage={openAc01FromFm}"),"Deliver FM navigation callback");
assert(ac01.includes("setFlowStep(step.id);setArea(step.area);"),"AC01 should select existing workflow step");
assert(ac01.includes("if(step.tab)setGovernanceTarget"),"Governance tabs must retain existing selection contract");
assert(!/\.insert\(|\.upsert\(|\.delete\(|\.rpc\(/.test(atlas.slice(atlas.indexOf("const openAc01FromFm="),atlas.indexOf("const openCrmStage"))),"Navigating cannot write to Core");
console.log("FM to AC01: five existing stages, preserved drafts, no automatic writers or authority.");
