#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const ts=require("typescript");
const path="src/lib/nucleo/ac01DocumentGovernance.ts";
const code=ts.transpileModule(fs.readFileSync(path,"utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const ctx={exports:{}};
vm.runInNewContext(code,ctx,{timeout:1000});
const {AC01_DOCUMENT_CATEGORIES,AC01_FUNCTIONS,AC01_AUTHORITY_PROCEDURE,
 buildAc01DocumentView,isActiveCertifiedMandate,declaredAuthorityCoverage}=ctx.exports;
assert.equal(AC01_DOCUMENT_CATEGORIES.length,9);
assert.equal(AC01_FUNCTIONS.filter(x=>x.decide).length,1);
assert.equal(AC01_FUNCTIONS.filter(x=>x.publish).length,1);
assert.ok(AC01_AUTHORITY_PROCEDURE.some(x=>x.step==="Revogação / suspensão"));
const row=(id,v,state="proposta")=>({
 id,module_id:"NUC",lineage_id:"LINE",version_no:v,specialist_role:"Especialista NUC",
 contribution_kind:"metodo",title:"Documento "+id,authority_state:state,
 recorded_at:"2026-11-14T"+String(v).padStart(2,"0")+":00:00Z",
 parent_revision_id:v>1?"v1":null,source_locator:"github/example/"+id,
 source_kind:"github",recorded_by_auth_uid:"AUTHOR",
});
const doc=[row("v1",1),row("v2",2,"em_evolucao")];
const req=[{id:"R1",contribution_id:"v2",recorded_at:"2026-11-14T12:00:00Z",requested_outcome:"avaliar_aprovacao",submitter_auth_uid:"SUB"}];
let s=buildAc01DocumentView(doc,req,[],[]);
assert.equal(s.proposals.length,0);
assert.equal(s.evolving.length,1);
assert.equal(s.history.length,1);
assert.equal(s.pendingRequests.length,1);
assert.equal(s.internalPublications.length,0);
const d=[{id:"D1",decision_request_id:"R1",contribution_id:"v2",outcome:"aprovada",recorded_at:"2026-11-14T13:00:00Z",decided_by_auth_uid:"DEC"}];
const p=[{id:"P1",decision_act_id:"D1",contribution_id:"v2",recorded_at:"2026-11-14T14:00:00Z",previous_publication_id:null,executed_by_auth_uid:"EX"}];
s=buildAc01DocumentView(doc,req,d,p);
assert.equal(s.pendingRequests.length,0);
assert.equal(s.internalPublications.length,1);
assert.equal(s.evolving.length,0);
const grant={id:"G1",module_id:"NUC",specialist_role:"Especialista NUC",contribution_kind:"metodo",
 authority_kind:"decisor",delegate_auth_uid:"DEC",mandate_record_id:"M1",effective_from:"2026-11-01T00:00:00Z",effective_until:null};
const mandate={id:"M1",module_id:"NUC",specialist_role:"Especialista NUC",record_kind:"certificacao",
 specialist_auth_uid:"S",effective_from:"2026-11-01T00:00:00Z",effective_until:null,supersedes_record_id:null};
const now="2026-11-14T12:00:00Z";
assert.equal(isActiveCertifiedMandate(mandate,[mandate],now),true);
assert.equal(declaredAuthorityCoverage("NUC","Especialista NUC","metodo",[grant],[mandate],now).length,1);
const revoked={...mandate,id:"M2",record_kind:"revogacao",supersedes_record_id:"M1"};
assert.equal(isActiveCertifiedMandate(mandate,[mandate,revoked],now),false);
assert.equal(declaredAuthorityCoverage("NUC","Especialista NUC","metodo",[grant],[mandate,revoked],now).length,0);
const ui=fs.readFileSync("src/components/nucleo/NucleoAC01DocumentGovernance.tsx","utf8");
const integration=fs.readFileSync("src/components/nucleo/NucleoSpecialistContributions.tsx","utf8");
assert.ok(ui.includes("Fichas Vivas")&&ui.includes("publicação interna"));
assert.ok(ui.includes("AC01_AUTHORITY_PROCEDURE"));
assert.ok(integration.includes("NucleoAC01DocumentGovernance"));
assert.ok(!ui.includes(".insert(")&&!ui.includes(".update(")&&!ui.includes(".delete("));
console.log("PASS AC01 matriz, revogação, estados e visualização somente leitura");
