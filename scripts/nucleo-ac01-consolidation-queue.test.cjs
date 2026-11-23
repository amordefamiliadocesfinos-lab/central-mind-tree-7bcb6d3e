#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),ts=require("typescript");
function load(p,loader=()=>({})){
 const src=fs.readFileSync(p,"utf8");
 const js=ts.transpileModule(src,{fileName:p,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
 assert.equal(js.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0);
 const mod={exports:{}};new Function("module","exports","require",js.outputText)(mod,mod.exports,loader);return mod.exports;
}
const match=load("src/lib/nucleo/ac01FmSourceMatchV13.ts");
const lineage=load("src/lib/nucleo/ac01FmLineageV13.ts",()=>match);
const queue=load("src/lib/nucleo/ac01ConsolidationQueueV13.ts",()=>lineage);
const c={id:"c1",module_id:"CRM",lineage_id:"L",version_no:1,parent_revision_id:null,source_locator:"source/a",authority_state:"proposta",recorded_at:"2026-11-01",title:"Teste",specialist_role:"CRM",contribution_kind:"manual"};
const c2={...c,id:"c2",version_no:2,parent_revision_id:"c1",recorded_at:"2026-11-02"};
const request={id:"req1",contribution_id:"c2",requested_outcome:"aprovar",recorded_at:"2026-11-03"};
const fm={id:"f1",module_id:"CRM",section_code:"FM-08",version_no:1,source_reference:"source/a",authority_state:"rascunho"};
let out=queue.buildAc01ConsolidationQueue([c,c2],[request],[],[],[fm]);
assert.equal(out.length,1);assert.equal(out[0].version,2);
assert(out[0].issues.includes("decisao_pendente"));
assert(out[0].issues.includes("sem_decisao_aprovada"));
assert.equal(out[0].matchedFm,1);
assert(!out[0].issues.includes("divergencia_de_origem"));
const decision={id:"dec1",contribution_id:"c2",decision_request_id:"req1",outcome:"aprovada",recorded_at:"2026-11-04"};
out=queue.buildAc01ConsolidationQueue([c,c2],[request],[decision],[],[fm]);
assert.equal(out[0].status,"pronto_para_revisao_humana");
out=queue.buildAc01ConsolidationQueue([c,c2],[request],[decision],[],[{...fm,module_id:"OTHER"}]);
assert(out[0].issues.includes("origem_sem_fm"));
const publication={id:"pub",contribution_id:"c2",decision_act_id:"missing",recorded_at:"2026-11-05"};
out=queue.buildAc01ConsolidationQueue([c,c2],[request],[decision],[publication],[fm]);
assert(out[0].issues.includes("publicacao_sem_decisao_no_recorte"));
// Aprovação histórica não torna uma proposta posterior pronta para revisão.
const c3={...c2,id:"c3",version_no:3,parent_revision_id:"c2",recorded_at:"2026-11-06",authority_state:"proposta"};
out=queue.buildAc01ConsolidationQueue([c,c2,c3],[request],[decision],[],[fm]);
assert.equal(out.length,1);
assert.equal(out[0].version,3);
assert(out[0].issues.includes("sem_decisao_aprovada"));
assert.equal(out[0].status,"exige_conciliacao");
// A decisão vinculada à versão atual é reconhecida somente nela.
const request3={...request,id:"req3",contribution_id:"c3",recorded_at:"2026-11-07"};
const decision3={...decision,id:"dec3",contribution_id:"c3",decision_request_id:"req3",recorded_at:"2026-11-08"};
out=queue.buildAc01ConsolidationQueue([c,c2,c3],[request,request3],[decision,decision3],[],[fm]);
assert(!out[0].issues.includes("sem_decisao_aprovada"));
out=queue.buildAc01ConsolidationQueue([c2],[request],[decision],[],[fm]);
assert(out[0].issues.includes("historico_incompleto"));
const ui=fs.readFileSync("src/components/nucleo/NucleoAC01DocumentGovernance.tsx","utf8");
assert(ui.includes("buildAc01ConsolidationQueue(contributions,reqs,decisions,publications,fm)"));
assert(ui.includes('tab==="decisao"&&<section'));
assert(ui.includes("AC01_QUEUE_ISSUE_LABELS"));
assert(ui.includes("setSelectedId(item.contributionId)"));
assert(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/.test(fs.readFileSync("src/lib/nucleo/ac01ConsolidationQueueV13.ts","utf8")));
console.log("CA-26/28: fila consultiva com decisões, faltas de origem, cadeia incompleta e sem promoção.");
