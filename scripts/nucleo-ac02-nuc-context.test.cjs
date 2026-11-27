#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict"),ts=require("typescript"),vm=require("node:vm");
const contract=fs.readFileSync("supabase/functions/_shared/nucleo/ac02-nuc-read-contract.ts","utf8");
const endpoint=fs.readFileSync("supabase/functions/nucleo-ac02-context-read/index.ts","utf8");
const ui=fs.readFileSync("src/components/nucleo/NucleoAc02NucContextRead.tsx","utf8");
const host=fs.readFileSync("src/components/nucleo/NucleoDevelopmentCenter.tsx","utf8");
const transpiled=ts.transpileModule(contract,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(transpiled.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
const moduleExports={};vm.runInNewContext(transpiled.outputText,{exports:moduleExports,Object,Set});
const api=moduleExports;
const ID=api.NUC_MODULE_ID,MAP=api.PILOT_CONTRIBUTION_ID;
assert.equal(api.validRequest({module_id:ID}),true);
for(const bad of [{},{module_id:"CRM"},{module_id:ID,include_private:true},null,[],{"__proto__":"x"},{}]){
 if(bad!==null&&Object.keys(bad).length===0||bad===null||Array.isArray(bad)||bad.module_id!==ID)
  assert.equal(api.validRequest(bad),false);
}
const fronts=[0,1,2,3,4,5].map(n=>({id:"front-"+n,code:"NUC-M"+n,kind:"frente",parent_id:ID,title:"Frente",status:"em_validacao",next_action:"Conferir",evidence_state:"comprovada"}));
assert.equal(api.validateFronts(fronts),true);
assert.equal(api.validateFronts(fronts.slice(1)),false);
assert.equal(api.validateFronts([...fronts.slice(0,5),fronts[0]]),false);
assert.equal(api.validateFronts(fronts.map((x,i)=>i?x:{...x,parent_id:"other"})),false);
const record={id:MAP,module_id:ID,specialist_role:"Especialista Núcleo 2.0",contribution_kind:"mapa",title:"Mapa",source_kind:"github",source_locator:api.PILOT_MAP_SOURCE,version_no:1,authority_state:"proposta"};
assert.equal(api.validContribution(record),true);
assert.equal(api.validContribution({...record,authority_state:"homologado"}),false);
assert.equal(api.validContribution({...record,source_kind:"referencia_privada"}),false);
assert.match(endpoint,/db\.auth\.getUser\(token\)/);
assert.match(endpoint,/\.eq\("capability","nucleo_manage"\)/);
assert.match(endpoint,/\.is\("revoked_at",null\)/);
assert.match(endpoint,/\.eq\("module_id",NUC_MODULE_ID\)/);
assert.match(endpoint,/\.eq\("parent_id",NUC_MODULE_ID\)/);
assert.match(endpoint,/validateFronts\(/);
assert.match(endpoint,/validContribution\(/);
assert.match(endpoint,/count:"exact",head:true/);
assert.match(endpoint,/status:"consultivo_nao_homologado"/);
const executable=endpoint.replace(/\/\*[\s\S]*?\*\//g,"").replace(/^\s*\/\/.*$/gm,"");
assert.doesNotMatch(executable,/service.role|SUPABASE_SERVICE_ROLE|\.insert\(|\.update\(|\.upsert\(|\.delete\(/i);
assert.doesNotMatch(executable,/snapshot|evidence_note/); // FM source_reference is now returned in authenticated contextual projection, not portable export.
assert.match(host,/selected\.code==="NUC"&&<NucleoAc02NucContextRead\s*\/>/);
assert.match(ui,/supabase\.functions\.invoke\("nucleo-ac02-context-read"/);
assert.match(ui,/getUser\(\)/);
// F3: navegar à fonte declarada sem aceitar URL/locator arbitrário do Core.
assert.match(ui,/const PILOT_MAP_SOURCE="docs\/architecture\/MAPA_CONTINUIDADE_CANONICA_ESPECIALISTAS_NUCLEO20_V1_1_CONGELADO_PLANEJAMENTO_2026-11-19\.md"/);
assert.match(ui,/visibleResult\.contribution\.source_kind==="github"&&visibleResult\.contribution\.source_locator===PILOT_MAP_SOURCE/);
assert.match(ui,/href=\{PILOT_MAP_URL\}/);
assert.match(ui,/não certifica SHA-256, versão vigente ou homologação/);

// Continuidade protegida: contexto consultivo não pode sobreviver à troca de usuário.
assert.match(ui,/const \{session,loading\}=useAuth\(\)/);
assert.match(ui,/const visibleResult=sessionUid&&resultOwner===sessionUid\?result:null/);
assert.match(ui,/setResult\(null\);setResultOwner\(null\);setError\(""\);setCopyStatus\("idle"\)/);
assert.match(ui,/identityRef\.current!==requestUid/);
assert.match(ui,/current\.data\.user\?\.id!==requestUid/);
assert.match(ui,/\{visibleResult&&<div/);

assert.match(ui,/status==="consultivo_nao_homologado"/);
console.log("PASS AC02 NUC: contrato fechado, filtros de escopo, JWT, grant, RLS, leitura mínima, negativa de homologação e UI");

// F1/F2 transition: render the existing authenticated context without inventing a relational identity.
assert.match(ui,/aria-label="Identidade e vínculos de atuação"/);
assert.match(ui,/visibleResult\.specialist\.role/);
assert.match(ui,/<NucleoIdentityContext moduleId=\{ID\} frontId=\{null\}/);
assert.match(ui,/esta projeção descritiva não certifica o cadastro relacional/);
assert.match(ui,/Método geral/);
assert.match(ui,/Adaptação contextual/);
assert.match(ui,/A consulta não herda autoridade e não cria vínculo de atuação/);

// U06: preserve the original F5 checkpoint while adding authorized current context.
assert.match(endpoint,/continuity_context:currentContext/);
assert.match(endpoint,/next_action_record:root.next_action/);
assert.match(endpoint,/updated_at:root.updated_at/);
assert.match(endpoint,/\.eq\("module_id",NUC_MODULE_ID\)\.in\("section_code",\["FM-03","FM-08","FM-09","FM-10"\]\)/);
assert.match(endpoint,/previous.version_no<row.version_no/);
assert.match(endpoint,/Revisões FM conflitantes/);
assert.match(endpoint,/authority:"consultivo_nao_homologado"/);
assert.match(endpoint,/ac01_revisions:revisionRead.data/);
assert.match(endpoint,/M3 para checkpoint; FM\/AC-01 para revisão documental; AC-02 somente consulta/);


// U06 additive response diagnostic: execute the actual pure parser extracted from the component.
const start=ui.indexOf("type U06Meta=");
const end=ui.indexOf("const isContext=",start);
assert.ok(start>=0&&end>start);
const diagnosticSource="const ID="+JSON.stringify(ID)+";\n"+ui.slice(start,end)+"\nexport {inspectU06};";
const diagnosticTs=ts.transpileModule(diagnosticSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(diagnosticTs.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
const diagnosticExports={};
vm.runInNewContext(diagnosticTs.outputText,{exports:diagnosticExports});
const inspect=diagnosticExports.inspectU06;
const sections=["FM-03","FM-08","FM-09","FM-10"].map(section_code=>({section_code,state:"registro_core",revision:{section_code,version_no:1,authority_state:"rascunho",body:"PRIVATE_BODY",source_reference:"PRIVATE_SOURCE"}}));
const ac01_revisions=[{id:"r1",version_no:1,authority_state:"proposta"},{id:"r2",version_no:2,authority_state:"em_evolucao"}];
const sample={kind:"nucleo_ac02_leitura_contextual_u06",authority:"consultivo_nao_homologado",root:{id:ID,code:"NUC",updated_at:"2026-11-26T23:45:10.388730Z",next_action_record:"Histórico. Ação vigente: U06-E."},sections,ac01_revisions};
assert.equal(inspect(undefined).state,"legacy");
const current=inspect(sample);
assert.equal(current.state,"current");
assert.equal(current.data.sections.length,4);
assert.equal(current.data.revisions.length,2);
assert.equal(current.data.root.updated_at,sample.root.updated_at);
assert.equal(current.data.root.next_action_record,sample.root.next_action_record);
assert.doesNotMatch(JSON.stringify(current),/PRIVATE_BODY|PRIVATE_SOURCE/);
for(const bad of [null,{}, {...sample,authority:"homologado"},{...sample,root:{...sample.root,id:"other"}},{...sample,root:{...sample.root,updated_at:"invalid"}},{...sample,sections:sections.slice(1)},{...sample,sections:[sections[0],sections[0],...sections.slice(2)]},{...sample,sections:[{...sections[0],revision:null},...sections.slice(1)]},{...sample,ac01_revisions:[]},{...sample,ac01_revisions:[ac01_revisions[0],ac01_revisions[0]]}])assert.equal(inspect(bad).state,"incomplete");
assert.match(ui,/visibleResult\?inspectU06\(visibleResult\.continuity_context\):null/);
assert.match(ui,/u06\.state==="legacy"/);
assert.match(ui,/u06\.state==="incomplete"/);
assert.match(ui,/u06\.state==="current"/);
console.log("PASS U06 diagnostic: legacy/current/incomplete, four unique FM, AC01 metadata, root timestamp, no FM body/source exposure");
