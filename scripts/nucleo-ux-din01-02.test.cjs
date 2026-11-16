#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const center=fs.readFileSync("src/components/nucleo/NucleoDevelopmentCenter.tsx","utf8");
const panorama=fs.readFileSync("src/components/nucleo/NucleoPanoramaDinV30.tsx","utf8");
const check=(src,part,why)=>assert(src.includes(part),why);
for(const [part,why] of [
["<NucleoPanoramaDinV30 workstreams={items}","Panorama reused on existing route"],
["onFocusModule={moduleId=>","Module shortcut is real"],
["onFocusStatus={status=>","Status shortcut is real"],
["const [moduleFocusId,setModuleFocusId] = useState(\"\")","Module filter state"],
["const [specialistFocus,setSpecialistFocus] = useState(\"\")","Declared specialist filter state"],
["item.kind !== \"modulo\"","Frentes not module roots"],
["moduleIdForWorkstream(item,byId)===moduleFocusId","Linked module recorte"],
["item.specialist.trim()===specialistFocus","Specialist recorte"],
["onChange={e=>setModuleFocusId(e.target.value)}","Module selector"],
["onChange={e=>setSpecialistFocus(e.target.value)}","Specialist selector"],
["Limpar foco","Focus has clear action"],
["role=\"status\"","Active focus announced"],
["setExecutiveVisited(true);setExecutiveExpanded(v=>!v);","Executive details progressive"],
["setSupervisionExpanded(v=>!v)","Supervision progressive"],
["<NucleoExecutiveDevelopment","Executive retained"],
["<NucleoSupervisionPanel","Supervision retained"],
["<NucleoOperationalAtlas","Atlas retained"],
["hasPendingChanges && !window.confirm(","Dirty guard retained"],
["if (saving) {","Saving blocks selection"],
["client.from(\"nucleo_development_workstreams\").select(\"*\").order(\"code\")","Core read unchanged"],
])check(center,part,why);
for(const [part,why] of [
["export function moduleIdForWorkstream","Parent-child mapping"],
['parent.kind === "modulo"',"Direct relation"],
['grandparent?.kind === "modulo"',"Subfront relation"],
['item.kind !== "modulo" && item.code !== "NUC"',"Only eligible fronts"],
['total === 0',"Zero denominator handled"],
['n / total * 100',"Percentages only with real denominator"],
['onFocusStatus(state.key)',"Status legend actionable"],
['onFocusModule(group.module.id)',"Module groups actionable"],
['Concluídas declaradas',"No subjective project completion"],
['não comprovam avanço integral do módulo',"No inferred maturity"],
['Ver distribuição por módulo',"Collapsed details"],
])check(panorama,part,why);
assert(!panorama.includes("Maturidade geral"));
console.log("UX-DIN-01/02: factual overview, module/specialist focus and inherited guards verified");
