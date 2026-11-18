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
console.log("UX-A2: módulos, contexto, retorno, navegação e componentes existentes preservados");
