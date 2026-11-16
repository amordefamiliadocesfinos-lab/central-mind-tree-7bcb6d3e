#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),ts=require("typescript");
function load(p,dependency=()=>({})){
 const src=fs.readFileSync(p,"utf8");
 const out=ts.transpileModule(src,{fileName:p,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
 assert.equal(out.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0);
 const mod={exports:{}};new Function("module","exports","require",out.outputText)(mod,mod.exports,dependency);return mod.exports;
}
const match=load("src/lib/nucleo/ac01FmSourceMatchV13.ts");
const comparison=load("src/lib/nucleo/ac01AssistedComparisonV13.ts",()=>match);
const lineage=load("src/lib/nucleo/ac01FmLineageV13.ts",()=>match);
const {deriveAc01ReviewCriteria:assess}=load("src/lib/nucleo/ac01ReviewCriteriaV13.ts",name=>
 name.includes("AssistedComparison")?comparison:lineage);
const c={id:"c",module_id:"CRM",lineage_id:"L",version_no:1,parent_revision_id:null,
 title:"Método",source_locator:"docs/metodo.md",source_kind:"github",
 authority_state:"proposta",specialist_role:"CRM",contribution_kind:"metodo"};
const target={id:"f",module_id:"CRM",section_code:"FM-08",version_no:1,title:"FM",
 authority_state:"rascunho",source_reference:"docs/metodo.md"};
let result=assess(c,[c],[],[],[],null);
assert.equal(result.criteria.length,6);
assert.equal(result.pendingCount,5);
assert.equal(result.canPublish,false);
assert.equal(result.requiresHumanReview,true);
assert(result.criteria.find(x=>x.code==="alvo")?.result==="pendente");
assert(result.criteria.find(x=>x.code==="origem")?.result==="pendente");
assert(result.criteria.find(x=>x.code==="comparacao")?.result==="pendente");
assert(result.criteria.find(x=>x.code==="publicacao")?.result==="pendente");
const req={id:"r",contribution_id:"c",requested_outcome:"aprovar",recorded_at:"2026-11-16"};
const dec={id:"d",contribution_id:"c",decision_request_id:"r",outcome:"aprovada",recorded_at:"2026-11-16"};
const pub={id:"p",contribution_id:"c",decision_act_id:"d",recorded_at:"2026-11-16"};
result=assess(c,[c],[req],[dec],[pub],target);
assert.equal(result.criteria.find(x=>x.code==="alvo")?.result,"conferir");
assert.equal(result.criteria.find(x=>x.code==="solicitacoes")?.result,"registrado");
assert.equal(result.criteria.find(x=>x.code==="publicacao")?.result,"pendente");
assert.equal(result.canPublish,false);
const second={...target,module_id:"FIN"};
result=assess(c,[c],[req],[dec],[pub],second);
assert.equal(result.criteria.find(x=>x.code==="alvo")?.result,"pendente");
result=assess({...c,version_no:2,parent_revision_id:"absent"},[c],[],[],[],target);
assert.equal(result.criteria.find(x=>x.code==="cadeia")?.result,"pendente");
result=assess(c,[c],[req],[],[],target);
assert.equal(result.criteria.find(x=>x.code==="solicitacoes")?.result,"pendente");
const lib=fs.readFileSync("src/lib/nucleo/ac01ReviewCriteriaV13.ts","utf8");
assert(!/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/.test(lib));
const ui=fs.readFileSync("src/components/nucleo/NucleoAC01DocumentGovernance.tsx","utf8");
assert(ui.includes("deriveAc01ReviewCriteria(selected,contributions,reqs,decisions,publications,selectedFM)"));
assert(ui.includes("review.criteria.map("));
assert(ui.includes("Consolidação e publicação continuam bloqueadas"));
assert(ui.includes('preview.action'));
console.log("AC-01 V1.3: review criteria never certify sources, approve or enable canonical publication.");
