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
 'Rascunho de documento não salvo neste módulo.',
 'Resultado indeterminado. Reconsulte o Core e reconcilie a proposta',
 'role={uncertainRef.current?"alert":"status"}',
])assert(contributions.includes(token),"AC-01 status visual ausente: "+token);
assert(contributions.indexOf('Resultado indeterminado. Reconsulte o Core')<contributions.indexOf('<nav aria-label="Ciclo documental AC-01'),"Alerta de reconciliação precisa anteceder navegação");
assert(ac02.includes('Consultando contexto AC-02 no Core.'),"Consulta AC-02 precisa de status explícito");
assert(ac02.includes('{error&&<p role="alert"'),"Erro AC-02 permanece alerta");
// AC-01: seleção de versão deve ser transacional para a minuta local.
const selector=contributions.slice(contributions.indexOf(' const chooseReference=(id:string)=>{'),contributions.indexOf(' const parent=rows.find(item=>item.id===parentId);'));
assert(selector.includes('if(id===parentId||saving||reading||Boolean(readError)||uncertainRef.current||fence.blocked)return;'),"Não trocar origem em leitura falha ou escrita indeterminada");
assert(selector.indexOf('if(draftDirty&&!window.confirm(')<selector.indexOf('setParentId(id);'),"Confirmar descarte antes de alterar seleção");
assert(contributions.includes('onChange={e=>chooseReference(e.target.value)}'),"Seletor usa única guarda de minuta");
const vm=require("node:vm");
const executable=selector.replace('id:string','id')+'; chooseReference(target);';
function simulateReference({target,parentId,dirty=false,confirm=true,reading=false,readError="",saving=false,uncertain=false}){
 const calls=[];let prompts=0;
 const rows=[{id:"rev2",specialist_role:"Especialista A",contribution_kind:"manual",
  title:"Versão A",source_kind:"git",source_locator:"docs/origem",note:"Origem",source_checksum_sha256:null}];
 const setters={setParentId:v=>calls.push(["parent",v]),setRole:v=>calls.push(["role",v]),
  setKind:v=>calls.push(["kind",v]),setTitle:v=>calls.push(["title",v]),
  setSourceKind:v=>calls.push(["sourceKind",v]),setLocator:v=>calls.push(["locator",v]),
  setNote:v=>calls.push(["note",v]),setChecksum:v=>calls.push(["checksum",v]),
  setFeedback:v=>calls.push(["feedback",v])};
 vm.runInNewContext(executable,{target,parentId,draftDirty:dirty,saving,reading,readError,
  uncertainRef:{current:uncertain},fence:{blocked:false},window:{confirm:()=>{prompts++;return confirm;}},
  rows,declaredRole:"Especialista original",...setters});
 return {calls,prompts};
}
assert.deepEqual(simulateReference({target:"rev2",parentId:"",dirty:true,confirm:false}).calls,[],
 "Cancelar substituição preserva a minuta e a seleção");
assert.equal(simulateReference({target:"rev2",parentId:"",dirty:true,confirm:false}).prompts,1,
 "Troca de referência com minuta exige confirmação humana");
assert.deepEqual(simulateReference({target:"rev2",parentId:"",dirty:true,confirm:true}).calls[0],
 ["parent","rev2"],"A troca aceita seleciona a referência após confirmação");
assert.deepEqual(simulateReference({target:"",parentId:"rev2",dirty:true,confirm:true}).calls,
 [["parent",""],["role","Especialista original"],["kind","metodo"],["title",""],
  ["sourceKind","referencia_privada"],["locator",""],["note",""],["checksum",""],["feedback",""]],
 "Voltar a nova contribuição não deixa dados da versão anterior");
assert.deepEqual(simulateReference({target:"rev2",parentId:"",dirty:false,readError:"Parcial"}).calls,[],
 "Falha de leitura impede troca de origem");
assert.deepEqual(simulateReference({target:"rev2",parentId:"",dirty:false,uncertain:true}).calls,[],
 "Resultado indeterminado impede troca de origem");
assert.deepEqual(simulateReference({target:"rev2",parentId:"rev2",dirty:true}).calls,[],
 "Retorno à mesma referência preserva contexto");
// Reconsulta AC-01: não converter recorte incompleto em versão excluída.
for(const term of [
 'const referenceMissing=Boolean(parentId&&!reading&&!readError&&!parent)',
 'if(saving||reading||readError||uncertainRef.current||referenceMissing||!fence.ready||fence.blocked)return;',
 'disabled={reading||Boolean(readError)||saving||uncertainRef.current||referenceMissing||!fence.ready||fence.blocked}',
 'A versão de origem selecionada está aguardando reconsulta completa.',
 'A versão de origem selecionada não foi localizada na leitura atual.',
 'Não inferir exclusão.',
])assert(contributions.includes(term),"Reconsulta AC-01 não protege referência: "+term);
const missing=(parentId,reading,readError,found)=>Boolean(parentId&&!reading&&!readError&&!found);
assert.equal(missing("v1",true,"",false),false,"Durante consulta: ausência é indeterminada");
assert.equal(missing("v1",false,"Falha",false),false,"Falha de leitura não certifica versão ausente");
assert.equal(missing("v1",false,"",false),true,"Leitura completa sem referência bloqueia registro");
assert.equal(missing("v1",false,"",true),false,"Versão presente continua válida");
assert.equal(missing("",false,"",false),false,"Nova proposta não exige versão anterior");
// Reconciliação AC-01: request_id sozinho não comprova os dados enviados.
const start=contributions.indexOf('const isMatchingPendingAttempt=');
const end=contributions.indexOf('type ACDB=',start);
assert(start>=0&&end>start,"Validador de tentativa imutável presente");
assert(contributions.includes('const pendingAttemptRef=useRef<PendingAttempt|null>(null)'),"Guardar snapshot da tentativa");
assert(contributions.includes('const attempt=pendingAttemptRef.current;'),"Reconsulta usa snapshot original");
assert(contributions.includes('prior&&attempt&&isMatchingPendingAttempt(prior,attempt)'),"Reconciliar somente correspondência integral");
assert(contributions.includes('!isMatchingPendingAttempt(check.data,attempt)'),"Readback imediato tem a mesma guarda");
assert(contributions.includes('Registro com o mesmo identificador localizado, mas os dados da tentativa não foram integralmente confirmados.'),"Divergência explícita");
assert(contributions.includes('uncertainRef.current=false;requestRef.current=null;pendingAttemptRef.current=null;'),"Liberar estado só após correspondência");
const vmAttempt=require("node:vm");
const matcherSource=contributions.slice(start,end)
 .replace('=(row:RecordRow,attempt:PendingAttempt)=>','=(row,attempt)=>');
const matcher=vmAttempt.runInNewContext(matcherSource+';isMatchingPendingAttempt');
const attempt={requestId:"req-1",moduleId:"mod-1",specialistRole:"Especialista",
 contributionKind:"manual",title:"Fonte",sourceKind:"git",sourceLocator:"docs/origem",
 checksum:null,note:"Observação",parentRevisionId:null,versionNo:1,authorityState:"proposta",authUid:"user-a",lineageId:"lineage-a"};
const row={request_id:attempt.requestId,module_id:attempt.moduleId,
 specialist_role:attempt.specialistRole,contribution_kind:attempt.contributionKind,
 title:attempt.title,source_kind:attempt.sourceKind,source_locator:attempt.sourceLocator,
 source_checksum_sha256:attempt.checksum,note:attempt.note,parent_revision_id:attempt.parentRevisionId,
 version_no:attempt.versionNo,authority_state:attempt.authorityState,recorded_by_auth_uid:"user-a",recorded_at:"2026-11-24T20:00:00Z",lineage_id:"lineage-a"};
assert.equal(matcher(row,attempt),true,"Snapshot igual pode ser reconciliado");
for(const [field,value] of [
 ["title","Título alterado"],["source_locator","docs/outra"],["note","Diferente"],
 ["source_checksum_sha256","sha"],["request_id","req-2"],["version_no",2],
 ["module_id","mod-2"],["authority_state","homologado"],["parent_revision_id","rev-x"],
 ["specialist_role","Outro"],["contribution_kind","mapa"],["source_kind","drive"],
 ["recorded_by_auth_uid","user-b"],["recorded_at","invalid"],["lineage_id","lineage-b"]
])assert.equal(matcher({...row,[field]:value},attempt),false,"Rejeitar divergência: "+field);
console.log("UX A+ specialist: progressive identity, mandates, AC-01 and AC-02 with preserved draft guards PASS");

// P6 UX-H05: human-facing role and primary continuation without altering AC02 contract.
assert(src.includes("Quem acompanha e como continuar")&&src.includes("Retomar trabalho e contexto"),"Human role and resume");
assert(src.includes("Nenhum vínculo textual encontrado nesta leitura; isso não significa ausência de trabalho."),"No absence inference");
assert(src.indexOf("<NucleoAc02ContinuityRead key={selectedRecord.id}")<src.indexOf('aria-label="F5 — checkpoints e próximos passos M3 do módulo"'),"Preparation precedes historical details");
assert(continuation.indexOf("Preparar contexto de continuidade")<continuation.indexOf('aria-label="Conferir contexto antes da assunção"'),"Primary prepare action before ancillary navigation");
