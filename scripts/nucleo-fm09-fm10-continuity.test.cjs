#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),ts=require("typescript");
const read=p=>fs.readFileSync(p,"utf8");
const lib=read("src/lib/nucleo/fmContinuityV13.ts");
const links=read("src/lib/nucleo/fmLinkedEvidenceV13.ts");
const fm=read("src/components/nucleo/NucleoModuleKnowledge.tsx");
const atlas=read("src/components/nucleo/NucleoOperationalAtlas.tsx");
for(const [name,source,fileName] of [
 ["continuity",lib,"fmContinuityV13.ts"],
 ["linked sources",links,"fmLinkedEvidenceV13.ts"],
 ["FM component",fm,"NucleoModuleKnowledge.tsx"],
 ["Atlas",atlas,"NucleoOperationalAtlas.tsx"]
]){
 const x=ts.transpileModule(source,{fileName,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
 assert.equal(x.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0,name+" transpile");
}
for(const q of [
 'w.id===moduleId&&w.kind==="modulo"',
 'if(cursor.parent_id===moduleId)return true',
 'seen.has(cursor.id)',
 'acceptedIds.has(e.workstream_id)',
 '.slice(0,12)',
 'hasIdentifiedActor:Boolean(e.actor_auth_uid)',
 'eventsAreWindowed:true'
])assert(lib.includes(q),"Safe M3 evolution projection missing: "+q);
assert(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/.test(lib),"M3 projection must be pure read-only");
assert(links.includes('case "FM-09":')&&links.includes("CRM_CONTINUITY_CHECKPOINTS_V12"),"FM-09 must use existing real CRM checkpoints");
assert(links.includes('case "FM-10":')&&links.includes('CRM_DRAFTS["FM-10"]'),"FM-10 must declare only a source-backed learning candidate");
assert(fm.includes("projectFm09Continuity(moduleId,workstreams,events)"),"FM-09 must use Central snapshot, not another query");
assert(fm.includes('m4FrontId===front.id&&<NucleoTechnicalEvidence workstreamId={front.id}/>'),"M4 readback must be scoped and lazy");
assert(fm.includes("até 200 eventos carregada pela Central"),"M3 window not exhaustive");
assert(fm.includes("não representam")&&fm.includes("Somente revisões FM-10 efetivamente"),"Learning not falsely certified");
assert(atlas.includes("workstreams={workstreams} events={events}"),"Atlas must pass the same loaded Core snapshot");
console.log("Núcleo V1.3 FM-09/10: M3 bounded, M4 lazy, historical checkpoints, learning candidates without false grants.");
