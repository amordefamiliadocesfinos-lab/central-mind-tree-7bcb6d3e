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
console.log("AC02 continuity UI: guarded read, no implicit write/delivery, safe module scoping.");
