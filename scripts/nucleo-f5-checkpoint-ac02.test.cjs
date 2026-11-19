#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript");
function loadContract(path){
 const raw=fs.readFileSync(path,"utf8");
 const result=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 const moduleExports={};vm.runInNewContext(result.outputText,{exports:moduleExports,Object,Set,Number,Array});
 return moduleExports;
}
const mod=loadContract("supabase/functions/_shared/nucleo/ac02-f5-checkpoint-contract.ts");
const nuc=loadContract("supabase/functions/_shared/nucleo/ac02-nuc-read-contract.ts");
const endpoint=fs.readFileSync("supabase/functions/nucleo-ac02-context-read/index.ts","utf8");
const ui=fs.readFileSync("src/components/nucleo/NucleoAc02NucContextRead.tsx","utf8");
const id=nuc.NUC_MODULE_ID;
assert.equal(nuc.validRequest({module_id:id}),true,"old clients must keep working");
assert.equal(nuc.validRequest({module_id:id,include_checkpoint:true}),true);
assert.equal(nuc.validRequest({module_id:id,include_checkpoint:false}),true);
for(const bad of [{module_id:id,include_checkpoint:"yes"},{module_id:id,include_checkpoint:true,admin:true},{module_id:"CRM",include_checkpoint:true}]){
 assert.equal(nuc.validRequest(bad),false);
}
const before={id:mod.CHECKPOINT_FRONT_ID,code:"NUC-M4",status:"em_validacao",next_action:"Apresentar parecer à Camada Mestre"};
const after={...before,next_action:"Aceite técnico restrito aprovado, PR #699, comentário #6837285096. Manter em validação."};
const event={id:mod.CHECKPOINT_EVENT_ID,workstream_id:mod.CHECKPOINT_FRONT_ID,event_type:"alterado",recorded_at:"2026-11-13T16:34:17Z",before_state:before,after_state:after};
const current={id:mod.CHECKPOINT_FRONT_ID,code:"NUC-M4",status:"em_validacao",next_action:after.next_action};
const approved=mod.assessM4Checkpoint(event,current);
assert(approved&&approved.event_id===mod.CHECKPOINT_EVENT_ID);
assert.equal(approved.status_after,"em_validacao");
assert.match(approved.decision_source,/pull\/699#issuecomment-6837285096/);
assert.match(approved.checkpoint_source,/pull\/699#issuecomment-7023192928/);
for(const bad of [
 [{...event,id:"other"},current],
 [{...event,workstream_id:"other"},current],
 [{...event,after_state:{...after,status:"concluida"}},current],
 [{...event,after_state:{...after,next_action:"Aprovado genericamente"}},current],
 [event,{...current,status:"concluida"}],
 [event,{...current,next_action:"Omitiu a decisão"}],
])assert.equal(mod.assessM4Checkpoint(...bad),null,"must fail closed on historical drift");
assert.equal(mod.fmVisibility(0,false),"sem_revisao_visivel_sob_rls");
assert.equal(mod.fmVisibility(1,false),"revisao_visivel_sem_assertiva_de_vigencia");
assert.equal(mod.fmVisibility(null,false),"indeterminado");
assert.equal(mod.fmVisibility(0,true),"indeterminado");
assert.equal(mod.fmVisibility(-1,false),"indeterminado");
assert.match(endpoint,/\.eq\("id",CHECKPOINT_EVENT_ID\)\.eq\("workstream_id",CHECKPOINT_FRONT_ID\)/);
assert.match(endpoint,/\.eq\("section_code","FM-09"\)/);
assert.match(endpoint,/\.eq\("section_code","FM-10"\)/);
assert.match(endpoint,/assessM4Checkpoint/);
assert.match(endpoint,/fmVisibility/);
assert.match(endpoint,/\.eq\("capability","nucleo_manage"\)/);
assert.match(endpoint,/\.auth\.getUser\(token\)/);
assert.match(ui,/include_checkpoint:true/);
assert.match(ui,/F5 · Aprendizado recuperado/);
const stripped=endpoint.replace(/\/\*[\s\S]*?\*\//g,"").replace(/^\s*\/\/.*$/gm,"");
assert.doesNotMatch(stripped,/SUPABASE_SERVICE_ROLE|\.insert\(|\.update\(|\.upsert\(|\.delete\(/i);
console.log("PASS F5 AC02: regressão legada, checkpoint M4 real, drift bloqueado, FM-09/10 RLS, UI e zero writes");
