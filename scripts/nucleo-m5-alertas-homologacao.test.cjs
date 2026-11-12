#!/usr/bin/env node
"use strict";
/**
 * Homologação controlada M5: somente dados inteiramente sintéticos.
 * Executa o motor real sem Supabase, GitHub, rede, credenciais ou DOM.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync("src/lib/nucleo/supervision.ts", "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const scope = { exports: {} };
vm.runInNewContext(output, scope, { timeout: 1000 });
const { inspectNucleoSupervision: inspect } = scope.exports;
assert.equal(typeof inspect, "function");

const TODAY = new Date("2026-11-12T18:00:00.000Z");
const front = (id, extra = {}) => ({
  id, code:id, title:"Frente sintética " + id, kind:"frente",
  status:"em_validacao", blocker:"", next_action:"Revisar evidências",
  evidence_state:"comprovada", ...extra,
});
const proof = (id, workstream_id, observed_state="verificado") => ({
  id, workstream_id, observed_state,
});
const clone = value => JSON.parse(JSON.stringify(value));
let checks = 0;
function scenario(name, setup, check) {
  const { fronts, evidence, dependencies=[] } = setup;
  const original = clone({ fronts, evidence, dependencies });
  const result = inspect(fronts, evidence, dependencies, TODAY);
  check(result);
  assert.deepEqual(clone({ fronts, evidence, dependencies }), original,
    name + ": motor alterou os dados de entrada");
  assert.equal(result.informationalOnly, true, name + ": perdeu contrato read-only");
  assert.equal(result.computedAt, TODAY.toISOString(), name + ": data inconsistente");
  for (const finding of result.findings) {
    assert.ok(finding.workstreamCode, name + ": alerta sem origem");
    assert.ok(finding.title && finding.explanation && finding.suggestedAction,
      name + ": alerta sem justificativa ou sugestão");
    assert.ok(["atencao","informativo"].includes(finding.severity));
  }
  checks++;
  console.log("PASS " + checks + " — " + name);
}
const kinds = result => result.findings.map(x=>x.kind);

scenario("base limpa sem falsos alertas",{
  fronts:[front("NUC-M1"),front("NUC-M4")],
  evidence:[proof("A","NUC-M1"),proof("B","NUC-M4")],
},r=>{
  assert.deepEqual(kinds(r),[]);
  assert.equal(r.workstreamCount,2);
  assert.equal(r.evidenceCount,2);
});

scenario("divergência identificada e vinculada à prova original",{
  fronts:[front("NUC-M4")],
  evidence:[proof("D1","NUC-M4","divergente")],
},r=>{
  assert.deepEqual(kinds(r),["divergencia"]);
  assert.equal(r.findings[0].evidenceIds.join(","),"D1");
  assert.match(r.findings[0].suggestedAction,/investigar/i);
});

scenario("duas divergências agrupadas sem perder IDs",{
  fronts:[front("NUC-M4")],
  evidence:[proof("D1","NUC-M4","divergente"),proof("D2","NUC-M4","divergente")],
},r=>{
  assert.equal(r.findings.length,1);
  assert.equal(r.findings[0].evidenceIds.join(","),"D1,D2");
  assert.match(r.findings[0].explanation,/2 evidência/);
});

scenario("bloqueio declarado apresenta motivo e decisão humana",{
  fronts:[front("NUC-M2",{status:"bloqueado",blocker:"Dependência de acesso formal"})],
  evidence:[proof("B","NUC-M2")],
},r=>{
  assert.deepEqual(kinds(r),["bloqueio"]);
  assert.match(r.findings[0].explanation,/acesso formal/);
  assert.match(r.findings[0].suggestedAction,/responsável/);
});

scenario("bloqueio sem motivo não fabrica justificativa",{
  fronts:[front("NUC-M2",{status:"bloqueado",blocker:""})],
  evidence:[proof("B","NUC-M2")],
},r=>assert.deepEqual(kinds(r),[]));

scenario("próxima ação vazia requer decisão humana",{
  fronts:[front("NUC-M3",{next_action:""})],
  evidence:[proof("C","NUC-M3")],
},r=>{
  assert.deepEqual(kinds(r),["proxima_acao"]);
  assert.equal(r.findings[0].severity,"informativo");
});

scenario("próxima ação com apenas espaços também é ausente",{
  fronts:[front("NUC-M3",{next_action:"   "})],
  evidence:[],
},r=>assert.deepEqual(kinds(r),["proxima_acao"]));

scenario("evidência observada exige conferência",{
  fronts:[front("NUC-M1")],
  evidence:[proof("P1","NUC-M1","observado")],
},r=>{
  assert.deepEqual(kinds(r),["revisao_fonte"]);
  assert.equal(r.findings[0].evidenceIds.join(","),"P1");
});

scenario("evidência não verificada exige conferência",{
  fronts:[front("NUC-M1")],
  evidence:[proof("P2","NUC-M1","nao_verificado")],
},r=>assert.deepEqual(kinds(r),["revisao_fonte"]));

scenario("fontes observada e não verificada são agrupadas",{
  fronts:[front("NUC-M1")],
  evidence:[proof("P1","NUC-M1","observado"),proof("P2","NUC-M1","nao_verificado")],
},r=>{
  assert.equal(r.findings.length,1);
  assert.equal(r.findings[0].evidenceIds.join(","),"P1,P2");
});

scenario("frente concluída sem prova verificada sinaliza atenção",{
  fronts:[front("NUC-M0",{status:"concluido"})],
  evidence:[proof("P1","NUC-M0","observado")],
},r=>assert.deepEqual(kinds(r),["evidencia_ausente","revisao_fonte"]));

scenario("frente concluída com prova verificada não é invalidada",{
  fronts:[front("NUC-M0",{status:"concluido"})],
  evidence:[proof("P1","NUC-M0","verificado")],
},r=>assert.deepEqual(kinds(r),[]));

scenario("alertas simultâneos preservam origem individual",{
  fronts:[front("NUC-M4",{status:"bloqueado",blocker:"Análise de risco",next_action:""})],
  evidence:[proof("D1","NUC-M4","divergente"),proof("P1","NUC-M4","observado")],
},r=>{
  assert.deepEqual(kinds(r),["divergencia","bloqueio","proxima_acao","revisao_fonte"]);
  assert.equal(new Set(r.findings.map(x=>x.id)).size,4);
});

scenario("evidência de outra frente não contamina diagnóstico",{
  fronts:[front("NUC-M1"),front("NUC-M4")],
  evidence:[proof("D1","NUC-M4","divergente"),proof("P1","NUC-M1")],
},r=>{
  assert.equal(r.findings.length,1);
  assert.equal(r.findings[0].workstreamCode,"NUC-M4");
});

scenario("vínculo de dependência só conta quando explicitamente cadastrado",{
  fronts:[front("NUC-M4"),front("NUC-M5")],
  evidence:[],
  dependencies:[{workstream_id:"NUC-M5",depends_on_id:"NUC-M4"}],
},r=>{
  assert.equal(r.declaredDependencies,1);
  assert.deepEqual(kinds(r),[]);
});

scenario("dependência inexistente não é inventada",{
  fronts:[front("NUC-M4"),front("NUC-M5")],
  evidence:[],
  dependencies:[{workstream_id:"NUC-M5",depends_on_id:"OUTRO"}],
},r=>assert.equal(r.declaredDependencies,0));

scenario("registro-pai módulo não produz alertas de frente",{
  fronts:[front("NUC",{kind:"modulo",status:"concluido",next_action:""})],
  evidence:[],
},r=>assert.equal(r.findings.length,0));

scenario("quarenta e duas provas sintéticas verificadas, zero alertas",{
  fronts:[front("NUC-M0"),front("NUC-M1"),front("NUC-M2"),front("NUC-M3"),front("NUC-M4"),front("NUC-M5")],
  evidence:Array.from({length:42},(_,i)=>proof("S"+i,"NUC-M"+(i%6))),
},r=>{
  assert.equal(r.evidenceCount,42);
  assert.equal(r.findings.length,0);
});

console.log("M5 HOMOLOGAÇÃO: " + checks + " cenários sintéticos aprovados; zero escrita, sem uso do Core.");
