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


// A+ CA-21: o limite da Ficha Viva não pode transformar leitura parcial
// em histórico completo nem habilitar gravação baseada em versão truncada.
const fichaSource=fs.readFileSync("src/components/nucleo/NucleoModuleKnowledge.tsx","utf8");
const fichaCompiled=ts.transpileModule(fichaSource,{compilerOptions:{
  jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,
},reportDiagnostics:true});
assert.equal((fichaCompiled.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
assert.match(fichaSource,/const MAX_FM_HISTORY_ROWS = 300/);
assert.match(fichaSource,/result\.data\.length>=MAX_FM_HISTORY_ROWS/);
assert.match(fichaSource,/setRevisions\(\[\]\);\s*setError\("Histórico da Ficha Viva atingiu o limite/);
assert.match(fichaSource,/if\(loading\|\|error\|\|saving\|\|writeUncertain\|\|!fence\.ready\|\|fence\.blocked\) return;/,
  "Ficha Viva must block writes on loading, error, saving, uncertain write, unready fence or blocked fence");
assert.match(fichaSource,/error \? "Cobertura indeterminada — erro de leitura"/);
assert.match(fichaSource,/recorded_by_auth_uid\.slice\(0,8\)/);
assert.match(fichaSource,/reviewed_by/);
console.log("Núcleo A+ CA-21: fail-closed para 300 revisões e indicação de autoria PASS (teste de contrato estático).");


// A+ CA-19 / CA-22 — navegação visual de módulo e atalhos com dados M3.
// Teste de contrato estático: não substitui ensaio real por teclado/mobile.
const atlasVisual=fs.readFileSync("src/components/nucleo/NucleoOperationalAtlas.tsx","utf8");
const atlasVisualJs=ts.transpileModule(atlasVisual,{compilerOptions:{
  jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,
},reportDiagnostics:true});
assert.equal((atlasVisualJs.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
for(const item of ["funcoes","especialista","desenvolvimento","conhecimento"]){
  assert.ok(atlasVisual.includes('id:"'+item+'"'),"Falta seção navegável: "+item);
  assert.ok(atlasVisual.includes('moduleSection==="'+item+'"'),"Falta conteúdo selecionável: "+item);
}
assert.match(atlasVisual,/aria-pressed=\{moduleSection===item.id\}/);
assert.match(atlasVisual,/portfolioAttention = catalog\.map\(module/);
assert.match(atlasVisual,/onClick=\{\(\)=>choose\(module\)\}/);
assert.match(atlasVisual,/Nenhuma frente vinculada ao módulo no Core/);
assert.match(atlasVisual,/não foram comprovados no Core|ainda não foram comprovados no Core/);
assert.match(atlasVisual,/não homologações|não homologado|não homologações/);
console.log("Núcleo A+ CA19/22: navegação por áreas e atalhos de consulta M3 PASS (verificação estática).");


// A+ CA-01/02/11/19/22 — cobertura real vs catálogo, sem inventar cadastro.
// Verificações estáticas da UI e contrato de falha fechada; não substituem UAT.
const coverageSource=fs.readFileSync("src/components/nucleo/NucleoCrossModuleCoverage.tsx","utf8");
const centerSource=fs.readFileSync("src/components/nucleo/NucleoDevelopmentCenter.tsx","utf8");
for(const file of [coverageSource,centerSource]){
  const check=ts.transpileModule(file,{compilerOptions:{
    jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,
  },reportDiagnostics:true});
  assert.equal((check.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
}
assert.match(coverageSource,/filter==="precisa_reconciliar"/);
assert.match(coverageSource,/filter==="somente_catalogo"/);
assert.match(coverageSource,/const notRegistered=rows\.filter\(row=>!row\.record\)/);
assert.match(coverageSource,/!record && <Button/);
assert.match(coverageSource,/onPrepareModule\(module\)/);
assert.match(atlasVisual,/onPrepareModule=\{onPrepareModule\}/);
assert.match(centerSource,/setReadError\(true\)/);
assert.match(centerSource,/setReadError\(false\)/);
assert.match(centerSource,/if \(readError\) return \(/);
assert.match(centerSource,/cobertura, as contagens e os vínculos estão indeterminados/);
assert.match(centerSource,/const prepareModule = \(module:KnowledgeModule\)/);
assert.match(centerSource,/setDraft\(\{\.\.\.emptyDraft,code:cleanCode\(module.id\),title:module.name,kind:"modulo"\}\)/);
assert.match(centerSource,/if \(readError \|\| loading\)/);
console.log("Núcleo A+ CA01/02/11/19/22: reconciliação M3 e falha fechada PASS (contratos estáticos).");


// A+ V1.2 CA-14/22 — módulos além do CRM: somente achados no código e fontes.
const moduleControlSource=fs.readFileSync("src/lib/nucleo/moduleControlDiscoveriesV12.ts","utf8");
const moduleControlJs=ts.transpileModule(moduleControlSource,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
},reportDiagnostics:true});
assert.equal((moduleControlJs.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
// CA-14/22 aqui confere somente os controles não CRM; o catálogo reutiliza
// CRM_ACTIONS de outro módulo, que não deve ser resolvido dentro desta VM isolada.
const moduleControlScope={
  exports:{},
  require:(specifier)=>{
    assert.equal(specifier,"./operationalKnowledgeV12","Dependência inesperada na VM de controles");
    return {CRM_ACTIONS:[]};
  },
};
vm.runInNewContext(moduleControlJs.outputText,moduleControlScope,{timeout:1000});
const moduleControls=moduleControlScope.exports.MODULE_CONTROLS_V12;
for(const mod of ["FIN","OPE","ROT","CAP"]){
  assert.ok(moduleControls[mod]?.length>0,"Sem achados para "+mod);
  for(const action of moduleControls[mod]){
    assert.ok(action.label&&action.screen&&action.prerequisite&&action.observed&&action.confirmation&&action.limitation);
    assert.match(action.source,/^https:\/\/github\.com\/amordefamiliadocesfinos-lab\/central-mind-tree-7bcb6d3e\/blob\/main\/src\//);
  }
}
const knownControls=[
  ["FIN","Revisar importados","src/pages/Financeiro.tsx","setReviewImportedOpen(true)"],
  ["FIN","Importar Extrato","src/pages/Financeiro.tsx","setImporterOpen(true)"],
  ["OPE","Nova compra","src/components/operations/PurchasesTab.tsx","openEditor"],
  ["OPE","Central de Fornecedores","src/components/operations/PurchasesTab.tsx","setPurchaseSection('suppliers')"],
  ["ROT","Encerrar dia","src/pages/Rotina.tsx","handleCloseDay"],
  ["CAP","Fazer","src/pages/CapturaCentral.tsx",'openDecision(entry, "fazer")'],
  ["CAP","Planejar","src/pages/CapturaCentral.tsx",'openDecision(entry, "planejar")'],
];
for(const [mod,label,path,symbol] of knownControls){
  const entry=moduleControls[mod].find(action=>action.label===label);
  assert.ok(entry,"Controle ausente: "+mod+"/"+label);
  assert.ok(entry.source.endsWith(path),"Fonte diferente: "+label);
  assert.ok(fs.readFileSync(path,"utf8").includes(symbol),"Controle não encontrado no código: "+label);
}
const discoverySource=fs.readFileSync("src/components/nucleo/NucleoModuleDiscovery.tsx","utf8");
const discoveryCompiled=ts.transpileModule(discoverySource,{compilerOptions:{
  jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,
},reportDiagnostics:true});
assert.equal((discoveryCompiled.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
assert.match(discoverySource,/MODULE_RECONCILIATION_V12/);
assert.match(discoverySource,/MODULE_CONTROLS_V12/);
assert.match(discoverySource,/O que ainda não comprova/);
assert.match(discoverySource,/mode==="funcoes"/);
assert.match(discoverySource,/mode==="conhecimento"/);
assert.match(atlasVisual,/import NucleoModuleDiscovery/);
assert.match(atlasVisual,/moduleSection==="funcoes" && \(selected\.id==="CRM" \? \(/);
assert.match(atlasVisual,/NucleoModuleDiscovery key=\{selected\.id\+"-funcoes"\}/);
console.log("Núcleo A+ CA14/22: controles fora do CRM rastreados ao código e fontes PASS (não UAT).");


// A+ CA-14/22: mapa de telas verificadas, com deep link somente quando suportado.
const moduleScreenSource=fs.readFileSync("src/lib/nucleo/moduleScreenDiscoveriesV12.ts","utf8");
const screenJs=ts.transpileModule(moduleScreenSource,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
},reportDiagnostics:true});
assert.equal((screenJs.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
// Verificação não CRM do mapa de telas; mesmo isolamento da dependência CRM.
const screenScope={
  exports:{},
  require:(specifier)=>{
    assert.equal(specifier,"./operationalKnowledgeV12","Dependência inesperada na VM de telas");
    return {CRM_SCREENS:[]};
  },
};
vm.runInNewContext(screenJs.outputText,screenScope,{timeout:1000});
const screenCatalog=screenScope.exports.MODULE_SCREENS_V12;
for(const code of ["FIN","OPE","ROT","CAP","DIG","ASS"]){
  const entries=screenCatalog[code];
  assert.ok(entries.length>=3,"Sem mapa de telas para "+code);
  assert.equal(new Set(entries.map(e=>e.id)).size,entries.length);
  for(const entry of entries){
    assert.ok(entry.name&&entry.description&&entry.check&&entry.limitation);
    assert.match(entry.source,/^https:\/\/github\.com\/amordefamiliadocesfinos-lab\/central-mind-tree-7bcb6d3e\/blob\/main\/src\//);
    assert.ok(fs.existsSync(entry.source.split("/blob/main/")[1]));
    if(entry.navigation==="rota_verificada"){
      assert.ok(entry.route,"Deep link sem rota: "+entry.name);
      if(code==="OPE"){
        assert.match(entry.route,/^\/operacoes\?tab=/);
        assert.ok(fs.readFileSync("src/pages/Operacoes.tsx","utf8").includes("'"+entry.id+"'"));
      }else if(code==="DIG"){
        assert.match(entry.route,/^\/digital\?tab=/);
        const digital=fs.readFileSync("src/pages/Digital.tsx","utf8");
        assert.ok(digital.includes("'"+entry.id+"'"),"Aba Digital não declarada");
        const recognized=digital.split("if (tabParam && ")[1]?.split("includes(tabParam)")[0]??"";
        assert.ok(recognized.includes("'"+entry.id+"'"),"Deep link Digital não reconhecido: "+entry.id);
      }else assert.fail("Rota profunda não auditada: "+code);
    }else assert.equal(entry.route,null,"Rota não verificada deve ficar nula");
  }
}
assert.ok(screenCatalog.DIG.some(x=>x.id==="campanhas"&&x.route===null));
const mapView=fs.readFileSync("src/components/nucleo/NucleoModuleDiscovery.tsx","utf8");
assert.match(mapView,/MODULE_SCREENS_V12/);
assert.match(mapView,/Mapa de telas identificadas/);
assert.match(mapView,/item.navigation==="rota_verificada"/);
assert.match(mapView,/item.route\s*\? <Button/);
assert.match(mapView,/item.check/);
assert.match(mapView,/item.limitation/);
assert.match(mapView,/visibleScreens=useMemo/);
console.log("Núcleo A+ CA14/22: mapas e rotas profundas auditadas, sem UAT automática PASS.");


// A+ CA-14/15/22 — jornadas orientadas: apenas leitura, sem execução ou UAT falsa.
const journeyText=fs.readFileSync("src/lib/nucleo/moduleJourneysV12.ts","utf8");
const journeyJs=ts.transpileModule(journeyText,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
},reportDiagnostics:true});
assert.equal((journeyJs.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
const journeyScope={exports:{}};
vm.runInNewContext(journeyJs.outputText,journeyScope,{timeout:1000});
const journeys=journeyScope.exports.MODULE_JOURNEYS_V12;
for(const code of ["FIN","OPE","ROT","CAP","DIG","ASS"]){
  assert.ok(journeys[code]?.length>0,"Jornada ausente: "+code);
  assert.ok(screenCatalog[code]?.length>0,"Mapa de telas ausente: "+code);
  for(const journey of journeys[code]){
    assert.ok(journey.id&&journey.title&&journey.goal);
    assert.ok(journey.steps.length>=2);
    for(const step of journey.steps){
      assert.ok(step.task&&step.inspect&&step.verify&&step.limit);
      assert.ok(screenCatalog[code].some(item=>item.id===step.screenId),"Tela sem fonte: "+code+"/"+step.screenId);
      if(step.controlLabel){
        assert.ok(moduleControls[code]?.some(item=>item.label===step.controlLabel),"Controle sem fonte: "+code+"/"+step.controlLabel);
      }
    }
  }
}
const guidedSource=fs.readFileSync("src/components/nucleo/NucleoGuidedJourneys.tsx","utf8");
const guidedCompiled=ts.transpileModule(guidedSource,{compilerOptions:{
  jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,
},reportDiagnostics:true});
assert.equal((guidedCompiled.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
assert.match(guidedSource,/MODULE_JOURNEYS_V12/);
assert.match(guidedSource,/MODULE_SCREENS_V12/);
assert.match(guidedSource,/MODULE_CONTROLS_V12/);
assert.match(guidedSource,/aria-pressed=\{selected\?\.id===item\.id\}/);
assert.match(guidedSource,/Próxima etapa/);
assert.match(guidedSource,/somente navegação, sem confirmação de execução/);
assert.doesNotMatch(guidedSource,/supabase|\.insert\(|\.update\(|\.delete\(|\.invoke\(/);
assert.match(fs.readFileSync("src/components/nucleo/NucleoModuleDiscovery.tsx","utf8"),/NucleoGuidedJourneys/);
console.log("Núcleo A+ CA14/15/22: jornadas vinculadas a telas e controles, sem escrita PASS (não UAT).");


// A+ CA-04/10/19/22 — painel executivo apoiado nas fontes M3 existentes.
// Testes de integração estática não equivalem a homologação visual autenticada.
const execView=fs.readFileSync("src/components/nucleo/NucleoExecutiveDevelopment.tsx","utf8");
const execCompiled=ts.transpileModule(execView,{compilerOptions:{
  jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,
},reportDiagnostics:true});
assert.equal((execCompiled.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
assert.match(execView,/DevelopmentDependency, DevelopmentEvent, DevelopmentWorkstream/);
assert.match(execView,/statusOrder\[a\.item\.status\]/);
assert.match(execView,/priorityOrder\[a\.item\.priority\]/);
assert.match(execView,/depends_on_id/);
assert.match(execView,/latestByFront/);
assert.match(execView,/Último evento carregado/);
assert.match(execView,/Responsável declarado/);
assert.match(execView,/Sem próxima ação/);
assert.match(execView,/Ver provas M4/);
assert.match(execView,/NucleoTechnicalEvidence workstreamId=\{item\.id\}/);
assert.match(execView,/janela global dos últimos 200/);
assert.doesNotMatch(execView,/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.invoke\(/);
const centerExec=fs.readFileSync("src/components/nucleo/NucleoDevelopmentCenter.tsx","utf8");
assert.match(centerExec,/<NucleoExecutiveDevelopment workstreams=\{items\} dependencies=\{dependencies\}/);
assert.match(centerExec,/dependencies=\{dependencies\}\s*events=\{history\}/);
const atlasExec=fs.readFileSync("src/components/nucleo/NucleoOperationalAtlas.tsx","utf8");
assert.match(atlasExec,/moduleId=\{selectedRecord\.id\}/);
assert.match(atlasExec,/NucleoExecutiveDevelopment/);
console.log("Núcleo A+ CA04/10/19/22: visão executiva M3-M4 sem writer PASS (não UAT).");


// A+ CA-07/08/10/21 — alterações M3 não equivalem a decisão ou aceite.
const checkpointSource=fs.readFileSync("src/lib/nucleo/developmentCheckpointV12.ts","utf8");
const checkpointJs=ts.transpileModule(checkpointSource,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
},reportDiagnostics:true});
assert.equal((checkpointJs.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
const checkScope={exports:{}};
vm.runInNewContext(checkpointJs.outputText,checkScope,{timeout:1000});
const summarize=checkScope.exports.summarizeDevelopmentCheckpoint;
const changed=summarize({event_type:"alterado",
  before_state:{status:"planejado",next_action:"Consultar",specialist:"Anterior",irrelevant:"x"},
  after_state:{status:"em_andamento",next_action:"Consultar",specialist:"Novo",irrelevant:"y"}});
assert.equal(changed.changes.length,2);
assert.ok(changed.changes.some(c=>c.field==="Situação"&&c.before==="planejado"&&c.after==="em_andamento"));
assert.ok(changed.changes.some(c=>c.field==="Responsável declarado"&&c.after==="Novo"));
assert.ok(!changed.changes.some(c=>c.field==="Próxima ação"));
assert.ok(!changed.changes.some(c=>c.field==="irrelevant"));
const incomplete=summarize({event_type:"alterado",before_state:null,after_state:{status:"concluido"}});
assert.equal(incomplete.hasComparableBefore,false);
assert.equal(incomplete.changes.length,0);
const created=summarize({event_type:"criado",before_state:null,after_state:{title:"Teste",status:"planejado"}});
assert.equal(created.label,"Criação registrada no M3");
const checkpointView=fs.readFileSync("src/components/nucleo/NucleoExecutiveDevelopment.tsx","utf8");
assert.match(checkpointView,/summarizeDevelopmentCheckpoint/);
assert.match(checkpointView,/Ver checkpoints M3/);
assert.match(checkpointView,/Aprovação humana: não comprovada por este evento/);
assert.match(checkpointView,/janela global de 200 registros/);
assert.match(checkpointView,/actor_auth_uid\.slice\(0,8\)/);
assert.match(checkpointView,/NucleoTechnicalEvidence workstreamId=\{item\.id\}/);
console.log("Núcleo A+ CA07/08/10/21: alterações, checkpoints e limites de aprovação PASS.");


// AC-01 V1.3 CA-24/25/26 — diff textual local, seguro e sem promoção automática.
const diffSourceV13=fs.readFileSync("src/lib/nucleo/documentDiffV13.ts","utf8");
const diffCompiledV13=ts.transpileModule(diffSourceV13,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
},reportDiagnostics:true});
assert.equal((diffCompiledV13.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
const diffScopeV13={exports:{}};
vm.runInNewContext(diffCompiledV13.outputText,diffScopeV13,{timeout:1000});
const compareV13=diffScopeV13.exports.compareDocumentVersionsV13;
const differenceV13=compareV13("linha um\nlinha velha","linha um\nlinha nova");
assert.equal(differenceV13.state,"completo");
assert.equal(differenceV13.included,1);
assert.equal(differenceV13.removed,1);
assert.equal(compareV13("idêntico","idêntico").included,0);
assert.equal(compareV13("idêntico","idêntico").removed,0);
assert.equal(compareV13("a".repeat(12001),"texto").state,"indisponivel");
assert.equal(compareV13("x\n".repeat(181),"texto").state,"indisponivel");
const ac01Knowledge=fs.readFileSync("src/components/nucleo/NucleoModuleKnowledge.tsx","utf8");
assert.match(ac01Knowledge,/compareDocumentVersionsV13/);
assert.match(ac01Knowledge,/Comparação de versões AC-01/);
assert.match(ac01Knowledge,/Preparar refinamento da versão selecionada/);
assert.match(ac01Knowledge,/authority_state:"rascunho"/);
assert.match(ac01Knowledge,/\.eq\("id",result\.data\.id\)\.maybeSingle\(\)/);
const ac01Atlas=fs.readFileSync("src/components/nucleo/NucleoOperationalAtlas.tsx","utf8");
assert.match(ac01Atlas,/Conhecimento e Evolução do especialista/);
// UX-A3B moved the access into a shared navigation function that also
// preserves the module context and keeps Ficha Viva mounted after first visit.
assert.ok(ac01Atlas.includes('onClick={() => selectModuleArea("conhecimento")}'));
assert.ok(ac01Atlas.includes('if (area === "conhecimento") {'));
assert.ok(ac01Atlas.includes('setKnowledgeOpen(true)'));
console.log("Núcleo V1.3 AC-01: comparação local, refinamento como rascunho e acesso pelo especialista PASS (sem homologação).");


// AC-01 V1.3 CA-28 — fila de revisão somente leitura sobre registros FM.
const ac01Queue=fs.readFileSync("src/components/nucleo/NucleoKnowledgeReviewConsole.tsx","utf8");
const ac01QueueCompiled=ts.transpileModule(ac01Queue,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal((ac01QueueCompiled.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
assert.match(ac01Queue,/workstreams\.filter\(w=>w\.kind==="modulo"\)/);
assert.match(ac01Queue,/Fila de revisões do gestor AC-01/);
assert.match(ac01Queue,/queueState==="pendentes"/);
assert.match(ac01Queue,/queueState==="homologados"/);
assert.match(ac01Queue,/queueState==="historico"/);
assert.match(ac01Queue,/readState!=="completo"/);
assert.match(ac01Queue,/não aprova, publica ou altera documentos/);
console.log("Núcleo V1.3 AC-01 CA28: fila por módulo com estados reais e falha fechada PASS.");


// AC-01 V1.3 CA-23/24 — ledger por referência, sem documento privado ou homologação.
const ac01Sql=fs.readFileSync("supabase/migrations/20261114183000_nucleo_ac01_contributions.sql","utf8");
const ac01UI=fs.readFileSync("src/components/nucleo/NucleoSpecialistContributions.tsx","utf8");
const ac01Compiled=ts.transpileModule(ac01UI,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal((ac01Compiled.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
assert.match(ac01Sql,/CREATE TABLE IF NOT EXISTS public\.nucleo_specialist_contributions/);
assert.match(ac01Sql,/lineage_id uuid NOT NULL/);
assert.match(ac01Sql,/UNIQUE \(lineage_id,version_no\)/);
assert.match(ac01Sql,/request_id uuid NOT NULL UNIQUE/);
assert.match(ac01Sql,/recorded_by_auth_uid := auth\.uid\(\)/);
assert.match(ac01Sql,/NEW\.authority_state:='proposta'/);
assert.match(ac01Sql,/NEW\.authority_state:='em_evolucao'/);
assert.match(ac01Sql,/ENABLE ROW LEVEL SECURITY/);
assert.match(ac01Sql,/GRANT SELECT, INSERT ON TABLE/);
assert.doesNotMatch(ac01Sql,/GRANT[^;]*(UPDATE|DELETE)/);
assert.doesNotMatch(ac01Sql,/CREATE POLICY[^;]*FOR UPDATE/);
assert.doesNotMatch(ac01Sql,/CREATE POLICY[^;]*FOR DELETE/);
assert.match(ac01UI,/\.eq\("id",result\.data\.id\)\.maybeSingle\(\)/);
assert.match(ac01UI,/Não repetir sem reconciliação|Não repita a proposta/);
// AC-01: contribuição inicial requer proposta; revisão vinculada requer
// em_evolucao. O teste antigo checava apenas o literal da proposta e rejeitava
// indevidamente o readback condicional já contratado na main.
// O readback vigente compara o snapshot completo da tentativa (incluindo
// "proposta" para inicial e "em_evolucao" para revisão), não apenas o estado.
assert.match(ac01UI,/authorityState:parent\?"em_evolucao":"proposta"/);
assert.match(ac01UI,/row\.authority_state===attempt\.authorityState/);
for(const [rowField,attemptField] of [
  ["request_id","requestId"],["module_id","moduleId"],
  ["specialist_role","specialistRole"],["contribution_kind","contributionKind"],
  ["title","title"],["source_kind","sourceKind"],["source_locator","sourceLocator"],
  ["source_checksum_sha256","checksum"],["note","note"],
  ["parent_revision_id","parentRevisionId"],["version_no","versionNo"],
]){
  assert.ok(ac01UI.includes("row."+rowField+"===attempt."+attemptField),
    "Readback AC-01 deve conferir "+rowField);
}
assert.match(ac01UI,/!isMatchingPendingAttempt\(check\.data,attempt\)/);
assert.ok(!ac01UI.includes('check.data.authority_state!=="proposta"'));
assert.doesNotMatch(ac01UI,/\.update\(|\.delete\(|\.upsert\(/);
const ac01MainAtlas=fs.readFileSync("src/components/nucleo/NucleoOperationalAtlas.tsx","utf8");
assert.match(ac01MainAtlas,/<NucleoSpecialistContributions key=\{selectedRecord\.id\}/);
console.log("Núcleo V1.3 AC-01 CA23/24: metadados, autor autenticado, RLS, imutabilidade e readback PASS (estático).");


// AC-01 V1.3 piloto NUC — ficha Núcleo acessível sem inflar contagem externa.
const ac01PilotAtlas=fs.readFileSync("src/components/nucleo/NucleoOperationalAtlas.tsx","utf8");
assert.match(ac01PilotAtlas,/workstreams\.filter\(item => item\.kind === "modulo"\)\)/);
assert.match(ac01PilotAtlas,/record\.code==="NUC"\?"Governança"/);
assert.match(ac01PilotAtlas,/record\.code==="NUC"\?"\/nucleo"/);
assert.match(ac01PilotAtlas,/registeredModules = useMemo\([\s\S]*?item\.code !== "NUC"/);
assert.match(ac01PilotAtlas,/<NucleoSpecialistContributions key=\{selectedRecord\.id\}/);
console.log("Núcleo V1.3 AC-01: ficha NUC acessível para piloto sem duplicar módulos externos PASS.");

// D3/D4: atalhos reutilizam ficha M3, guarda de edição e leitura M4 sob demanda.
const m5Navigation=fs.readFileSync('src/components/nucleo/NucleoSupervisionPanel.tsx','utf8');
const m3Navigation=fs.readFileSync('src/components/nucleo/NucleoDevelopmentCenter.tsx','utf8');
assert.match(m5Navigation,/const front=findExecutiveWorkstream\(finding.workstreamCode,latestFronts\)/);
assert.match(m5Navigation,/onOpenEvidence && finding.evidenceIds.length>0 && front &&/);
assert.match(m5Navigation,/onClick=\{\(\)=>onOpenEvidence\(front.id\)\}/);
assert.match(m5Navigation,/link.depends_on_id===target.id/);
assert.match(m5Navigation,/onOpenWorkstream\(target.id\)/);
const evidenceJump=m3Navigation.slice(m3Navigation.indexOf('onOpenEvidence={id=>{'),m3Navigation.indexOf('onOpenWorkstream={id=>{',m3Navigation.indexOf('onOpenEvidence={id=>{')));
assert(evidenceJump.includes('if(!byId.has(id))'));
assert(evidenceJump.includes('if(!choose(id))return;'));
assert(evidenceJump.includes('setExpandedEvidenceFor(id)'));
assert(evidenceJump.includes('nucleo-m3-technical-evidence'));
