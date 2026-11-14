#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const source = fs.readFileSync("src/lib/nucleo/supervision.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const scope = {exports:{}};
vm.runInNewContext(compiled, scope, {timeout:1000});
const {inspectNucleoSupervision} = scope.exports;
assert.equal(typeof inspectNucleoSupervision, "function");
function front(code, status="em_validacao", next_action="Revisar") {
 return {id:code,code,title:code,kind:"frente",status,next_action,blocker:"",evidence_state:"sem_evidencia"};
}
function evidence(id,code,state="verificado") {
 return {id,workstream_id:code,observed_state:state};
}
const now=new Date("2026-11-12T10:00:00Z");
const fronts=[{...front("NUC-M1"),evidence_state:"comprovada"}, {...front("NUC-M4"),evidence_state:"comprovada"}];
let result=inspectNucleoSupervision(fronts,[evidence("a","NUC-M1"),evidence("b","NUC-M4")],[],now);
assert.equal(result.findings.length,0);
assert.equal(result.declaredDependencies,0);
assert.equal(result.informationalOnly,true);
assert.equal(result.evidenceCount,2);
assert.equal(result.computedAt,now.toISOString());
result=inspectNucleoSupervision([front("NUC-M4")],[evidence("a","NUC-M4","divergente")],[],now);
assert.equal(result.findings.length,1);
assert.equal(result.findings[0].kind,"divergencia");
assert.equal(result.findings[0].evidenceIds[0],"a");
// Verificação cruzada nova: M3 declara prova, mas snapshot M4 não contém
// evidência verificada. Provas externas podem existir: alerta é informativo.
result=inspectNucleoSupervision([{...front("NUC-M4"),evidence_state:"comprovada"}],[],[],now);
assert.equal(result.findings.length,1);
assert.equal(result.findings[0].kind,"prova_declarada");
assert.equal(result.findings[0].severity,"informativo");
result=inspectNucleoSupervision([{...front("NUC-M4"),evidence_state:"comprovada"}],[evidence("x","NUC-M4","observado")],[],now);
assert.equal(result.findings.filter(f=>f.kind==="prova_declarada").length,1);
result=inspectNucleoSupervision([{...front("NUC-M4","concluido"),evidence_state:"comprovada"}],[],[],now);
assert.equal(result.findings.filter(f=>f.kind==="evidencia_ausente").length,1);
assert.equal(result.findings.filter(f=>f.kind==="prova_declarada").length,0);
result=inspectNucleoSupervision([front("NUC-M1","concluido")],[],[],now);
assert.equal(result.findings[0].kind,"evidencia_ausente");
result=inspectNucleoSupervision([front("NUC-M1","bloqueado")],[],[],now);
assert.equal(result.findings.length,0);
const blocked={...front("NUC-M1","bloqueado"),blocker:"Dependência externa"};
result=inspectNucleoSupervision([blocked],[],[],now);
assert.equal(result.findings[0].kind,"bloqueio");
result=inspectNucleoSupervision([front("NUC-M1","planejado","")],[],[],now);
assert.equal(result.findings[0].kind,"proxima_acao");
result=inspectNucleoSupervision([front("NUC-M1")],[evidence("b","NUC-M1","observado")],[],now);
assert.equal(result.findings[0].kind,"revisao_fonte");
result=inspectNucleoSupervision([front("NUC-M1")],[evidence("b","NUC-M1","nao_verificado")],[],now);
assert.equal(result.findings[0].kind,"revisao_fonte");
result=inspectNucleoSupervision(fronts,[],[{workstream_id:"NUC-M4",depends_on_id:"NUC-M1"}],now);
assert.equal(result.declaredDependencies,1);
result=inspectNucleoSupervision(fronts,[],[{workstream_id:"NUC-M4",depends_on_id:"UNKNOWN"}],now);
assert.equal(result.declaredDependencies,0);
result=inspectNucleoSupervision([{...front("NUC"),kind:"modulo"}],[],[],now);
assert.equal(result.findings.length,0);
console.log("M5 supervision: baseline and cross-evidence checks PASS; deterministic, no mutations or external API.");

// A+ CA16/CA18 — testes determinísticos do contrato compartilhado pela Edge Function.
const contractSource=fs.readFileSync("supabase/functions/_shared/nucleo/knowledge-contract.ts","utf8");
const contractJs=ts.transpileModule(contractSource,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText;
const contractScope={exports:{}};
vm.runInNewContext(contractJs,contractScope,{timeout:1000});
const {reviewImpact,explicitSourcePaths,isRequestedModuleCode,validPrNumber}=contractScope.exports;
assert.equal(isRequestedModuleCode("CRM"),true);
assert.equal(isRequestedModuleCode("crm"),false);
assert.equal(isRequestedModuleCode("CRM;DROP"),false);
assert.equal(validPrNumber("297"),297);
assert.equal(validPrNumber("297/../"),null);
const ref="src/components/crm/AttendanceActionBar.tsx";
assert.equal(explicitSourcePaths(ref).length,1);
assert.equal(explicitSourcePaths("src/../secrets.ts").length,0);
assert.equal(explicitSourcePaths("https://evil.example/src/a.ts").length,0);
const revision={id:"fm1",section_code:"FM-05",version_no:1,source_reference:ref,recorded_at:"2026-11-11T00:00:00Z"};
const later={evidence_id:"ev1",number:297,merged_at:"2026-11-12T00:00:00Z",files:[ref]};
let impact=reviewImpact([revision],[later],true);
assert.equal(impact.state,"candidatos");
assert.equal(impact.suggestions.length,1);
assert.equal(impact.suggestions[0].pr_numbers[0],297);
impact=reviewImpact([revision],[{...later,files:["src/components/other/Unrelated.tsx"]}],true);
assert.equal(impact.state,"sem_correspondencia_comprovada");
impact=reviewImpact([revision],[{...later,merged_at:"2026-11-10T00:00:00Z"}],true);
assert.equal(impact.suggestions.length,0);
impact=reviewImpact([revision],[{...later,files:null}],false);
assert.equal(impact.state,"indeterminado");
impact=reviewImpact([{...revision,source_reference:"Biblioteca histórica"}],[later],true);
assert.equal(impact.state,"indeterminado");
// Preserve production-safety invariants in the actual deployed handler source.
const edgeSource=fs.readFileSync("supabase/functions/nucleo-knowledge-read/index.ts","utf8");
assert.match(edgeSource,/auth\.getUser\(token\)/);
assert.match(edgeSource,/app_admin_capabilities/);
assert.match(edgeSource,/nucleo_manage/);
assert.match(edgeSource,/\.limit\(MAX_FM\)/);
assert.doesNotMatch(edgeSource,/SUPABASE_SERVICE_ROLE_KEY|\.insert\(|\.update\(|\.delete\(/);
const configSource=fs.readFileSync("supabase/config.toml","utf8");
assert.match(configSource,/\[functions\.nucleo-knowledge-read\]\s*verify_jwt = true/);
console.log("Núcleo A+ CA16/18: JWT, contrato, paths e revisão determinística PASS (testes sintéticos).");


// A+ CA-14: catalogação crítica fundamentada no código, sem ações executáveis.
const fsCrm=fs.readFileSync("src/pages/ContatosInbox.tsx","utf8");
const catalog=fs.readFileSync("src/lib/nucleo/operationalKnowledgeV12.ts","utf8");
const catalogJs=ts.transpileModule(catalog,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText;
const catalogScope={exports:{}};
vm.runInNewContext(catalogJs,catalogScope,{timeout:1000});
const actions=catalogScope.exports.CRM_ACTIONS;
assert.ok(Array.isArray(actions));
const requiredCrm=[
  ["Concluir","requestConcludeSelectedConversation","não cria Resultado comercial"],
  ["Reabrir","Atendimento reaberto.","não desfaz automaticamente Resultado"],
  ["Tirar da fila","toggleSelectedOutOfQueue","não arquiva nem conclui"],
  ["Próximo atendimento","nextAttendance()","não registra Resultado"],
  ["Sem fato novo — retirar da prioridade","acknowledgeNoNewFact","sem fato comercial novo"],
];
for(const [label,sourceToken,limit] of requiredCrm){
  const action=actions.find(item=>item.label===label);
  assert.ok(action,"Ação real ausente do catálogo: "+label);
  assert.equal(action.confidence,"codigo_verificado");
  assert.match(action.source,/src\/pages\/ContatosInbox\.tsx$/);
  assert.ok(fsCrm.includes(sourceToken),"Controle não encontrado na origem: "+sourceToken);
  const documentation=[action.prerequisite,action.expectedEffect,action.confirmation,action.limit].join(" ");
  assert.ok(documentation.includes(limit),"Limite semântico ausente: "+label);
}
assert.equal(new Set(actions.map(action=>action.label)).size,actions.length);
console.log("Núcleo A+ CA-14: cinco controles Inbox e seus limites documentados PASS (código, não UAT).");


// A+ CA13/CA17 — fontes CRM originais, estados separados e sem mandato automático.
const authoritySource=fs.readFileSync("src/lib/nucleo/crmAuthoritySourcesV12.ts","utf8");
const authorityJs=ts.transpileModule(authoritySource,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText;
const authorityScope={exports:{}};
vm.runInNewContext(authorityJs,authorityScope,{timeout:1000});
const sources=authorityScope.exports.CRM_AUTHORITY_SOURCES_V12;
const role=authorityScope.exports.CRM_SPECIALIST_CA17;
assert.equal(sources.length,9);
assert.equal(new Set(sources.map(s=>s.id)).size,9);
assert.ok(sources.every(s=>s.archive.endsWith(".zip")&&s.originalFile.endsWith(".txt")));
assert.match(sources.find(s=>s.id==="CRM-ESTADO").sourceStatus,/03\/10/);
assert.match(sources.find(s=>s.id==="CRM-09.02").sourceStatus,/PRONTA PARA HOMOLOGAÇÃO/);
assert.match(sources.find(s=>s.id==="CRM-09.03").sourceStatus,/PRONTA PARA HOMOLOGAÇÃO/);
assert.match(sources.find(s=>s.id==="CRM-09.04").sourceStatus,/HOMOLOGADA/);
assert.match(role.activeMandate,/^não certificado no Core/);
const fmSource=fs.readFileSync("src/components/nucleo/NucleoModuleKnowledge.tsx","utf8");
assert.match(fmSource,/moduleCode==="CRM"/);
assert.match(fmSource,/CRM_AUTHORITY_SOURCES_V12\.map/);
assert.match(fmSource,/não certifica método ou especialista/);
console.log("Núcleo A+ CA13/17: fontes CRM e estados documentais sem homologação inferida PASS.");


// Núcleo A+ CA13/CA17 — checkpoint posterior preparado NÃO altera vigência.
const checkpoints=authorityScope.exports.CRM_CONTINUITY_CHECKPOINTS_V12;
assert.equal(checkpoints.length,4);
assert.equal(new Set(checkpoints.map(c=>c.id)).size,4);
assert.match(checkpoints.find(c=>c.id==="CRM-ESTADO-V1.2").state,/NÃO VIGENTE/);
assert.match(checkpoints.find(c=>c.id==="CRM-SUCESSAO-04-11").state,/NÃO CERTIFICA/);
assert.match(checkpoints.find(c=>c.id==="CRM-411-OPERACIONAL").state,/NÃO RECONFIRMADO/);
assert.match(authorityScope.exports.CRM_SPECIALIST_CA17.successionRecord,/CRM 7 → CRM 8/);
assert.match(authorityScope.exports.CRM_SPECIALIST_CA17.activeMandate,/não certificado/);
const fmCheckpointSource=fs.readFileSync("src/components/nucleo/NucleoModuleKnowledge.tsx","utf8");
assert.match(fmCheckpointSource,/CRM_CONTINUITY_CHECKPOINTS_V12\.map/);
assert.match(fmCheckpointSource,/CRM_SPECIALIST_CA17\.successionRecord/);
assert.doesNotMatch(authoritySource,/activeMandate:"certificado"/);
console.log("Núcleo A+ CA13/17: sucessão documental e estado V1.2 preparado preservados PASS.");


// Núcleo A+ CA13/17 — preparo decisório sem homologação ou mandato automático.
const draftsText=fs.readFileSync("src/lib/nucleo/operationalDraftsV12.ts","utf8");
const draftsJs=ts.transpileModule(draftsText,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText;
const draftsScope={exports:{}};
vm.runInNewContext(draftsJs,draftsScope,{timeout:1000});
const crmDrafts=draftsScope.exports.CRM_DRAFTS;
assert.ok(crmDrafts["FM-05"].body.includes("Sem fato novo"));
assert.ok(crmDrafts["FM-05"].body.includes("Concluir"));
assert.ok(crmDrafts["FM-08"].body.includes("CRM 7 → CRM 8"));
assert.ok(crmDrafts["FM-08"].body.includes("NÃO VIGENTE"));
assert.ok(crmDrafts["FM-09"].body.includes("PR #411"));
assert.ok(crmDrafts["FM-09"].body.includes("PR #412"));
const proposalComponent=fs.readFileSync("src/components/nucleo/NucleoMandateProposal.tsx","utf8");
assert.match(proposalComponent,/Preparar proposta CRM sem certificação/);
assert.ok(proposalComponent.includes('setMethod("");'));

assert.match(proposalComponent,/registra exclusivamente uma proposta/);
console.log("Núcleo CA13/17: FM05/FM08/FM09 e proposta de autoridade com limites PASS.");
