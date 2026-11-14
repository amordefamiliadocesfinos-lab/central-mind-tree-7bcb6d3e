#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const ts=require("typescript");
const path="supabase/functions/_shared/nucleo/ac02-registry-contract.ts";
const source=fs.readFileSync(path,"utf8");
const transpiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const ctx={exports:{},Date,Number,Object,Map,Set,RegExp,Error};
vm.runInNewContext(transpiled,ctx,{timeout:1500});
const {AC02_GLOBAL_IDENTITY,AC02_GLOBAL_ITEMS,buildAc02Registry,prepareAc02AssumptionDraft,hasAc02Secret}=ctx.exports;
assert.equal(AC02_GLOBAL_IDENTITY.github,"amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e");
assert.equal(AC02_GLOBAL_IDENTITY.lovableProjectId,"1720a410-34cd-4410-995c-8c92c7edf16b");
assert.equal(AC02_GLOBAL_IDENTITY.cloudSupabaseProjectRef,"xkskyutmtlhivvpfxkjg");
assert.equal(AC02_GLOBAL_IDENTITY.githubBranch,"main");
assert.ok(AC02_GLOBAL_IDENTITY.developmentMethod.includes("GitHub direto"));
assert.ok(AC02_GLOBAL_ITEMS.every(x=>x.evidence==="decisao_camada_mestre"&&x.checkedAt===null));
assert.equal(new Set(AC02_GLOBAL_ITEMS.map(x=>x.id)).size,AC02_GLOBAL_ITEMS.length);
assert.equal(hasAc02Secret("password=xyz"),true);
assert.equal(hasAc02Secret("postgresql://user:pwd@host:5432/db"),true);
assert.equal(hasAc02Secret("Bearer token=abc"),true);
assert.equal(hasAc02Secret("GitHub official repository"),false);
const now="2026-11-14T15:00:00Z";
const obs=[
 {id:"good",recordId:"ac02.github.branch",value:"main",observedAt:"2026-11-14T14:00:00Z",
 source:"https://github.com/org/repo",sourceVersion:"abc123",status:"observado",visibility:"publico_nao_secreto"},
 {id:"stale",recordId:"ac02.github.branch",value:"main",observedAt:"2026-11-10T14:00:00Z",
 source:"https://github.com/org/repo",sourceVersion:"abc001",status:"observado",visibility:"publico_nao_secreto"},
 {id:"conflict",recordId:"ac02.github.branch",value:"develop",observedAt:"2026-11-14T14:02:00Z",
 source:"https://github.com/org/repo",sourceVersion:"abc345",status:"observado",visibility:"publico_nao_secreto"},
 {id:"secret",recordId:"ac02.supabase",value:"password=supersecret",observedAt:"2026-11-14T14:10:00Z",
 source:"https://example.com",sourceVersion:"abc345",status:"observado",visibility:"publico_nao_secreto"},
 {id:"private",recordId:"ac02.supabase",value:"xkskyutmtlhivvpfxkjg",observedAt:"2026-11-14T14:10:00Z",
 source:"private-folder",sourceVersion:"abc345",status:"observado",visibility:"restrito_referencia"},
];
const p=buildAc02Registry(obs,now,24);
assert.equal(p.kind,"nucleo_ac02_registro_mestre_consultivo");
assert.equal(p.observations.length,2);
assert.ok(p.missingChecks.some(x=>x.includes("stale")));
assert.ok(p.conflicts.some(x=>x.includes("ac02.github.branch")));
assert.ok(p.conflicts.some(x=>x.includes("secret")));
assert.equal(p.stable.find(x=>x.id==="ac02.github.branch").value,"main");
const draft=prepareAc02AssumptionDraft(p,{moduleId:"MOD-001",moduleCode:"CRM",
 specialistRole:"Especialista CRM",methodRef:null,ecosystemRef:null,scopeRef:"FM-03",
 checkpointRef:null,sourceRefs:["private-file","token=accidental"],checkedAt:null,
 access:"nao_verificado"});
assert.equal(draft.specialist.sourceRefs.length,0);
assert.ok(draft.warnings.some(x=>x.includes("Permissão")));
assert.ok(draft.warnings.some(x=>x.includes("Método")));
assert.ok(!JSON.stringify(draft).includes("token=accidental"));
assert.ok(!JSON.stringify(p).includes("supersecret"));
const uncertain=buildAc02Registry([{id:"offline",recordId:"ac02.github",value:"não verificado",observedAt:now,source:"https://api.github.com",sourceVersion:"github/unavailable",status:"indeterminado",visibility:"publico_nao_secreto"}],now);
assert.ok(uncertain.missingChecks.some(x=>x.includes("não concluída")));
const versionSecret=buildAc02Registry([{id:"bad-source-version",recordId:"ac02.github",value:"main",observedAt:now,source:"https://api.github.com",sourceVersion:"token=leaked",status:"observado",visibility:"publico_nao_secreto"}],now);
assert.equal(versionSecret.observations.length,0);
assert.ok(!JSON.stringify(versionSecret).includes("leaked"));
assert.throws(()=>buildAc02Registry([], "invalid"));
const related=fs.readFileSync("src/lib/nucleo/ac01ReadOnlyDesk.ts","utf8");
assert.ok(related.includes("continuityContext"));
assert.ok(!source.includes("createClient("));
assert.ok(!source.includes(".insert("));
assert.ok(!source.includes("SECURITY DEFINER"));
console.log("PASS AC02 P1/P2: identity, dynamic staleness, contradictions, secrets, scoped assumption");
