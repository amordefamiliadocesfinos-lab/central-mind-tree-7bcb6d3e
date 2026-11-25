#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
// Os resultados das funções transpíladas vêm de outro contexto vm.
const assertPairs=(actual,expected)=>assert.equal(JSON.stringify(actual),JSON.stringify(expected));
const fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript");
function load(path){
  const output=ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
  assert.equal((output.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
  const sandbox={exports:{}};vm.runInNewContext(output.outputText,sandbox,{timeout:1000});return sandbox.exports;
}
const {compareDocumentVersionsV13}=load("src/lib/nucleo/documentDiffV13.ts");
const {numberDocumentDiffLinesV13}=load("src/lib/nucleo/documentDiffPresentationV13.ts");
const diff=compareDocumentVersionsV13("cabeçalho\nantigo\nrodapé","cabeçalho\nnovo\nrodapé");
assert.equal(diff.state,"completo");assert.equal(diff.included,1);assert.equal(diff.removed,1);
const numbered=numberDocumentDiffLinesV13(diff.lines);
assertPairs(numbered.filter(x=>x.kind==="igual").map(x=>[x.beforeLine,x.afterLine]),[[1,1],[3,3]]);
assertPairs(numbered.filter(x=>x.kind==="removido").map(x=>[x.beforeLine,x.afterLine,x.value]),[[2,null,"antigo"]]);
assertPairs(numbered.filter(x=>x.kind==="incluido").map(x=>[x.beforeLine,x.afterLine,x.value]),[[null,2,"novo"]]);
assert.equal(diff.lines[0].beforeLine,undefined,"Motor original sem mutação");
assertPairs(numberDocumentDiffLinesV13(compareDocumentVersionsV13("x\ny","x\ny").lines).map(x=>[x.beforeLine,x.afterLine]),[[1,1],[2,2]]);
for (const huge of ["x".repeat(12001),"linha\n".repeat(181)]){
  const rejected=compareDocumentVersionsV13(huge,"texto");
  assert.equal(rejected.state,"indisponivel");assert.equal(rejected.lines.length,0);
}
const ui=fs.readFileSync("src/components/nucleo/NucleoModuleKnowledge.tsx","utf8");
for(const part of ["Comparação de versões AC-01","Versão A — origem","Versão B — destino da comparação",
"Identificação e fontes das versões comparadas","numberDocumentDiffLinesV13(comparison.lines)",
"Comparação integral indisponível:","Preparar refinamento da versão selecionada",'authority_state:"rascunho"']){
  assert(ui.includes(part),"Elemento preservado: "+part);
}
assert.match(ui,/SourceReferences reference=\{older\.source_reference\}/);
assert.match(ui,/SourceReferences reference=\{newer\.source_reference\}/);
assert.match(ui,/role="region" tabIndex=\{0\}/);
assert.match(ui,/\.eq\("id",result\.data\.id\)\.maybeSingle\(\)/);
console.log("UX-A4: linhas A/B reais, origem, limitações e autoridade preservadas");

// P6 UX-H06: leitura antes de edição, abertura explícita e cancelamento protegido.
assert(ui.includes('const [editorOpen,setEditorOpen]=useState(false)'),"Default read mode");
assert(ui.includes('aria-label="Leitura da revisão atual"')&&ui.includes('Criar rascunho'),"Read and explicit draft action");
assert(ui.includes('hidden={!editorOpen}')&&ui.includes('onClick={cancelDraftEditor}'),"Progressive form and cancellation");
assert(ui.includes('if(draftDirty&&!window.confirm("Descartar este rascunho não salvo?'),"Do not silently discard unsaved text");
assert(ui.includes('setValidationError(null);\n    openDraftEditor();'),"Refining a version opens draft explicitly");
assert(ui.includes('aria-label="Comparação de versões AC-01"')&&ui.includes('Comparar versões'),"Comparison remains available");
