#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const ts=require("typescript");
const raw=fs.readFileSync("src/lib/nucleo/ac01ReadOnlyDesk.ts","utf8");
const code=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const scope={exports:{}};
vm.runInNewContext(code,scope,{timeout:1000});
const {latestContributions,deskFilter,continuityContext}=scope.exports;
const row=(id,version,state="proposta",lineage="L")=>({
 id,module_id:"M",specialist_role:"NUC",contribution_kind:"metodo",title:"Documento "+id,
 source_kind:"github",source_locator:"https://github.com/example/"+id,
 source_checksum_sha256:null,note:"metadado",authority_state:state,
 recorded_at:"2026-11-14T1"+version+":00:00Z",recorded_by_auth_uid:"operator",
 lineage_id:lineage,version_no:version,parent_revision_id:version>1?"v1":null,
});
const data=[row("v1",1),row("v2",2,"em_evolucao"),row("other",1,"proposta","OTHER")];
assert.deepEqual(latestContributions(data).map(x=>x.id).sort(),["other","v2"]);
assert.deepEqual(deskFilter(latestContributions(data),"em_evolucao","DOCU").map(x=>x.id),["v2"]);
assert.equal(deskFilter(latestContributions(data),"proposta","not-found").length,0);
const ctx=continuityContext("Núcleo","NUC",data,"2026-11-14T16:00:00Z");
assert.equal(ctx.pending.length,2);
assert.equal(ctx.history.length,3);
assert.equal(ctx.current_homologated.length,0);
assert.ok(ctx.normative_warning.includes("nenhum registro"));
assert.ok(ctx.usage_limit.includes("autorizados"));
assert.ok(!raw.includes("fetch(") && !raw.includes(".insert(") && !raw.includes(".update("));
console.log("AC01 readonly queue and succession projection: PASS");
