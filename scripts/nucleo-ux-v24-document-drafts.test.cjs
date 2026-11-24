#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const a=fs.readFileSync("src/components/nucleo/NucleoOperationalAtlas.tsx","utf8");
const k=fs.readFileSync("src/components/nucleo/NucleoModuleKnowledge.tsx","utf8");
const s=fs.readFileSync("src/components/nucleo/NucleoSpecialistContributions.tsx","utf8");
for(const [src,t,reason] of [
[a,'fmDraftState.busy || specialistDraftState.busy',"Blocked during writes"],
[a,'fmDraftState.dirty || specialistDraftState.dirty',"Discard prompt"],
[a,'onDraftStateChange={setSpecialistDraftState}',"Specialist callback"],
[a,'onDraftStateChange={setFmDraftState}',"Ficha Viva callback"],
[k,'const draftDirty=Boolean(title.trim()||body.trim()||source.trim())',"FM editing"],
[s,'const draftBusy=saving||uncertainRef.current||fence.blocked',"Uncertain AC01 never discarded"],
[s,'row.authority_state===attempt.authorityState',"AC01 readback preserved by full snapshot"],
[k,'authority_state:"rascunho"',"FM authority preserved"],
[k,'.eq("id",result.data.id).maybeSingle()',"FM readback preserved"],
]){
assert(src.includes(t),reason);}
assert(k.includes('window.addEventListener("beforeunload",warn)'));
assert(s.includes('window.addEventListener("beforeunload",warn)'));
// FM: uma escrita ambígua nunca pode ser liberada apenas por atualizar a leitura.
const pendingSource=k.slice(k.indexOf('const matchesPendingFmAttempt='),k.indexOf('type DraftState='));
assert(pendingSource.includes('row.version_no===pending.versionNo'),"Verificar versão");
assert(pendingSource.includes('row.body===pending.body'),"Verificar texto integral");
assert(pendingSource.includes('row.source_reference===pending.sourceReference'),"Verificar origem");
assert(pendingSource.includes('row.authority_state==="rascunho"'),"Nunca inferir homologação");
const vm=require("node:vm");
const matcher=vm.runInNewContext(pendingSource.replace('=(row:Revision,pending:PendingFmAttempt)=>','=(row,pending)=>')+';matchesPendingFmAttempt');
const attempt={moduleId:"mod-a",sectionCode:"FM-09",versionNo:7,title:"Título",body:"Texto original",sourceReference:"docs/origem.md",authUid:"user-a"};
const row={module_id:attempt.moduleId,section_code:attempt.sectionCode,version_no:attempt.versionNo,
 title:attempt.title,body:attempt.body,source_reference:attempt.sourceReference,
 authority_state:"rascunho",evidence_level:"declarado",recorded_by_auth_uid:"user-a",recorded_at:"2026-11-24T20:00:00Z"};
assert.equal(matcher(row,attempt),true,"Correspondência total confirma a revisão");
for(const [key,wrong] of [
 ["module_id","outro"],["section_code","FM-08"],["version_no",8],["title","Diferente"],
 ["body","Mudado"],["source_reference","outro.md"],["authority_state","homologado"],
 ["evidence_level","uso_real_verificado"],["recorded_by_auth_uid","user-b"],["recorded_at","invalid"]
])assert.equal(matcher({...row,[key]:wrong},attempt),false,"Rejeitar divergência "+key);
assert(k.includes('onDraftStateChange?.({dirty:draftDirty,busy:saving||writeUncertain||fence.blocked})'),"Estado indeterminado propaga bloqueio ao Atlas");
assert(k.includes('if(loading||error||saving||writeUncertain||!fence.ready||fence.blocked) return;'),"Nova escrita bloqueada após gravação ambígua");
assert(k.includes('if (next === section || saving || writeUncertain || fence.blocked) return;'),"Troca de seção bloqueada");
assert(k.includes('sameVersion.length===1&&matchesPendingFmAttempt(sameVersion[0],pending)'),"Só confirmar pela versão única e integral");
assert(k.includes('setWriteUncertain(true);'),"Falhas tornam a gravação indeterminada");
assert(k.includes('setReconciliationNotice("Revisão anteriormente enviada localizada'),"Confirmação é status informativo");
assert(k.includes('Tentativa anterior não localizada neste recorte. Estado continua indeterminado; não repetir a gravação.'),"Ausência no recorte não permite repetição");
// Recarregamento de página: o bloqueio persistente não pode armazenar minuta
// ou tokens e deve usar identidade autenticada, escopo e fail-closed.
const fence=fs.readFileSync("src/lib/nucleo/pendingWriteFenceV1.ts","utf8");
for(const token of [
 'data.user.id,kind,moduleId',
 'window.localStorage.setItem(key,witness?JSON.stringify(witness):"pending")',
 'const blocked=raw!==null',
 'window.localStorage.removeItem(key)',
 'setState({ready:false,blocked:true,witness:null})',
 'if(!key||!state.ready||state.blocked|| (witness&&',
 'event==="SIGNED_OUT"',
])assert(fence.includes(token),"Trava persistente incompleta: "+token);
assert(!/localStorage\.setItem\([^\n]*(?:body|title|source|token|attempt)/.test(fence),
  "Não salvar conteúdo documental ou credenciais no armazenamento local");
assert(k.includes('const fence=usePendingWriteFence("fm",moduleId)'),"FM usa trava por módulo");
assert(s.includes('const fence=usePendingWriteFence("ac01",moduleId)'),"AC-01 usa trava por módulo");
assert(k.includes('if(!fence.markStarted(witness))'),"FM grava marcador ANTES do envio");
assert(s.includes('if(!fence.markStarted(witness))'),"AC-01 grava marcador ANTES do envio");
assert(k.includes('&&fence.clearConfirmed()'),"FM só libera após leitura conferida");
assert(s.includes('&&fence.clearConfirmed()'),"AC-01 só libera após readback integral");
assert(k.includes('Sem o conteúdo original em memória, a liberação automática não é segura'),
  "FM não libera após reload sem snapshot");
assert(s.includes('O conteúdo da minuta não foi salvo no navegador'),
  "AC-01 não promete restauração de minuta");
// A liberação da trava persistente só é permitida por testemunho e prova de leitura.
const witnessSource=fs.readFileSync("src/lib/nucleo/writeRecoveryWitnessV1.ts","utf8");
for(const token of [
 'const salt=crypto.randomUUID()',
 'crypto.subtle.digest("SHA-256",bytes)',
 'witnessFieldsFm',
 'witnessFieldsAc01',
 'isWriteWitness',
])assert(witnessSource.includes(token),"Testemunho técnico: "+token);
for(const token of [
 'window.localStorage.getItem(key)!==JSON.stringify(witness)',
 'await fingerprint(fields,witness.salt)!==witness.digest',
 'identity.requestId!==witness.requestId',
 'identity.section!==witness.section||identity.version!==witness.version',
 'if(!key||!state.ready||!state.blocked||!witness)return false',
])assert(fence.includes(token),"Reconciliador conservador: "+token);
assert(k.includes('Reconciliar trava FM com o Core'),"FM requer ação expressa");
assert(s.includes('Reconciliar trava AC-01 com o Core'),"AC-01 requer ação expressa");
assert(k.includes('result.data.length!==1'),"FM rejeita ambiguidade de leitura");
assert(s.includes('result.data.length!==1'),"AC-01 rejeita ambiguidade de leitura");
assert(k.includes('await fence.verifyAndClear(witnessFieldsFm(row)'),"FM confere impressão");
assert(s.includes('await fence.verifyAndClear(witnessFieldsAc01(row)'),"AC-01 confere impressão");
// Governança de abas: leitura fresca antes de qualquer escrita, eventos de
// storage e remoção apenas do marcador correspondente ao readback atual.
for(const term of [
 'window.addEventListener("storage",handleStorage)',
 'window.removeEventListener("storage",handleStorage)',
 'event.key!==key&&event.key!==null',
 'if(window.localStorage.getItem(key)!==null)',
 'if(current===null)return false;',
 'witness?current!==JSON.stringify(witness):current!=="pending"',
])assert(fence.includes(term),"Proteção multiaba ausente: "+term);
assert(fence.indexOf('if(window.localStorage.getItem(key)!==null)')<
 fence.indexOf('window.localStorage.setItem(key,witness?JSON.stringify(witness):"pending")'),
 "A verificação do marcador deve anteceder a gravação");
assert(fence.includes('window.localStorage.getItem(key)!==JSON.stringify(witness)'),
 "Reconciliação criptográfica respeita atualização concorrente");
console.log("UX V2.4 document drafts and write guards PASS");
