#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript"),assert=require("node:assert/strict");
const js=ts.transpileModule(fs.readFileSync("supabase/functions/_shared/nucleo/ac02-controlled-distribution.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const ctx={exports:{},Date,Object,Error,Number,require:()=>({})};
vm.runInNewContext(js,ctx,{timeout:1500});
const fn=ctx.exports.prepareAc02ControlledDistribution;
const draft={
 kind:"nucleo_ac02_pacote_oficial_assuncao_rascunho",
 status:"rascunho_nao_homologado",version:"1.0",privateSourcesIncluded:false,
 text:"# PACOTE OFICIAL DE ASSUNÇÃO — RASCUNHO CONSULTIVO AC-02\nStatus: NÃO HOMOLOGADO\n- Módulo: Módulo CRM\n- Fontes privadas: não incluídas neste pacote; consultar no Núcleo sob acesso autorizado.\n",
 unresolved:["Mandato ainda não certificado"],
};
const now="2026-11-14T21:00:00Z";
const review={
 selectedByAuthUid:"11111111-1111-4111-8111-111111111111",
 selectedAt:"2026-11-14T20:58:00Z",
 target:{moduleCode:"CRM",recipientKind:"novo_chat_ia",recipientAuthUid:null},
 confirmedModule:true,confirmedNonSecret:true,confirmedMissingMandate:true,
 confirmedNoAccessTransfer:true,confirmedDraftStatus:true,
};
const result=fn(draft,review,now);
assert.equal(result.state,"preparado_nao_enviado");
assert.equal(result.receipt.recordedInCore,false);
assert.equal(result.receipt.delivered,false);
assert.equal(result.receipt.received,false);
assert.equal(result.receipt.mandateGranted,false);
assert.equal(result.document,draft.text);
assert.equal(result.recipientAuthUid,null);
assert.throws(()=>fn(draft,{...review,confirmedNoAccessTransfer:false},now),/confirmation/);
assert.throws(()=>fn(draft,{...review,target:{...review.target,moduleCode:"FIN"}},now),/mismatch/);
assert.throws(()=>fn(draft,{...review,target:{...review.target,recipientAuthUid:"11111111-1111-4111-8111-111111111111"}},now),/impersonate/);
assert.throws(()=>fn(draft,{...review,target:{...review.target,recipientKind:"sucessor_humano"}},now),/recipient/);
assert.throws(()=>fn(draft,{...review,selectedAt:"2026-11-14T20:30:00Z"},now),/expired/);
assert.throws(()=>fn({...draft,privateSourcesIncluded:true},review,now),/source/);
assert.throws(()=>fn({...draft,text:"unexpected"},review,now),/mismatch|format/);
const code=fs.readFileSync("supabase/functions/_shared/nucleo/ac02-controlled-distribution.ts","utf8");
assert.ok(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(|fetch\(/.test(code));
console.log("PASS AC02 distribution contract — selection, review, no send, no privileges, no persistence");
