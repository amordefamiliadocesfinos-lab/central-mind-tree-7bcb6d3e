#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const code=fs.readFileSync("src/components/nucleo/NucleoSupervisionPanel.tsx","utf8");
let checks=0;
function check(name,fn){fn();checks++;console.log("PASS "+checks+" — "+name)}
check("Reavaliar inicia novo ciclo de consulta",()=>{
 assert.match(code,/onClick=\{\(\) => setReloadKey\(k => k \+ 1\)\}/);
 assert.match(code,/\}, \[reloadKey\]\);/);
});
check("cada leitura valida identidade e capacidade",()=>{
 for(const marker of ['client.auth.getUser()','app_admin_capabilities','"nucleo_manage"',
  'eq("active", true)','is("revoked_at", null)'])assert.ok(code.includes(marker));
});
check("as três consultas usam RLS sem escrita",()=>{
 for(const table of ["nucleo_development_workstreams","nucleo_development_evidence","nucleo_development_dependencies"])
  assert.ok(code.includes('client.from("'+table+'")'));
 assert.ok(!/\.insert\(|\.update\(|\.delete\(|\.upsert\(/.test(code));
});
check("timestamp só é estabelecido depois de leitura e grant validados",()=>{
 const success=code.indexOf("setPermissionConfirmed(true);");
 const stamp=code.indexOf("setLastSuccessfulRead(new Date().toISOString());");
 const grant=code.indexOf("const granted");
 const allow=code.indexOf("const allowed");
 assert.ok(success>0 && stamp>success && allow>0 && allow<success);
 assert.ok(code.includes("if (!allowed)"));
});
check("reavaliação mostra contador apenas no relatório aprovado",()=>{
 const render=code.indexOf("{snapshot && (");
 const indicator=code.indexOf("Última leitura autorizada:");
 assert.ok(render>=0 && indicator>render);
 assert.ok(code.includes("setAuthorizedReadCount(previous => previous + 1)"));
 assert.ok(code.includes("consultas válidas nesta sessão:"));
});
check("logout e troca de foco invalidam timestamp",()=>{
 assert.ok(code.includes("onAuthStateChange"));
 assert.ok(code.includes("visibilitychange"));
 assert.ok((code.match(/setLastSuccessfulRead\(null\)/g)||[]).length>=2);
});
check("erros e dados parciais suspendem o relatório",()=>{
 assert.ok(code.includes("setLoadError(true)"));
 assert.ok(code.includes("evidence.length < MAX_EVIDENCE"));
 assert.ok(code.includes("setLoaded(false)"));
});
console.log("M5 refresh evidence: "+checks+" verificações de contrato PASS (não substituem teste com clique real).");
