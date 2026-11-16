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
[s,'const draftBusy=saving||uncertainRef.current',"Uncertain AC01 never discarded"],
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
const attempt={moduleId:"mod-a",sectionCode:"FM-09",versionNo:7,title:"Título",body:"Texto original",sourceReference:"docs/origem.md"};
const row={module_id:attempt.moduleId,section_code:attempt.sectionCode,version_no:attempt.versionNo,
 title:attempt.title,body:attempt.body,source_reference:attempt.sourceReference,
 authority_state:"rascunho",evidence_level:"declarado"};
assert.equal(matcher(row,attempt),true,"Correspondência total confirma a revisão");
for(const [key,wrong] of [
 ["module_id","outro"],["section_code","FM-08"],["version_no",8],["title","Diferente"],
 ["body","Mudado"],["source_reference","outro.md"],["authority_state","homologado"],
 ["evidence_level","uso_real_verificado"]
])assert.equal(matcher({...row,[key]:wrong},attempt),false,"Rejeitar divergência "+key);
assert(k.includes('onDraftStateChange?.({dirty:draftDirty,busy:saving||writeUncertain})'),"Estado indeterminado propaga bloqueio ao Atlas");
assert(k.includes('if(loading||error||saving||writeUncertain) return;'),"Nova escrita bloqueada após gravação ambígua");
assert(k.includes('if (next === section || saving || writeUncertain) return;'),"Troca de seção bloqueada");
assert(k.includes('sameVersion.length===1&&matchesPendingFmAttempt(sameVersion[0],pending)'),"Só confirmar pela versão única e integral");
assert(k.includes('setWriteUncertain(true);'),"Falhas tornam a gravação indeterminada");
assert(k.includes('setReconciliationNotice("Revisão anteriormente enviada localizada'),"Confirmação é status informativo");
assert(k.includes('Tentativa anterior não localizada neste recorte. Estado continua indeterminado; não repetir a gravação.'),"Ausência no recorte não permite repetição");
console.log("UX V2.4 document drafts and write guards PASS");
