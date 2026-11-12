#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function transpile(path) {
  return ts.transpileModule(fs.readFileSync(path,"utf8"),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText;
}
const supervision={exports:{}};
vm.runInNewContext(transpile("src/lib/nucleo/supervision.ts"),supervision,{timeout:1000});
const sandbox={exports:{},require:requested=>{
 if(requested==="./supervision")return supervision.exports;
 throw Error("Import unexpected: "+requested);
}};
vm.runInNewContext(transpile("src/lib/nucleo/supervision-demo.ts"),sandbox,{timeout:1000});
const {DEMO_M5_CASES,buildM5DemoSnapshot}=sandbox.exports;
assert.equal(DEMO_M5_CASES.length,5);
const expected={
 divergencia:["divergencia"],
 bloqueio:["bloqueio"],
 proxima_acao:["proxima_acao"],
 revisao_fonte:["revisao_fonte"],
 combinado:["divergencia","bloqueio","proxima_acao","revisao_fonte"],
};
let pass=0;
for(const scenario of DEMO_M5_CASES) {
  const x=buildM5DemoSnapshot(scenario.key);
  assert.deepEqual(Array.from(x.findings,f=>f.kind),expected[scenario.key]);
  assert.equal(x.informationalOnly,true);
  assert.equal(x.workstreamCount,1);
  assert.equal(x.declaredDependencies,0);
  assert.ok(x.findings.every(f=>f.workstreamCode==="DEMO-M5"&&f.explanation&&f.suggestedAction));
  assert.ok(x.findings.every(f=>f.evidenceIds.every(id=>id.startsWith("DEMO-"))));
  pass++;
}
assert.equal(buildM5DemoSnapshot("combinado").evidenceCount,2);
assert.equal(buildM5DemoSnapshot("divergencia").evidenceCount,1);
assert.equal(buildM5DemoSnapshot("bloqueio").evidenceCount,0);
assert.throws(()=>buildM5DemoSnapshot("UNKNOWN"),/Cenário desconhecido/);
const component=fs.readFileSync("src/components/nucleo/NucleoSupervisionPanel.tsx","utf8");
assert.ok(component.includes("SIMULAÇÃO — DADOS FICTÍCIOS — NÃO É ALERTA REAL"));
assert.ok(component.includes("Fechar demonstração"));
assert.ok(component.includes('setDemoCase(scenario.key)'));
assert.ok(component.includes("buildM5DemoSnapshot(demoCase)"));
assert.ok(!transpile("src/lib/nucleo/supervision-demo.ts").includes("supabase"));
assert.ok(!transpile("src/lib/nucleo/supervision-demo.ts").includes("fetch("));
console.log("M5 DEMO: "+pass+" cenários visuais sintéticos PASS; isolamento sem Core confirmado.");
