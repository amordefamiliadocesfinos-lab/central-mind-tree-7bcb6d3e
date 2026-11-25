#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const source = fs.readFileSync("src/components/nucleo/NucleoOperationalAtlas.tsx", "utf8");
// UX-A2: regressões estáticas da navegação — não substituem UAT.
assert.match(source, /onClick=\{returnToModuleResults\}>Painel Geral/);
assert.doesNotMatch(source, /setLevel\("overview"\);\s*setSelectedId\(null\)/);
assert.match(source, /if \(item\.id !== selectedId\)/);
assert.match(source, /aria-hidden=\{level !== "module"\}/);
assert.match(source, /aria-label=\{selected \? "Retomar ficha do módulo "/);
const markers = ['id:"funcoes"', 'id:"desenvolvimento"', 'id:"especialista"', 'id:"conhecimento"'];
const start = source.indexOf("const MODULE_SECTIONS:");
const end = source.indexOf("];", start);
const sectionCode = source.slice(start, end);
const indexes = markers.map(value => sectionCode.indexOf(value));
assert(indexes.every(value => value >= 0), "As quatro áreas existentes devem permanecer");
assert(indexes.every((value, index) => index === 0 || value > indexes[index - 1]), "Ordem do mapa V1.0");
assert.match(source, /aria-controls="nucleo-module-section-content"/);
assert.match(source, /id="nucleo-module-section-content" role="region" tabIndex=\{-1\}/);
assert.match(source, /onClick=\{\(\) => selectModuleArea\(item\.id\)\}/);
assert.match(source, /onClick=\{returnToModuleResults\}>Voltar ao Painel Geral/);
for (const name of ["NucleoMandateRegistry", "NucleoSpecialistContributions", "NucleoModuleKnowledge", "NucleoExecutiveDevelopment"]) {
  assert(source.includes("<" + name), "Preservar estrutura: " + name);
}

// UX-02: mesma navegação intencional para os nove módulos; sem inventar funcionalidades.
assert.match(source, /aria-label=\{"Jornada funcional — "\+selected\.name\}/);
assert.doesNotMatch(source, /\{selected\.id==="CRM" && \(\s*<nav aria-label="Jornada funcional/);
assert.match(source, /onClick=\{\(\)=>openModuleStage\(step\.id\)\}/);
assert.match(source, /const prefix = selectedId==="CRM" \? "nucleo-crm-" : "nucleo-module-"\+selectedId\?\.toLowerCase\(\)\+"-"/);
for (const stage of ['telas:prefix+"screens"', 'funcionalidades:prefix+"controls"', 'procedimentos:prefix+"procedures"', 'evidencias:"nucleo-module-evidence"']) {
  assert(source.includes(stage),"UX-02 destinos reais: "+stage);
}
assert.match(source, /id="nucleo-module-evidence"/);
assert.match(source, /selectModuleArea\(area\)/);
// Jornada transversal: o conteúdo deve estar visível após o clique, não apenas selecionado.
const selectArea=source.slice(source.indexOf('  const selectModuleArea = (area: ModuleSection) => {'),source.indexOf('  const openFm09Continuity=()=>'));
assert(selectArea.includes('region?.scrollIntoView({behavior:"smooth",block:"start"})'),"A área selecionada deve ser trazida à tela");
assert(selectArea.includes('region?.focus({preventScroll:true})'),"A área deve receber foco sem segunda rolagem");
const moduleStage=source.slice(source.indexOf('  const openModuleStage = (stage: CrmStage) => {'),source.indexOf('  return (',source.indexOf('  const openModuleStage = (stage: CrmStage) => {')));
assert(moduleStage.includes('??document.getElementById("nucleo-module-section-content")'),"Sem âncora M3, evidências devem cair na explicação da área");
assert(moduleStage.includes('evidencias:"nucleo-module-evidence"'),"Preservar âncora das provas existentes");
// UX-01: cartão de atenção executiva abre a ficha real, sem criar frentes ou registros.
const coverage = fs.readFileSync("src/components/nucleo/NucleoCrossModuleCoverage.tsx", "utf8");
assert.match(source, /<NucleoCrossModuleCoverage[^\n]*onOpenWorkstream=\{onSelectWorkstream\}/);
assert.match(coverage, /attentionFront && <Button/);
assert.match(coverage, /onClick=\{\(\)=>onOpenWorkstream\(attentionFront\.id\)\}/);
assert.match(coverage, /Abrir ficha da frente \{attentionFront\.code\}/);
console.log("UX-A2/UX-01: navegação, contexto e ficha executiva real preservados");

// P6 UX-H03/H04: ordem de leitura, sem duplicar fontes ou alterar callbacks.
assert(source.indexOf('aria-label="Módulos operacionais acompanhados"')<source.indexOf('aria-label="P2-A — matriz de cobertura real por módulo"'),"Catalog first");
assert(source.includes("Detalhes da cobertura dos módulos")&&source.includes("Atividade recente e histórico"),"Technical details progressive");
assert(coverage.includes("Ver frentes, próxima ação e fontes"),"Compact module card retains details");
const supervisor=fs.readFileSync("src/components/nucleo/NucleoSupervisionPanel.tsx","utf8");
assert(supervisor.indexOf("O que pede atenção")<supervisor.indexOf("findingsShown.map(finding"),"Alert queue heading");
assert(supervisor.indexOf("findingsShown.map(finding")<supervisor.indexOf("<NucleoM2M4Reconciliation"),"Alerts before diagnostic panels");
assert(supervisor.includes("Detalhes da leitura e da governança")&&supervisor.includes("SIMULAÇÃO — DADOS FICTÍCIOS"),"Details and demo stay distinct");
