#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),ts=require("typescript");
const ui=fs.readFileSync("src/components/nucleo/NucleoAc02ContinuityRead.tsx","utf8");
const atlas=fs.readFileSync("src/components/nucleo/NucleoOperationalAtlas.tsx","utf8");
const check=ts.transpileModule(ui,{fileName:"NucleoAc02ContinuityRead.tsx",compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(check.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0);
for(const fragment of [
 'supabase.functions.invoke("nucleo-knowledge-read"',
 'module_code:moduleCode,include_ac02:true,include_assumption_export:true',
 'response.module?.id!==moduleId',
 'p.privateSourcesIncluded===false',
 'p.status==="rascunho_nao_homologado"',
 'id!==counter.current',
 'navigator.clipboard.writeText(draft.text)',
 'role="alert"',
 'role="status"'
])assert(ui.includes(fragment),"AC02 safe integration missing: "+fragment);
assert(!/\.from\(|\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/.test(ui),"AC02 UI cannot write data");
assert(ui.includes('onClick={prepare}'),"Consult only on explicit action");
assert(ui.includes("setDraft(null)"),"Clear prior result on retry or module switch");
assert(atlas.includes("<NucleoAc02ContinuityRead key={selectedRecord.id}"),"Mount in existing specialist area");
// Execute the pure parser independently of React and auth mocks.
const helper=ui.slice(ui.indexOf('type LearningSection='),ui.indexOf('type ReadResponse='));
const mod={exports:{}};
new Function('exports',ts.transpileModule(helper,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(mod.exports);
const read=mod.exports.readLearningSections;
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const rows=Array.from({length:10},(_,i)=>({section_code:"FM-"+String(i+1).padStart(2,"0"),state:"sem_registro",revision:null}));
const revision={id,module_id:id,section_code:"FM-10",version_no:1,title:"Lição",body:"Texto autorizado",authority_state:"rascunho",evidence_level:"declarado",recorded_at:"2026-11-24T00:00:00Z",source_reference:"origem"};
rows[9]={section_code:"FM-10",state:"registro_core",revision};
assert.equal(read(rows,id)[0].state,"ausente");
assert.equal(read(rows,id)[1].revision.body,"Texto autorizado");
assert.equal(read(rows,"different")[1].state,"indeterminado");
assert.equal(read(rows.slice(1),id)[1].state,"indeterminado");
assert.equal(read([...rows.slice(0,9),rows[8]],id)[1].state,"indeterminado");
assert(ui.includes("setLearning([])")&&ui.includes("readLearningSections(response.sections,moduleId)"));
assert.equal((ui.match(/navigator.clipboard.writeText\(/g)||[]).length,1);
console.log("AC02 continuity UI: guarded read, no implicit write/delivery, safe module scoping.");
