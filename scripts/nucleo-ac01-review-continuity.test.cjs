#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),ts=require("typescript");
const libPath="src/lib/nucleo/ac01ReviewContinuityV13.ts";
const lib=fs.readFileSync(libPath,"utf8");
const out=ts.transpileModule(lib,{fileName:libPath,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(out.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
const obj={exports:{}};new Function("module","exports",out.outputText)(obj,obj.exports);
const {summarizeAc01ReviewContinuity}=obj.exports;
const record=(id,module_id,contribution_id,event_kind,recorded_at)=>({
 id,module_id,contribution_id,event_kind,recorded_at,actor_auth_uid:"actor",body:"evento de teste"
});
const summary=summarizeAc01ReviewContinuity("CRM","c2",[
 record("wrong-module","FIN","c2","solicitar_refinamento","2026-11-01"),
 record("wrong-revision","CRM","c1","encaminhar_decisao","2026-11-02"),
 record("b","CRM","c2","encaminhar_decisao","2026-11-04"),
 record("a","CRM","c2","solicitar_refinamento","2026-11-03"),
 record("c","CRM","c2","minuta_consolidacao","2026-11-05"),
]);
assert.deepEqual(summary.events.map(x=>x.id),["a","b","c"]);
assert.equal(summary.refinementRequests,1);
assert.equal(summary.draftCount,1);
assert.equal(summary.referrals,1);
assert.equal(summary.decisionVerified,false);
assert.equal(summary.refinementsResolved,false);
assert.equal(summary.published,false);
const ui=fs.readFileSync("src/components/nucleo/NucleoAC01ReviewContinuityRead.tsx","utf8");
const gov=fs.readFileSync("src/components/nucleo/NucleoAC01DocumentGovernance.tsx","utf8");
assert(ui.includes('.eq("module_id",moduleId).eq("contribution_id",contributionId)'));
assert(ui.includes("result.data.length>=LIMIT"),"recorte insuficiente deve falhar fechado");
assert(ui.includes("setError"),"erro deve ser explícito");
assert(ui.includes("summary.refinementRequests")&&ui.includes("summary.referrals"));
assert(ui.includes("não comprovam revisão independente concluída"),"sem aceite implícito");
assert(gov.includes("reviewHistoryOpen&&<NucleoAC01ReviewContinuityRead"));
assert(gov.includes("moduleId={moduleId} contributionId={selected.id}"));
assert(gov.includes("setSelectedId(c.id);setReviewHistoryOpen(false)"),"troca de contribuição fecha trilha anterior");
assert(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/.test(ui+lib),
 "Reader must not mutate Core");
console.log("AC01 review continuity: RLS scoped, incomplete reads fail-closed, no decision/publication from reviews.");
