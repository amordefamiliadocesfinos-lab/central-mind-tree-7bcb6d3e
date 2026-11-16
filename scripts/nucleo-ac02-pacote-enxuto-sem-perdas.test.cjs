#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),ts=require("typescript"),vm=require("node:vm"),assert=require("node:assert/strict");
function load(path,req){
 const js=ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const ctx={exports:{},require:req,Date,Object,Number,Set,Map,Error,RegExp};
 vm.runInNewContext(js,ctx,{timeout:1800});return ctx.exports;
}
const root="supabase/functions/_shared/nucleo/";
const registry=load(root+"ac02-registry-contract.ts",()=>{throw Error("no dependencies")});
const documents=load(root+"ac02-documentary-coverage.ts",()=>{throw Error("no dependencies")});
const continuity=load(root+"ac02-continuity-summary.ts",()=>{throw Error("no dependencies")});
const guide=load(root+"ac02-assumption-guide.ts",()=>{throw Error("no dependencies")});
const gaps=load(root+"ac02-knowledge-gaps.ts",()=>{throw Error("no dependencies")});
const draft=load(root+"ac02-assumption-export.ts",name=>{
 const deps={"./ac02-registry-contract.ts":registry,"./ac02-documentary-coverage.ts":documents,
 "./ac02-continuity-summary.ts":continuity,"./ac02-assumption-guide.ts":guide,
 "./ac02-knowledge-gaps.ts":gaps};
 if(!(name in deps))throw Error("unknown import "+name);return deps[name];
});
const m="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const input={
 projection:registry.buildAc02Registry([],"2026-11-16T12:02:00Z"),
 specialist:{moduleId:m,moduleCode:"CRM",methodRef:null,ecosystemRef:null,scopeRef:null,checkpointRef:null,
  specialistRole:"token=secret",sourceRefs:["password=private"],checkedAt:null,access:"nao_verificado"},
 moduleTitle:"secret=private",preparedAt:"2026-11-16T12:02:00Z",
 documentary:[{sectionCode:"FM-03",id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",versionNo:2,authorityState:"proposta",
  evidenceLevel:null,recordedAt:"2026-11-14T12:00:00Z",sourcePresent:true}],
 documentaryReadComplete:false,
 technical:{fronts:[{id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",code:"CRM-01",status:"em_andamento"}],
  evidence:[{id:"dddddddd-dddd-4ddd-8ddd-dddddddddddd",workstreamId:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",kind:"commit",observedState:"relatado"}],
  evidenceRead:"indeterminada"}
};
const out=draft.composeAc02AssumptionExport(input),text=out.text;
const start=text.indexOf("## 10. Inventário de lacunas de conhecimento (consultivo)");
const end=text.indexOf("## 11. Visão de prontidão documental — somente leitura");
const next=text.indexOf("## 12. Condições de continuidade");
assert.ok(start>0&&end>start&&next>end);
const details=text.slice(start,end),readiness=text.slice(end,next);
const IDs=["G01_ESCOPO","G02_METODO_ECOSSISTEMA","G03_CHECKPOINT","G04_M3_M4",
"G05_FONTES","G06_MANDATO_ACESSO","G07_HOMOLOGACAO","G08_SEGURANCA_IMPLANTACAO"];
for(const id of IDs){
 assert.equal((details.match(new RegExp("^- "+id+" \\/ ","gm"))||[]).length,1,"one authoritative detail "+id);
 assert.equal((readiness.match(new RegExp("^- [^\\n]*"+id+" \\/ ","gm"))||[]).length,0,"no redundant duplicate "+id);
}
for(const section of ["## 1. Identidade global","## 3. Contexto da especialidade",
"## 4. Frentes e evidências","## 6. Cobertura documental e checkpoint",
"## 8. Pendências obrigatórias","## 9. Roteiro de recuperação",
"## 10. Inventário de lacunas","## 11. Visão de prontidão",
"## 12. Condições de continuidade"]) assert.ok(text.includes(section),section);
assert.match(details,/G01_ESCOPO \/ documental \/ recorte_indeterminado \/ fm03/);
assert.match(details,/G08_SEGURANCA_IMPLANTACAO \/ implantacao \/ fase_adiada \/ deferimento_proprietario/);
assert.match(readiness,/Referências disponíveis para consulta:/);
assert.match(readiness,/Comprovações externas pendentes:/);
assert.match(readiness,/Identificadores, categorias, estados, fontes e ações individuais: ver inventário G01–G08/);
assert.ok(text.includes("dddddddd-dddd-4ddd-8ddd-dddddddddddd"));
assert.ok(text.includes("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"));
assert.ok(!text.includes("password=private")&&!text.includes("secret=private"));
assert.equal(out.status,"rascunho_nao_homologado");
assert.equal(out.privateSourcesIncluded,false);
assert.ok(text.includes("não equivale a mandato"));
console.log("PASS AC02 enxuto: 8 registros únicos, cobertura integral, referências e ressalvas preservadas");
