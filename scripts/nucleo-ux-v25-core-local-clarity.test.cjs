#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const page=fs.readFileSync("src/pages/Nucleo.tsx","utf8");
const governance=fs.readFileSync("src/components/nucleo/NucleoAC01DocumentGovernance.tsx","utf8");
for(const [src,fragment,why] of [
[page,'const [developmentMode, setDevelopmentMode] = useState(true)',"Management is the default"],
[page,'aria-label="Ambientes do Núcleo"',"Explicit environment navigation"],
[page,'aria-pressed={developmentMode}',"Work selection state"],
[page,'aria-pressed={!developmentMode}',"Library selection state"],
[page,'Acompanhar trabalho',"Human-facing work entry"],
[page,'Biblioteca local',"Local library entry"],
[page,'Buscar páginas locais · ',"Search scope is explicit"],
[page,'{!developmentMode && <Button',"Backup kept in library context"],
[page,'{developmentMode ? (',"Core-specific sidebar conditional"],
[page,'{!developmentMode && <aside',"Local sidebar only in library"],
[page,'!developmentMode && "lg:grid-cols-[252px_minmax(0,1fr)]"',"Full width management surface"],
[page,'Áreas da Biblioteca local',"Legacy 8 areas preserved"],
[page,'<NucleoDevelopmentCenter />',"Original Core renderer"],
[page,'<NucleoDriveReferences />',"Drive references preserved"],
[page,'handleExportLegacy',"Local backup preserved"],
[governance,'{key:"vigente",title:"Vigência e comprovação"}',"Truthful UI only"],
[governance,'tab==="vigente"',"Stable internal query key"],
[governance,'publicações internas AC-01 — sem atualização automática da fonte canônica',"Internal != canonical"],
[governance,'Vigente canônico exige fonte original + ato competente + sincronização comprovada.',"Canonical proof warning"],
[governance,'role="alert"',"Error announced"],
[governance,'role="status"',"Loading announced"],
]){
assert(src.includes(fragment),why);}
assert(!page.includes('maturidade documental'));
console.log("UX V2.5: Core/local separation and AC01 evidence labels PASS");
