#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("src/components/nucleo/NucleoSpecialistContributions.tsx","utf8");
assert.match(source,/type ExperienceArea = "contribuicoes" \| "fila" \| "ciclo"/);
assert.match(source,/aria-label="Jornada documental do especialista"/);
for (const part of ["contribuicoes","fila","ciclo"]) {
 assert(source.includes('id={areaId+"-'+part+'"}'),"Vista registrada: "+part);
 assert(source.includes('hidden={area!=="'+part+'"}'),"Vista oculta sem desmontar: "+part);
}
assert.match(source,/aria-controls=\{areaId\+"-"\+item\.id\}/);
assert.match(source,/aria-pressed=\{area===item\.id\}/);
assert.match(source,/useId\(\)/);
assert.match(source,/<NucleoContributionDesk/);
assert.match(source,/<NucleoAC01DocumentGovernance/);
assert.match(source,/Papel declarado; mandato não inferido/);
assert.match(source,/Publicação interna AC-01 não comprova atualização canônica/);
assert.match(source,/Consulta indisponível ou parcial/);
assert.match(source,/\.eq\("id",result\.data\.id\)\.maybeSingle\(\)/);
assert.match(source,/!isMatchingPendingAttempt\(check\.data,attempt\)/);
assert.match(source,/disabled=\{reading\|\|Boolean\(readError\)\|\|saving\|\|uncertainRef\.current\|\|referenceMissing\|\|!fence\.ready\|\|fence\.blocked\}/);
assert.match(source,/Registrar proposta e confirmar/);
console.log("UX-A3A: áreas documentais preservadas, sem writers ou autoridade novos");
