#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),ts=require("typescript");
const p="src/lib/nucleo/ac01PostReviewEvidenceV13.ts";
const src=fs.readFileSync(p,"utf8");
const out=ts.transpileModule(src,{fileName:p,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(out.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
const mod={exports:{}};new Function("module","exports",out.outputText)(mod,mod.exports);
const summarize=mod.exports.summarizePostReviewEvidence;
const row=(id,module_id,contribution_id,event_kind)=>({
 id,module_id,contribution_id,event_kind,body:"Registro de teste",actor_auth_uid:"actor",recorded_at:"2026-11-16",
});
const issues=["decisao_pendente","origem_sem_fm","decisao_pendente"];
let result=summarize("crm","c2",issues,[
 row("1","crm","c2","comentario"),row("2","crm","c2","solicitar_refinamento"),
 row("3","crm","c2","encaminhar_decisao"),row("4","crm","c2","minuta_consolidacao"),
 row("5","crm","c1","comentario"),row("6","financeiro","c2","solicitar_refinamento"),
]);
assert.deepEqual(result.counts,{comments:1,refinementRequests:1,drafts:1,referrals:1});
assert.deepEqual(result.issues.map(x=>x.issue),["decisao_pendente","origem_sem_fm"]);
assert(result.issues.every(x=>x.linkedEventId===null&&x.status==="resolucao_nao_comprovada"));
assert.equal(result.independentResolutionVerified,false);
assert.equal(result.decisionVerified,false);
assert.equal(result.publicationVerified,false);
result=summarize("crm","c2",["historico_incompleto"],[]);
assert.deepEqual(result.counts,{comments:0,refinementRequests:0,drafts:0,referrals:0});
assert.equal(result.issues[0].status,"resolucao_nao_comprovada");
const trail=fs.readFileSync("src/components/nucleo/NucleoAC01ReviewTrail.tsx","utf8");
const desk=fs.readFileSync("src/components/nucleo/NucleoContributionDesk.tsx","utf8");
assert(trail.includes("summarizePostReviewEvidence(moduleId,contributionId,trackedIssues,rows)"));
assert(trail.includes("result.data.length>=MAX"),"Truncated read must not display verified states");
assert(trail.includes("!loading&&!error&&evidence"),"Only show evidence on clean read");
assert(trail.includes("resolução não comprovada neste recorte"));
assert(trail.includes("Registro de evento não confirma ação concluída"));
assert(desk.includes("trackedIssues={suggested.map(item=>item.issue)}"));
for(const [name,s] of [["trail",trail],["desk",desk]]){
 const r=ts.transpileModule(s,{fileName:name+".tsx",compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
 assert.equal(r.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0,name+" syntax");
}
assert(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/.test(src));
console.log("AC-01 post-review: persisted event counts, issue resolutions never inferred, scoped by module and contribution.");
