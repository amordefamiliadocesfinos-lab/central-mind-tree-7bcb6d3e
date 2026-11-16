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
for(const term of [
 'const specialistRole = selectedRecord?.specialist.trim() || ""',
 'moduleWork.filter(item => item.specialist.trim() === specialistRole)',
 'const specialistPending = specialistWork.filter(item => item.status !== "concluido")',
 'Pendências e evidências do papel declarado',
 'specialistPending.filter(item=>item.evidence_state!=="comprovada")',
 'events\n    .filter(event => specialistWork.some(item => item.id === event.workstream_id))',
 'não localizado nos 200 eventos globais carregados',
 'item.blocker.trim()||"Não registrado"',
 'item.next_action.trim()||"Não registrada"',
 'onClick={()=>onSelectWorkstream(item.id)}',
 'onClick={()=>selectModuleArea("desenvolvimento")}',
])assert(src.includes(term),"Specialist M3 continuity contract missing: "+term);
// AC-01: a consulta incompleta não vira fila vazia, e a gravação indeterminada
// não pode deslocar o contexto da minuta para outra etapa.
const contributions=fs.readFileSync("src/components/nucleo/NucleoSpecialistContributions.tsx","utf8");
for(const term of [
 'if(saving||uncertainRef.current)return;',
 'if(saving||uncertainRef.current){',
 'disabled={saving||uncertainRef.current}',
 'Registro em andamento ou indeterminado. Reconcilie antes de mudar de etapa.',
 'Consulta indisponível não significa ausência de propostas.',
 'readError||uncertainRef.current',
])assert(contributions.includes(term),"AC-01 continuity missing: "+term);
const external=contributions.slice(contributions.indexOf(' useEffect(()=>{\n  if(!requestedStage)return;'),contributions.indexOf(' const openPendingReview='));
assert(external.indexOf('if(saving||uncertainRef.current)return;')<external.indexOf('setFlowStep(step.id)'),"Pedido externo só altera etapa após guarda de gravação");
const ac02=fs.readFileSync("src/components/nucleo/NucleoAc02ContinuityRead.tsx","utf8");
assert(ac02.includes('!isSafe(response.ac02_assumption_export)||!isRegistry(response.ac02)'),"AC-02 fail-closed for partial response");
// UX-3: estados visíveis antes dos atalhos AC-01 e consulta AC-02.
for(const token of [
 'Registro em andamento. Aguarde a conferência no Core antes de navegar ou repetir.',
 'Minuta AC-01 não salva neste módulo.',
 'Resultado indeterminado. Reconsulte o Core e reconcilie a proposta',
 'role={uncertainRef.current?"alert":"status"}',
])assert(contributions.includes(token),"AC-01 status visual ausente: "+token);
assert(contributions.indexOf('Resultado indeterminado. Reconsulte o Core')<contributions.indexOf('<nav aria-label="Ciclo documental AC-01'),"Alerta de reconciliação precisa anteceder navegação");
assert(ac02.includes('Consultando contexto AC-02 no Core.'),"Consulta AC-02 precisa de status explícito");
assert(ac02.includes('{error&&<p role="alert"'),"Erro AC-02 permanece alerta");
console.log("UX A+ specialist: progressive identity, mandates, AC-01 and AC-02 with preserved draft guards PASS");
