#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript"),assert=require("node:assert/strict");
const compile=(path,req)=>{
 const out=ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 const ctx={exports:{},require:req,Date,Object,Map,Set,RegExp,Number,Error};
 vm.runInNewContext(out.outputText,ctx,{timeout:2000});
 return ctx.exports;
};
const registry=compile("supabase/functions/_shared/nucleo/ac02-registry-contract.ts",()=>{throw Error("No dependencies")});
const summary=compile("supabase/functions/_shared/nucleo/ac02-continuity-summary.ts",()=>{throw Error("No dependencies")});
const exp=compile("supabase/functions/_shared/nucleo/ac02-assumption-export.ts",name=>{
 if(name==="./ac02-continuity-summary.ts")return summary;
 assert.equal(name,"./ac02-registry-contract.ts");
 return registry;
});
const moduleId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const frontId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const evidenceId="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const otherFront="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const now="2026-11-14T19:00:00Z";
const projection=registry.buildAc02Registry([],now);
const specialist={moduleId,moduleCode:"CRM",specialistRole:"person=secret",methodRef:null,
 ecosystemRef:null,scopeRef:null,checkpointRef:null,sourceRefs:["password=hunter2"],checkedAt:null,access:"nao_verificado"};
const draft=exp.composeAc02AssumptionExport({projection,specialist,moduleTitle:"token=private",preparedAt:now,
 technical:{fronts:[
  {id:frontId,code:"CRM-UX02",status:"em_validacao",next_action:"password=hidden"},
  {id:"nope",code:"BAD",status:"concluido",title:"token=bad"}],
 evidence:[
  {id:evidenceId,workstreamId:frontId,kind:"workflow_run",observedState:"verificado",source:"password=hidden"},
  {id:"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",workstreamId:otherFront,kind:"migration",observedState:"verificado"},
 ],evidenceRead:"completa"}});
assert.equal(draft.status,"rascunho_nao_homologado");
assert.match(draft.text,/CRM-UX02/);
assert.ok(draft.text.includes(evidenceId));
assert.ok(!draft.text.includes(otherFront));
assert.ok(!draft.text.includes("hunter2")&&!draft.text.includes("secret"));
assert.ok(!draft.text.includes("private")&&!draft.text.includes("hidden"));
assert.ok(draft.unresolved.some(v=>v.includes("Mandato")||v.includes("mandato")));
assert.ok(draft.unresolved.some(v=>v.includes("Método")));
const noTechnical=exp.composeAc02AssumptionExport({projection,specialist,preparedAt:now,moduleTitle:"",});
assert.ok(noTechnical.unresolved.some(v=>v.includes("Frentes e evidências")));
const endpoint=fs.readFileSync("supabase/functions/nucleo-knowledge-read/index.ts","utf8");
const auth=endpoint.indexOf("const identity=await db.auth.getUser(token)");
const grant=endpoint.indexOf('const grant=await db.from("app_admin_capabilities")');
const m3=endpoint.indexOf('const moduleResult=await db.from("nucleo_development_workstreams")');
const exportAt=endpoint.indexOf("composeAc02AssumptionExport({");
assert.ok(auth>=0&&grant>auth&&m3>grant&&exportAt>m3);
assert.ok(endpoint.includes('.select("id,kind,observed_state,workstream_id")'));
assert.ok(!/\.insert\(|\.upsert\(|\.update\(|\.delete\(/.test(endpoint));
console.log("PASS AC02 assuncao M3/M4: somente IDs do módulo, sem texto/segredos/ACL ampliada");
