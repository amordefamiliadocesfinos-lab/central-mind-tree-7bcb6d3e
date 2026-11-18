#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const read=path=>fs.readFileSync(path,"utf8");
const screens=read("src/lib/nucleo/moduleScreenDiscoveriesV12.ts");
const controls=read("src/lib/nucleo/moduleControlDiscoveriesV12.ts");
const journeys=read("src/lib/nucleo/moduleJourneysV12.ts");
const atlas=read("src/components/nucleo/NucleoOperationalAtlas.tsx");
const discovery=read("src/components/nucleo/NucleoModuleDiscovery.tsx");
const original=read("src/lib/nucleo/moduleOriginalSourcesV12.ts");
const crm=read("src/lib/nucleo/operationalKnowledgeV12.ts");
const authority=read("src/lib/nucleo/crmAuthoritySourcesV12.ts");
const mandates=read("src/components/nucleo/NucleoMandateRegistry.tsx");
// CRM shares the same data-backed rendering logic as FIN, OPE and other modules.
for(const [source,part] of [
 [screens,"CRM:CRM_SCREENS.map("],[controls,"CRM:CRM_ACTIONS.map("],
 [journeys,'id:"crm-atendimento"'],[journeys,'id:"crm-revisao"'],
 [atlas,'module={selected} mode="funcoes"'],[atlas,'module={selected} mode="conhecimento"'],
 [discovery,"MODULE_ORIGINAL_SOURCES_V12[module.id]"],
 [original,"CRM:CRM_AUTHORITY_SOURCES_V12"],
])assert(source.includes(part),"Missing reusable bridge: "+part);
// CRM identities belong to source records, not their array positions.
for(const [id,route] of [["contatos","/contatos"],["inbox","/contatos/inbox"],["tarefas","/contatos/tarefas"]])
  assert(crm.includes('id: "'+id+'"') && crm.includes('route: "'+route+'"'),"CRM canonical identity/route missing: "+id);
for(const key of ["CRM:CRM_SCREENS.map(item=>","id:item.id","description:item.description","route:item.route","source:item.source"])
  assert(screens.includes(key),"CRM screen bridge must preserve identity, route, description and source: "+key);
assert(!screens.includes('id:["contatos","inbox","tarefas"][index]'),"CRM screen IDs must not depend on array order");
// Stable CRM control-to-screen relationship; all labels map to an existing CRM screen ID.
const crmActionSection=crm.slice(crm.indexOf("export const CRM_ACTIONS:"),crm.indexOf("export const CRM_JOURNEY"));
const screenIds=new Set(["contatos","inbox","tarefas"]);
const actionRecords=[...crmActionSection.matchAll(/\{\s*screenId: "(contatos|inbox|tarefas)",\s*label: "([^"]+)"/g)];
assert.equal(actionRecords.length,9,"All nine CRM controls require explicit screen identity");
assert.equal(new Set(actionRecords.map(m=>m[2])).size,9,"CRM control labels must remain unique");
for(const [,id,label] of actionRecords){
  assert(screenIds.has(id),"Unknown CRM screen for control "+label);
  assert(id==="contatos"||id==="inbox","CRM control screen must be backed by an operational source");
}
assert(controls.includes("screenId:action.screenId"),"CRM controls must carry canonical screen identity to consumers");

// NT-02: the same module contract must resolve both CRM and Operations.
// Operations uses the inherited purchase catalog; no parallel schema or UX resolver.
const operationsScreens=screens.slice(screens.indexOf(" OPE:["),screens.indexOf(" ROT:[",screens.indexOf(" OPE:[")));
const operationsControls=controls.slice(controls.indexOf("  OPE:["),controls.indexOf("  ROT:[",controls.indexOf("  OPE:[")));
const operationsJourneys=journeys.slice(journeys.indexOf("  OPE:[{"),journeys.indexOf("  ROT:[{",journeys.indexOf("  OPE:[{")));
assert(operationsScreens.includes('screen("purchases"') && operationsScreens.includes('"/operacoes?tab=purchases"'),"Operations purchase route must retain its verified module tab");
for(const label of ["Nova compra","Central de Fornecedores"])
  assert(operationsControls.includes('label:"'+label+'",screenId:"purchases"'),"Operations control must reference canonical purchases screen: "+label);
const oeSteps=[...operationsJourneys.matchAll(/\{screenId:"([^"]+)"(?:,controlLabel:"([^"]+)")?/g)];
assert.equal(oeSteps.length,3,"Pilot Operations purchase journey must keep its three verified steps");
for(const [,screenId,controlLabel] of oeSteps){
  assert.equal(screenId,"purchases","Operations purchase journey must not refer to other module screens");
  if(controlLabel)assert(operationsControls.includes('label:"'+controlLabel+'",screenId:"'+screenId+'"'),"Operations procedure control/screen relationship missing: "+controlLabel);
}
for(const moduleKey of ["CRM","OPE"]){
  assert(screens.includes(" "+moduleKey+":"),"Shared screens catalog missing module "+moduleKey);
  assert(controls.includes(" "+moduleKey+":"),"Shared controls catalog missing module "+moduleKey);
  assert(journeys.includes(" "+moduleKey+":"),"Shared journeys catalog missing module "+moduleKey);
}
assert(original.includes("OPERACOES_ORIGINAL_RECOVERED"),"Operations must preserve source provenance instead of copying originals");


// NT-01: existing read-only CRM procedure references must point to a real control
// on the SAME canonical screen, never merely to a matching free-text label.
const crmJourneySection=journeys.slice(journeys.indexOf(" CRM:[{"),journeys.indexOf("  FIN:[{"));
assert(crmJourneySection.startsWith(" CRM:[{"),"CRM journey section must exist");
const journeySteps=[...crmJourneySection.matchAll(/\{screenId:"([^"]+)"(?:,controlLabel:"([^"]+)")?/g)];
const crmControlsByLabel=new Map(actionRecords.map(([,id,label])=>[label,id]));
assert(journeySteps.length>0,"CRM must retain its documented consultation steps");
const matchedControlLabels=new Set();
for(const [,stepScreen,label] of journeySteps){
  assert(screenIds.has(stepScreen),"CRM procedure uses an unknown screen: "+stepScreen);
  if(!label)continue;
  assert(crmControlsByLabel.has(label),"CRM procedure uses an unknown control: "+label);
  assert.equal(crmControlsByLabel.get(label),stepScreen,"CRM procedure links control to wrong screen: "+label);
  assert(!matchedControlLabels.has(label),"CRM procedure repeats a control ambiguously: "+label);
  matchedControlLabels.add(label);
}
assert(matchedControlLabels.size>0,"CRM procedure-to-control links must not disappear");
// Coverage is intentionally partial until UX/content PR #913 is reconciled.
// Do not invent consultation steps, promote them to homologated procedures or
// modify the UX-owned renderer merely to satisfy this technical contract.

for(const key of ["label:action.label","observed:action.expectedEffect","confirmation:action.confirmation","limitation:action.limit"])
  assert(controls.includes(key),"CRM controls must preserve original contract: "+key);
for(const label of ["Registrar resultado","Confirmar resultado","Próximo atendimento","Adiar atendimento","Concluir","Reabrir"])
  assert(crm.includes('label: "'+label+'"'),"CRM source control does not exist: "+label);
for(const id of ["CRM-ESTADO","CRM-05.03","CRM-PROCESSO","CRM-09.01","CRM-09.02","CRM-09.03","CRM-09.04","CRM-09.05"])
 assert(authority.includes('id:"'+id+'"'),"Original authority index missing: "+id);
assert.match(atlas,/setLevel\("module"\);\s*selectModuleArea\("conhecimento"\);\s*\}\}>Abrir Ficha Viva CRM e fontes/,"Gestor deve abrir área de Conhecimento e montar FM sob demanda");
// Never add an implicit writer, UAT approval, copied body or raw-document migration.
assert(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(/.test(discovery),"Discovery must remain read-only");
assert(original.includes("OPE:[{"),"Segundo módulo deve reutilizar o índice documental");
assert(original.includes("OPERACOES_ORIGINAL_RECOVERED"),"Operações deve referenciar original inspecionado, não copiar método");
assert(discovery.includes("não autorizam") && discovery.includes("sem cópia do original"),"Original authority must stay conservative");
assert(journeys.includes("não executa")||journeys.includes("não envia comando"),"Guided journeys cannot perform writes");
for(const key of ['FIN:[{','OPE:[{','ROT:[{','CAP:[{'])assert(journeys.includes(key),"Reuse already available for "+key);
// NT-03: a certificação de outro papel no mesmo módulo nunca valida a
// identidade declarada do especialista; histórico e revogações são por papel.
for(const contract of [
 "const declaredRole=module.specialist.trim()",
 'record.specialist_role.trim()===declaredRole',
 'const divergentCount=records.length-matched.length',
 'const decisions=matched.filter(record=>record.record_kind!=="proposta")',
 'state:!declaredRole?"papel não informado"',
 "não certificam esta identidade",
 "Nenhuma certificação vigente correspondente ao papel declarado",
]) assert(mandates.includes(contract),"NT-03 mandate identity segregation missing: "+contract);
assert(!mandates.includes('const decisions=records.filter(record=>record.record_kind!=="proposta")'),
 "NT-03 mandate must not certify a role using unrelated module decisions");

// P3 AC-02: differentiated non-sensitive failure classes permit a surgical
// production diagnosis without authorizing writes or exposing token/payload.
const ac02Read=read("src/components/nucleo/NucleoAc02ContinuityRead.tsx");
for(const status of [401,403,404,500,503])
 assert(ac02Read.includes('status==='+status),"AC-02 must classify HTTP "+status+" without leaking response bodies");
for(const kind of ["FunctionsHttpError","FunctionsFetchError","FunctionsRelayError"])
 assert(ac02Read.includes('name==="'+kind+'"'),"AC-02 must differentiate invocation error "+kind);
assert(ac02Read.includes('explainAc02ReadFailure(invokeError)'),"AC-02 must present classified invoke error instead of generic fallback");
for(const reason of ["JSON inválido","Corpo inválido","Informe module_code válido e opções booleanas include_review/include_ac02","Utilize módulo operacional externo"])
 assert(ac02Read.includes(reason),"P3 must recognize known server-side HTTP 400 contract categories: "+reason);
assert(ac02Read.includes("response.clone().json()"),"P3 must inspect a clone without consuming server response");
assert(ac02Read.includes("classification=await classifyAc02ContractRejection(invokeError)"),"P3 must present only classified server contract failures");
assert(!ac02Read.includes("JSON.stringify(parsed)")&&!ac02Read.includes("JSON.stringify(invokeError)"),"P3 must not expose raw server error contents");
assert(!ac02Read.includes("console.error("),"AC-02 may not log possibly sensitive exceptions");
console.log("Núcleo A+: CRM and other modules share a read-only guided journey, source and control contract.");
