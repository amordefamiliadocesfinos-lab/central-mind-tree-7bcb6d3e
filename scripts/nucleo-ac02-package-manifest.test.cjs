#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),ts=require("typescript"),vm=require("node:vm"),fs=require("node:fs");
const {webcrypto}=require("node:crypto");
const src=fs.readFileSync("supabase/functions/_shared/nucleo/ac02-package-manifest.ts","utf8");
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const ctx={exports:{},require:()=>({}),TextEncoder,Uint8Array,Array,Object,Number,Error,crypto:webcrypto};
vm.runInNewContext(js,ctx,{timeout:1500});
const {createAc02PackageManifest,verifyAc02PackageManifest}=ctx.exports;
const uuid="11111111-1111-4111-8111-111111111111";
const doc="# PACOTE OFICIAL DE ASSUNÇÃO — RASCUNHO CONSULTIVO AC-02\nStatus: NÃO HOMOLOGADO\n- Módulo: Módulo CRM\n- Fontes privadas: não incluídas neste pacote\n";
const prepared={
 kind:"nucleo_ac02_repasse_preparado",state:"preparado_nao_enviado",version:"1.0",
 document:doc,moduleCode:"CRM",recipientKind:"novo_chat_ia",recipientAuthUid:null,
 selectedByAuthUid:uuid,selectedAt:"2026-11-14T16:00:00Z",
 receipt:{recordedInCore:false,delivered:false,received:false,mandateGranted:false},
};
(async()=>{
 const m=await createAc02PackageManifest(prepared,uuid,webcrypto);
 assert.equal(m.packageId,uuid);
 assert.equal(m.packageSha256.length,64);
 assert.equal(m.digestAlgorithm,"SHA-256");
 assert.equal(m.digestScope,"exact-utf8-document-bytes");
 assert.equal(m.delivered,false);
 assert.equal(m.accepted,false);
 assert.equal(await verifyAc02PackageManifest(m,doc,webcrypto),true);
 assert.equal(await verifyAc02PackageManifest(m,doc+"alterado",webcrypto),false);
 assert.equal(await verifyAc02PackageManifest(m,doc.replace("Família","Familia"),webcrypto),false);
 assert.equal(await verifyAc02PackageManifest({...m,packageSha256:"f".repeat(64)},doc,webcrypto),false);
 assert.equal(await verifyAc02PackageManifest({...m,provenance:"authenticated"},doc,webcrypto),false);
 await assert.rejects(()=>createAc02PackageManifest({...prepared,receipt:{...prepared.receipt,delivered:true}},uuid,webcrypto));
 await assert.rejects(()=>createAc02PackageManifest(prepared,"bad",webcrypto));
 console.log("PASS AC02 SHA-256: UTF8 exact bytes, mutation detection, no claimed transfer/authentication");
})().catch(e=>{console.error(e);process.exitCode=1;});
