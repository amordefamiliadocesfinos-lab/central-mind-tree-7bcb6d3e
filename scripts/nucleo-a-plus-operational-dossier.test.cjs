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
console.log("Núcleo A+: CRM and other modules share a read-only guided journey, source and control contract.");
