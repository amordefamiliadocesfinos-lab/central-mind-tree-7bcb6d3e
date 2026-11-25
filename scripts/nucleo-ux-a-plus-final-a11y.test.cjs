#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const a=fs.readFileSync("src/components/nucleo/NucleoOperationalAtlas.tsx","utf8");
const g=fs.readFileSync("src/components/nucleo/NucleoGuidedJourneys.tsx","utf8");
for(const [s,word,why] of [
 [a,'aria-label="Localização dentro do Núcleo"',"Module breadcrumb"],
 [a,'aria-current="page"',"Current section named"],
 [a,'id="nucleo-atlas-module-heading" tabIndex={-1}',"Programmatic focus target"],
 [a,'heading?.focus({preventScroll:true})',"Focus after module selection"],
 [a,'heading?.scrollIntoView({behavior:"smooth",block:"start"})',"Find context after selection"],
 [a,'if ((fmDraftState.dirty || specialistDraftState.dirty) && !window.confirm(',"Dirty guard before navigation"],
 [a,'if (fmDraftState.busy || specialistDraftState.busy)',"No navigation during write"],
 [a,'<NucleoModuleDiscovery',"Module discovery unchanged"],
 [a,'<NucleoAc02ContinuityRead',"Continuity preserved"],
 [a,'<NucleoSpecialistContributions',"Specialist AC01 preserved"],
 [g,'role="progressbar"',"Progress is accessible"],
 [g,'aria-valuemin={1}',"Progress min"],
 [g,'aria-valuemax={selected.steps.length}',"Progress max"],
 [g,'aria-valuenow={activeIndex+1}',"Progress current step"],
 [g,'somente leitura, não comprova execução',"No fictitious completion"],
 [g,'aria-pressed={index===activeIndex}',"Guide keyboard active state"],
])assert(s.includes(word),why);
const m3=fs.readFileSync("src/components/nucleo/NucleoDevelopmentCenter.tsx","utf8");
assert(m3.includes("const openTreeItem = (id: string) => {"));
assert(m3.includes("if (!choose(id)) return;"));
assert(m3.includes('detail?.focus({preventScroll:true})'));
assert(m3.includes('detail?.scrollIntoView({behavior:"auto",block:"start"})'));
for(const item of ["mod","front","sub"]){
 assert(m3.includes("onClick={() => openTreeItem("+item+".id)}"));
 assert(m3.includes('aria-current={selectedId==='+item+'.id?"true":undefined}'));
}
console.log("UX A+ final: module location, focus and non-operational guide accessibility PASS");
