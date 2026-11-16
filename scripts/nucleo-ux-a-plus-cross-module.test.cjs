#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const d=fs.readFileSync("src/components/nucleo/NucleoModuleDiscovery.tsx","utf8");
const g=fs.readFileSync("src/components/nucleo/NucleoGuidedJourneys.tsx","utf8");
const scopes=fs.readFileSync("src/lib/nucleo/moduleScreenDiscoveriesV12.ts","utf8");
for(const token of [
 'MODULE_JOURNEYS_V12[module.id]??[]',
 'MODULE_CONTROLS_V12[module.id]??[]',
 'MODULE_SCREENS_V12[module.id]??[]',
 'const anchor=(kind:"screens"|"controls"|"procedures")',
 'module.id==="CRM"',
 'setSearch("")',
 'requestAnimationFrame(()=>',
 'aria-label={"Explorar telas, controles e roteiros existentes de "+module.name}',
 'disabled={item.total===0}',
 'item.total||"não verificado"',
 'id={module.id==="CRM"?"nucleo-crm-screens":anchor("screens")}',
 'id={module.id==="CRM"?"nucleo-crm-controls":anchor("controls")}',
 'onClick={()=>go("procedures")}',
 'target="_blank" rel="noopener noreferrer"',
])assert(d.includes(token),"No cross-module navigation or safe fallback: "+token);
for(const code of ["FIN","OPE","ROT","CAP","DIG","ASS"]){
 assert(scopes.includes(code+":["),"Preexisting sourced module must be covered: "+code);
}
assert(g.includes('"nucleo-module-"+module.id.toLowerCase()+"-procedures"'),"Generic guide target");
assert(g.includes('if(journeys.length===0)return null'),"Do not invent empty journeys");
assert(g.includes('não salva progresso'),"No fabricated task completion");
assert(d.includes('onClick={()=>openRelatedJourney(item.label)}'),"Control must link to related guide");
assert(d.includes('journey.steps.some(step=>step.controlLabel===item.label)'),"Only documented related controls may link");
assert(d.includes('request={journeyRequest}'),"Guide receives explicit request");
assert(g.includes('found?.steps.findIndex(step=>step.controlLabel===request.controlLabel)'),"Guide selects matching step, not arbitrary instruction");
assert(g.includes('setActiveIndex(index)'),"Guide opens at exact catalogued step");
// A busca deve informar vazio segundo os resultados realmente exibidos na área.
assert(d.includes('mode==="funcoes"\n      ? visibleScreens.length===0&&visibleControls.length===0&&visibleSources.length===0'),"Functional empty state covers visible cards");
assert(d.includes(': visibleSources.length===0&&visibleOriginals.length===0'),"Knowledge empty state ignores hidden controls/screens");
assert(d.includes('Nenhum item corresponde à busca.'),"No-result feedback remains visible");
console.log("UX A+ transversal: sourced controls/routes/guides with explicit gaps and no duplicate catalog PASS");
