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
for(const key of ['"contatos","inbox","tarefas"','route:item.route','source:item.source'])
  assert(screens.includes(key),"CRM screens must keep original routes/sources "+key);
for(const key of ["label:action.label","observed:action.expectedEffect","confirmation:action.confirmation","limitation:action.limit"])
  assert(controls.includes(key),"CRM controls must preserve original contract: "+key);
for(const label of ["Registrar resultado","Confirmar resultado","Próximo atendimento","Adiar atendimento","Concluir","Reabrir"])
  assert(crm.includes('label: "'+label+'"'),"CRM source control does not exist: "+label);
for(const id of ["CRM-ESTADO","CRM-05.03","CRM-PROCESSO","CRM-09.01","CRM-09.02","CRM-09.03","CRM-09.04","CRM-09.05"])
 assert(authority.includes('id:"'+id+'"'),"Original authority index missing: "+id);
// Never add an implicit writer, UAT approval, copied body or raw-document migration.
assert(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(/.test(discovery),"Discovery must remain read-only");
assert(discovery.includes("não autorizam") && discovery.includes("sem cópia do original"),"Original authority must stay conservative");
assert(journeys.includes("não executa")||journeys.includes("não envia comando"),"Guided journeys cannot perform writes");
for(const key of ['FIN:[{','OPE:[{','ROT:[{','CAP:[{'])assert(journeys.includes(key),"Reuse already available for "+key);
console.log("Núcleo A+: CRM and other modules share a read-only guided journey, source and control contract.");
