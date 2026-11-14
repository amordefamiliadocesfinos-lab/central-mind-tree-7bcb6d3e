#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript"),assert=require("node:assert/strict");
const load=(p,req)=>{
 const js=ts.transpileModule(fs.readFileSync(p,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const ctx={exports:{},require:req,Date,Set,Map,Object,Number};vm.runInNewContext(js,ctx,{timeout:2000});return ctx.exports;
};
const docs=load("supabase/functions/_shared/nucleo/ac02-documentary-coverage.ts",()=>{throw Error("no import")});
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const input=[
 {sectionCode:"FM-03",id,versionNo:4,authorityState:"proposta",evidenceLevel:null,recordedAt:"2026-11-14T12:00:00Z",sourcePresent:true},
 {sectionCode:"FM-08",id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",versionNo:2,authorityState:"vigente",evidenceLevel:"declarado",recordedAt:"2026-11-14T13:00:00Z",sourcePresent:false},
 {sectionCode:"FM-09",id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",versionNo:5,authorityState:"vigente",evidenceLevel:null,recordedAt:"2026-11-14T14:00:00Z",sourcePresent:true},
];
const x=docs.describeAc02DocumentaryCoverage(input,true);
assert.equal(x.entries.length,3);
assert.equal(x.entries[2].versionNo,5);
assert.equal(x.operationalCheckpointVerified,false);
assert.equal(x.distinctMethodAndEcosystemVerified,false);
assert.ok(x.warnings.some(v=>v.includes("checkpoint operacional")));
assert.ok(x.warnings.some(v=>v.includes("método e ecossistema")));
assert.equal(x.entries[1].sourceReference,"ausente");
const y=docs.describeAc02DocumentaryCoverage(input.slice(0,1),false);
assert.equal(y.entries[2].status,"sem_registro");
assert.ok(y.warnings.some(v=>v.includes("não comprovadamente completa")));
const registry=load("supabase/functions/_shared/nucleo/ac02-registry-contract.ts",()=>{throw Error("no import")});
const summary=load("supabase/functions/_shared/nucleo/ac02-continuity-summary.ts",()=>{throw Error("no import")});
const guide=load("supabase/functions/_shared/nucleo/ac02-assumption-guide.ts",()=>{throw Error("no import")});
const gaps=load("supabase/functions/_shared/nucleo/ac02-knowledge-gaps.ts",()=>{throw Error("no imports")});
const exp=load("supabase/functions/_shared/nucleo/ac02-assumption-export.ts",name=>{
 if(name==="./ac02-registry-contract.ts")return registry;
 if(name==="./ac02-continuity-summary.ts")return summary;
 if(name==="./ac02-documentary-coverage.ts")return docs;
 if(name==="./ac02-assumption-guide.ts")return guide;
 if(name==="./ac02-knowledge-gaps.ts")return gaps;
 throw Error(name);
});
const packet=exp.composeAc02AssumptionExport({
 projection:registry.buildAc02Registry([],"2026-11-14T19:00:00Z"),
 specialist:{moduleId:id,moduleCode:"CRM",methodRef:null,ecosystemRef:null,scopeRef:null,checkpointRef:null,specialistRole:"",sourceRefs:["token=SECRET"],checkedAt:null,access:"nao_verificado"},
 moduleTitle:"private=secret",preparedAt:"2026-11-14T19:00:00Z",documentary:input,documentaryReadComplete:true,
});
assert.match(packet.text,/Cobertura documental e checkpoint/);
assert.match(packet.text,/FM-09: referencia_core_declarada/);
assert.ok(packet.text.includes("Último checkpoint operacional comprovado: NÃO"));
assert.ok(!packet.text.includes("SECRET")&&!packet.text.includes("private=secret"));
const endpoint=fs.readFileSync("supabase/functions/nucleo-knowledge-read/index.ts","utf8");
assert.ok(endpoint.includes("documentaryReadComplete:true"));
assert.ok(endpoint.includes("sourcePresent:"));
assert.ok(!endpoint.includes("documentary:sections.map(row=>row.revision!.body)"));
console.log("PASS AC02 documentary coverage: source presence, revision metadata, no false checkpoint or document payload");
