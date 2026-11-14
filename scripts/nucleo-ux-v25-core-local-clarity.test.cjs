#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const page=fs.readFileSync("src/pages/Nucleo.tsx","utf8");
const governance=fs.readFileSync("src/components/nucleo/NucleoAC01DocumentGovernance.tsx","utf8");
for(const [src,fragment,why] of [
[page,'{developmentMode ? "Biblioteca local" : "Central Visual · Core"}',"Current context in header"],
[page,'{developmentMode ? (',"Core-specific sidebar conditional"],
[page,'Contexto da Central Visual',"Core side heading"],
[page,'Abrir Biblioteca local',"Action to existing local view"],
[page,'Áreas da Biblioteca local',"Legacy 8 areas preserved"],
[page,'<NucleoDevelopmentCenter />',"Original Core renderer"],
[page,'<NucleoDriveReferences />',"Drive references preserved"],
[page,'handleExportLegacy',"Local backup preserved"],
[governance,'{key:"vigente",title:"Vigência e comprovação"}',"Truthful UI only"],
[governance,'tab==="vigente"',"Stable internal query key"],
[governance,'Publicações internas AC-01 — sem atualização automática da fonte canônica',"Internal != canonical"],
[governance,'Vigente canônico exige fonte original + ato competente + sincronização comprovada.',"Canonical proof warning"],
[governance,'role="alert"',"Error announced"],
[governance,'role="status"',"Loading announced"],
]){
assert(src.includes(fragment),why);}
assert(!page.includes('maturidade documental'));
console.log("UX V2.5: Core/local separation and AC01 evidence labels PASS");
