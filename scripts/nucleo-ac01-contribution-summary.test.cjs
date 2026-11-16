#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),ts=require("typescript");
function load(path,resolve=()=>({})){
 const result=ts.transpileModule(fs.readFileSync(path,"utf8"),{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
 assert.equal(result.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0);
 const module={exports:{}};new Function("module","exports","require",result.outputText)(module,module.exports,resolve);return module.exports;
}
const match=load("src/lib/nucleo/ac01FmSourceMatchV13.ts");
const compare=load("src/lib/nucleo/ac01AssistedComparisonV13.ts",()=>match);
const lineage=load("src/lib/nucleo/ac01FmLineageV13.ts",()=>match);
const criteria=load("src/lib/nucleo/ac01ReviewCriteriaV13.ts",name=>name.includes("Comparison")?compare:lineage);
const summary=load("src/lib/nucleo/ac01ContributionSummaryV13.ts",name=>name.includes("ReviewCriteria")?criteria:name.includes("FmLineage")?lineage:match).summarizeAc01ContributionV13;
const c={id:"c",module_id:"crm",lineage_id:"l",version_no:1,parent_revision_id:null,title:"Método",source_kind:"github",source_locator:"docs/manual",specialist_role:"CRM",contribution_kind:"metodo",authority_state:"proposta",recorded_at:"2026-11-16"};
const request={id:"r",contribution_id:"c",requested_outcome:"avaliar_aprovacao",recorded_at:"2026-11-16"};
const decision={id:"d",contribution_id:"c",decision_request_id:"r",outcome:"aprovada",recorded_at:"2026-11-16"};
const publication={id:"p",contribution_id:"c",decision_act_id:"d",recorded_at:"2026-11-16"};
const fm={id:"f",module_id:"crm",section_code:"FM-01",version_no:1,source_reference:"docs/manual",authority_state:"rascunho",title:"Ficha"};
let a=summary(c,[c,{...c,id:"x",module_id:"other",lineage_id:"l"}],[request],[decision],[publication],fm);
assert.equal(a.visibleVersions,1);assert.equal(a.requestCount,1);assert.equal(a.decisionCount,1);
assert.equal(a.internalPublicationCount,1);
assert.equal(a.locatorMatch,"localizador_identico");
assert.equal(a.authorityCertified,false);assert.equal(a.readyToPublish,false);
assert.equal(a.externalPublicationVerified,false);assert.equal(a.issueResolutionVerified,false);
a=summary(c,[c],[request],[{...decision,decision_request_id:"foreign"}],[publication],{...fm,module_id:"other"});
assert.equal(a.decisionCount,0);assert.equal(a.internalPublicationCount,0);assert.equal(a.validFmTarget,false);
assert.equal(a.pendingReviewCount>0,true);
a=summary(c,[c],[],[],[],null);
assert.equal(a.requestCount,0);assert.equal(a.decisionCount,0);assert.equal(a.internalPublicationCount,0);
assert.equal(a.readyToPublish,false);
const ui=fs.readFileSync("src/components/nucleo/NucleoAC01DocumentGovernance.tsx","utf8");
assert(ui.includes("summarizeAc01ContributionV13(selected,contributions,reqs,decisions,publications,selectedFM)"));
assert(ui.includes("Estado documental consolidado da contribuição selecionada"));
assert(ui.includes("pendências não encerradas"));
assert(ui.includes("!loading&&!error&&<>"));
assert(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/.test(fs.readFileSync("src/lib/nucleo/ac01ContributionSummaryV13.ts","utf8")));
console.log("AC01 summary: counts scoped to selected contribution and existing IDs, no false authority.");
