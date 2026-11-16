#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const src=fs.readFileSync("src/components/nucleo/NucleoOperationalAtlas.tsx","utf8");
const required=[
 'const [specialistPanel,setSpecialistPanel]=useState<"papel"|"mandato"|"continuidade"|"documentos">("papel")',
 'const [specialistPanelVisited,setSpecialistPanelVisited]',
 'setSpecialistPanel("papel")',
 'setSpecialistPanelVisited([])',
 'setSpecialistPanel(id)',
 'if(id!=="papel")setSpecialistPanelVisited',
 'aria-label="Consultar aspectos do especialista"',
 'aria-pressed={specialistPanel===item.id}',
 'id="nucleo-specialist-papel"',
 'id="nucleo-specialist-mandato"',
 'id="nucleo-specialist-continuidade"',
 'id="nucleo-specialist-documentos"',
 'hidden={specialistPanel!=="documentos"}',
 'specialistPanelVisited.includes("documentos")',
 'specialistPanelVisited.includes("mandato")',
 'specialistPanelVisited.includes("continuidade")',
 '<NucleoMandateRegistry',
 '<NucleoAc02ContinuityRead',
 '<NucleoSpecialistContributions',
 'onDraftStateChange={setSpecialistDraftState}',
 'if ((fmDraftState.dirty || specialistDraftState.dirty) && !window.confirm(',
 'if (fmDraftState.busy || specialistDraftState.busy)',
 'Acompanhar frentes e pendências M3',
 'selectedProvenance.ownerBoundary',
 'SOURCE_AUTHORITY_LABELS[source.authority]',
];
for(const x of required)assert(src.includes(x),"Specialist UX missing "+x);
assert(src.includes('moduleSection==="especialista" && specialistPanel==="papel" && selectedProvenance'),"Source detail must not fill all modes");
assert(src.includes('onClick={() => selectModuleArea("conhecimento")}'),"Bidirectional AC01 link");
const continuation=fs.readFileSync("src/components/nucleo/NucleoAc02ContinuityRead.tsx","utf8");
assert(continuation.includes('status:"rascunho_nao_homologado"'),"No automatic assumption acceptance");
assert(continuation.includes('include_assumption_export:true'),"Use existing protected AC02 contract");
console.log("UX A+ specialist: progressive identity, mandates, AC-01 and AC-02 with preserved draft guards PASS");
