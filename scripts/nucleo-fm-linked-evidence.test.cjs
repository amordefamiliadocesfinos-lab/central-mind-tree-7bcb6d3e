#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),ts=require("typescript");
const contract=fs.readFileSync("src/lib/nucleo/fmLinkedEvidenceV13.ts","utf8");
const ui=fs.readFileSync("src/components/nucleo/NucleoModuleKnowledge.tsx","utf8");
const js=ts.transpileModule(contract,{fileName:"fmLinkedEvidenceV13.ts",compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(js.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
for(const source of ["MODULE_SCREENS_V12","MODULE_CONTROLS_V12","MODULE_JOURNEYS_V12","MODULE_ORIGINAL_SOURCES_V12","MODULE_PROVENANCE"]){
 assert(contract.includes(source),"Missing existing authoritative catalog "+source);
}
for(const section of ["FM-04","FM-05","FM-06","FM-07","FM-08"])
 assert(contract.includes('case "'+section+'":'),"FM linked evidence missing "+section);
assert(contract.includes("if(!screen)return []"),"Guide step must have a real catalogued screen");
assert(contract.includes('controls.find(item=>item.label===step.controlLabel)'),"Control link must exactly match known label");
assert(contract.includes("item.archive+\" / \"+item.originalFile"),"Keep original document as reference only");
assert(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/.test(contract),"No new persistence or authority mutation");
assert(ui.includes("fmLinkedEvidence(moduleCode,section)"),"FM must derive read-only links from current module and section");
assert(ui.includes("item.evidence"),"FM must distinguish provenances");
assert(ui.includes("não é link público"),"Private archive must never become inferred public hyperlink");
assert(ui.includes("Estes vínculos NÃO são revisão FM gravada"),"Do not elevate references to persisted or homologated manuals");
console.log("FM V1.3: read-only evidence linked to existing catalogs across modules, no false provenance");
