#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const text=fs.readFileSync("src/components/nucleo/NucleoOperationalAtlas.tsx","utf8");
for(const token of ['const [specialistVisited,setSpecialistVisited]=useState(false)','const [knowledgeVisited,setKnowledgeVisited]=useState(false)','setSpecialistVisited(false)','setKnowledgeVisited(false)']) assert(text.includes(token),"Escopo por módulo: "+token);
assert.match(text,/if \(area === "especialista"\) setSpecialistVisited\(true\)/);
assert.match(text,/setKnowledgeVisited\(true\)/);
assert.match(text,/selectedRecord && \(moduleSection==="especialista" \|\| specialistVisited\)/);
assert.match(text,/hidden=\{moduleSection!=="especialista"\}/);
assert.match(text,/selectedRecord && \(moduleSection==="conhecimento" \|\| knowledgeVisited\)/);
assert.match(text,/hidden=\{moduleSection!=="conhecimento"\}/);
assert.match(text,/hidden=\{!knowledgeOpen\}/);
assert.match(text,/onClick=\{\(\) => selectModuleArea\("especialista"\)\}/);
assert.match(text,/onClick=\{\(\) => selectModuleArea\("conhecimento"\)\}/);
for(const name of ['NucleoMandateRegistry','NucleoSpecialistContributions','NucleoModuleKnowledge'])assert(text.includes('<'+name),"Não remover componente "+name);
assert.match(text,/Nenhuma aprovação é inferida/);
// V1.3 UX-3: mesma frente M3, mesmo contexto FM-09, sem espelhar dados.
const fm=fs.readFileSync("src/components/nucleo/NucleoModuleKnowledge.tsx","utf8");
for(const token of [
 'const [fmSectionRequest,setFmSectionRequest]',
 'const openFm09Continuity=()=>',
 'setFmSectionRequest(previous=>({section:"FM-09",seq:(previous?.seq??0)+1}))',
 'onClick={openFm09Continuity}',
 'onOpenWorkstream={onSelectWorkstream}',
 'requestedSection={fmSectionRequest}',
 'setFmSectionRequest(null)',
])assert(text.includes(token),"Retomada M3 / FM-09: "+token);
for(const token of [
 'requestedSection?:{section:FMSection;seq:number}|null',
 'if(requestedSection?.section && !saving && !draftDirty && !writeUncertain && !fence.blocked)',
 'onClick={()=>onOpenWorkstream(front.id)}',
 'Abrir ficha M3 desta frente',
 'onOpenWorkstream&&',
])assert(fm.includes(token),"Ficha FM-09: "+token);
assert(text.includes('selectedRecord && (moduleSection==="conhecimento" || knowledgeVisited)'),"Preservar a Ficha Viva montada");
// A+ FM-09: navegação não deve sobrepor rascunho nem salvar por inferência.
const fm09Handler=text.slice(text.indexOf('  const openFm09Continuity=()=>{'),text.indexOf('  const openAc01FromFm='));
assert(fm09Handler.includes('if(fmDraftState.busy||specialistDraftState.busy)'),"Bloquear atalhos durante gravação");
assert(fm09Handler.includes('if(fmDraftState.dirty)'),"Bloquear remapeamento de rascunho");
assert(fm09Handler.indexOf('if(fmDraftState.dirty)')<fm09Handler.indexOf('setFmSectionRequest(previous=>'),"Verificar rascunho antes de alterar seção");
assert(fm.includes('requestedSection?.section && !saving && !draftDirty'),"Guarda defensiva no efeito FM");
// A troca confirmada deve limpar os três campos ANTES de alterar a seção.
const switchFn=fm.slice(fm.indexOf('  const changeSection = (next: FMSection) => {'),fm.indexOf('  const prepareReference = () => {'));
assert(switchFn.includes('if (next === section || saving || writeUncertain || fence.blocked) return;'),"Sem troca durante gravação ou sem mudança");
assert(switchFn.includes('if (draftDirty) {'),"Só consultar descarte com minuta");
assert(switchFn.includes('if (!window.confirm('), "Cancelamento deve preservar minuta");
for(const token of ['setTitle("");','setBody("");','setSource("");','setValidationError(null);'])
  assert(switchFn.includes(token),"Descartar minuta precisa limpar "+token);
assert(switchFn.indexOf('setValidationError(null);')<switchFn.indexOf('setSection(next);'),"Limpar minuta antes de selecionar seção FM");
const vm=require("node:vm");
const executable=switchFn.replace('next: FMSection','next')+'; changeSection(target);';
function simulateSwitch({dirty,confirm,save,from,to,uncertain=false,blocked=false}){
  const calls=[];
  const setters={setTitle:v=>calls.push(['title',v]),setBody:v=>calls.push(['body',v]),
    setSource:v=>calls.push(['source',v]),setValidationError:v=>calls.push(['error',v]),
    setSection:v=>calls.push(['section',v])};
  let prompts=0;
  vm.runInNewContext(executable,{section:from,saving:save,draftDirty:dirty,writeUncertain:uncertain,fence:{blocked},
    window:{confirm:()=>{prompts++;return confirm;}},target:to,...setters});
  return {calls,prompts};
}
assert.deepEqual(simulateSwitch({dirty:true,confirm:false,save:false,from:'FM-01',to:'FM-09'}).calls,[],"Cancelar não troca nem descarta");
assert.equal(simulateSwitch({dirty:true,confirm:false,save:false,from:'FM-01',to:'FM-09'}).prompts,1,"Confirmar descarte de minuta");
assert.deepEqual(simulateSwitch({dirty:true,confirm:true,save:false,from:'FM-01',to:'FM-09'}).calls,
  [['title',''],['body',''],['source',''],['error',null],['section','FM-09']],"Descartar antes de mudar de seção");
assert.deepEqual(simulateSwitch({dirty:false,confirm:false,save:false,from:'FM-01',to:'FM-09'}).calls,
  [['section','FM-09']],"Sem rascunho: manter transição direta");
assert.deepEqual(simulateSwitch({dirty:true,confirm:true,save:true,from:'FM-01',to:'FM-09'}).calls,
  [],"Gravação bloqueia troca");
assert.deepEqual(simulateSwitch({dirty:true,confirm:true,save:false,from:'FM-01',to:'FM-01'}).calls,
  [],"Retorno sucessivo à mesma seção não altera minuta");
assert.deepEqual(simulateSwitch({dirty:true,confirm:true,save:false,from:'FM-01',to:'FM-09',uncertain:true}).calls,
  [],"Gravação indeterminada bloqueia troca da seção");
// UX-3: distinguir rascunho, gravação e falha de leitura na Ficha Viva.
for(const token of [
 'Registrando revisão no Core. Não altere a seção até a confirmação da operação.',
 'Rascunho não salvo em {section}.',
 'Cobertura indeterminada — erro de leitura',
 '{error&&<p role="alert"',
])assert(fm.includes(token),"Ficha Viva sem aviso contextual: "+token);
assert(fm.indexOf('Rascunho não salvo em {section}.')<fm.indexOf('<section aria-label="Cobertura documental por seção"'),"Aviso de minuta deve anteceder troca de seção");
// UX-01: o cartão executivo acompanha a frente que motivou o destaque.
for(const token of [
 'const focusFront = critical.find(front=>front.next_action.trim()) ?? critical[0]',
 'const actionOwner = focusFront ?? record;',
 'Frente em atenção:',
 'Bloqueio declarado:',
 'Próxima ação {focusFront?"da frente":"do módulo"}:',
 'actionOwner?.next_action.trim()||"não cadastrada no Core para este recorte"',
])assert(text.includes(token),"UX-01 atenção executiva: "+token);
assert(!text.includes('Próxima ação: {record?.next_action.trim()'),"Não atribuir ação do módulo à frente prioritária");
// UX-01: painel transversal liga frente e próxima ação ao mesmo registro M3.
const coverage=fs.readFileSync("src/components/nucleo/NucleoCrossModuleCoverage.tsx","utf8");
for(const token of [
 'const attentionFront=fronts.find(front=>front.status==="bloqueado")',
 'fronts.find(front=>front.priority==="critica")',
 'fronts.find(front=>front.status!=="concluido"&&front.next_action.trim())',
 'Frente em atenção: {attentionFront.code} · {attentionFront.title}',
 'Próxima ação da frente:',
 'attentionFront.next_action.trim()||"não informada no Core"',
 'Próxima ação do módulo:',
 'Sem frente M3 vinculada — situação da operação não verificada',
 'Especialista:',
 'onClick={()=>onOpenModule(module)}',
])assert(coverage.includes(token),"UX-01 cobertura transversal: "+token);
assert(!coverage.includes('Próxima ação declarada: {record?.next_action.trim()'),"Não confundir ação do módulo com frente de atenção");
// A matriz preserva a identidade visual herdada, sem introduzir paleta paralela.
assert(coverage.includes('className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"'));
assert(coverage.includes('className="rounded-lg border p-4 space-y-2 min-w-0"'));
// Work UX-01 / achados UX01-01, UX01-02, UX01-03: testes do contrato visual.
const center=fs.readFileSync("src/components/nucleo/NucleoDevelopmentCenter.tsx","utf8");
for(const token of [
 'const [moduleSearchRequestSeq,setModuleSearchRequestSeq] = useState(0)',
 'const openModuleSearch=()=>{',
 'setAtlasVisited(true)',
 'setAtlasExpanded(true)',
 'setModuleSearchRequestSeq(seq=>seq+1)',
 'Buscar módulo',
 'searchRequestSeq={moduleSearchRequestSeq}',
])assert(center.includes(token),"UX-01 atalho de busca: "+token);
for(const token of [
 'searchRequestSeq?: number',
 'searchRequestSeq = 0',
 'setLevel("overview")',
 'getElementById("nucleo-atlas-module-search")',
 'field?.focus({preventScroll:true})',
 'id="nucleo-atlas-module-search"',
 'return [...byCode.values()].filter(module=>module.id!=="NUC")',
 'const pending=fronts.some(front=>front.status!=="concluido")',
 'rank:critical.length>0?0:pending?1:record&&fronts.length===0?2:!record?3:4',
])assert(text.includes(token),"UX-01 foco/contagem/prioridade: "+token);
assert(text.includes('label:"Módulos no Core", value:summary.modules'),"Contagem operacional deve permanecer no Core");
assert(text.includes('modules: registeredModules.length'),"Não contar NUC como módulo acompanhado");
console.log("UX-A3B: acesso contextual bidirecional, painéis montados após visita, autoridades preservadas");
