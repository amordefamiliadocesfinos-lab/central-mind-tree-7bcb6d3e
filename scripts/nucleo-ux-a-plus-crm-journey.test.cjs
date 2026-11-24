#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8").replace(/\r\n/g,"\n");
const a=read("src/components/nucleo/NucleoOperationalAtlas.tsx");
const d=read("src/components/nucleo/NucleoModuleDiscovery.tsx");
const g=read("src/components/nucleo/NucleoGuidedJourneys.tsx");
const actions=read("src/lib/nucleo/moduleControlDiscoveriesV12.ts");
const screens=read("src/lib/nucleo/moduleScreenDiscoveriesV12.ts");
const refs=read("src/lib/nucleo/moduleOriginalSourcesV12.ts");
const journeys=read("src/lib/nucleo/moduleJourneysV12.ts");
const stages=["modulo","telas","funcionalidades","procedimentos","especialista","conhecimento","desenvolvimento","evidencias"];
for(const stage of stages)assert(a.includes('id:"'+stage+'"'),"Missing stage: "+stage);
for(const [src,needle,why] of [
 [a,'aria-label={"Jornada funcional — "+selected.name}',"Accessible cross-module navigation"],
 [a,'openModuleStage(step.id)',"Stage clickable"],
 [a,'selectModuleArea(area)',"Reuse module section"],
 [a,'nucleo-crm-module-summary',"Purpose header focus"],
 [a,'nucleo-module-evidence',"Real M4 entry focus"],
 [a,'setLevel("module");\n                  selectModuleArea("conhecimento");',"Gestor FM jump must open knowledge"],
 [a,'if ((fmDraftState.dirty || specialistDraftState.dirty) && !window.confirm(',"Protected document draft"],
 [a,'<NucleoModuleKnowledge',"Existing living module file"],
 [a,'<NucleoSpecialistContributions',"Existing AC-01 specialist"],
 [a,'<NucleoTechnicalEvidence',"Existing M4 evidence"],
 [a,'<NucleoMandateRegistry',"Authority contract retained"],
 [d,'nucleo-crm-screens',"Real screen section"],
 [d,'nucleo-crm-controls',"Real control section"],
 [d,'Ver procedimentos orientados',"Controls link to guide"],
 [d,'target="_blank" rel="noopener noreferrer"',"Opened operational route keeps the Nucleo context"],
 [d,'<NucleoGuidedJourneys',"Existing guided procedures retained"],
 [g,'nucleo-crm-procedures',"Procedure section"],
 [g,'selected.steps.map((journeyStep,index)',"Direct task step buttons"],
 [g,'aria-pressed={index===activeIndex}',"Accessible step state"],
 [g,'não salva progresso',"Progress not fictional"],
 [actions,'CRM:CRM_ACTIONS.map',"No invented controls"],
 [screens,'CRM:CRM_SCREENS.map',"No invented route"],
 [refs,'CRM:CRM_AUTHORITY_SOURCES_V12',"Original source metadata reused"],
 [journeys,'CRM:[{',"Existing CRM operator tasks reused"]
])assert(src.includes(needle),why);
assert(!a.includes('setKnowledgeOpen(true);setLevel("module");'),"Prevent regressed unreachable FM");
// UX/UI 3: navegar entre etapas precisa transferir o foco ao conteúdo novo.
assert(g.includes('const stepHeadingRef=useRef<HTMLHeadingElement|null>(null)'),"Step heading focus ref");
assert(g.includes('stepHeadingRef.current?.focus()'),"Step navigation moves keyboard/screen reader focus");
assert(g.includes('ref={stepHeadingRef} tabIndex={-1}'),"Step heading accepts programmatic focus");
console.log("UX A+ CRM: module > screens > controls > procedure > specialist > knowledge > development > M4 PASS");
