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
 'if(requestedSection?.section && !saving && !draftDirty && !writeUncertain)',
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
assert(switchFn.includes('if (next === section || saving || writeUncertain) return;'),"Sem troca durante gravação ou sem mudança");
assert(switchFn.includes('if (draftDirty) {'),"Só consultar descarte com minuta");
assert(switchFn.includes('if (!window.confirm('), "Cancelamento deve preservar minuta");
for(const token of ['setTitle("");','setBody("");','setSource("");','setValidationError(null);'])
  assert(switchFn.includes(token),"Descartar minuta precisa limpar "+token);
assert(switchFn.indexOf('setValidationError(null);')<switchFn.indexOf('setSection(next);'),"Limpar minuta antes de selecionar seção FM");
const vm=require("node:vm");
const executable=switchFn.replace('next: FMSection','next')+'; changeSection(target);';
function simulateSwitch({dirty,confirm,save,from,to,uncertain=false}){
  const calls=[];
  const setters={setTitle:v=>calls.push(['title',v]),setBody:v=>calls.push(['body',v]),
    setSource:v=>calls.push(['source',v]),setValidationError:v=>calls.push(['error',v]),
    setSection:v=>calls.push(['section',v])};
  let prompts=0;
  vm.runInNewContext(executable,{section:from,saving:save,draftDirty:dirty,writeUncertain:uncertain,
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
console.log("UX-A3B: acesso contextual bidirecional, painéis montados após visita, autoridades preservadas");
