#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const component=fs.readFileSync("src/components/nucleo/NucleoFocusPreviewV30.tsx","utf8");
const center=fs.readFileSync("src/components/nucleo/NucleoDevelopmentCenter.tsx","utf8");
for(const [src,token,meaning] of [
[center,'<NucleoFocusPreviewV30 records={sortedOperational}',"Focus preview uses same filtered list"],
[center,'if (!choose(id)) return;',"Dirty guard before opening full editor"],
[center,'nucleo-m3-workstream-detail',"Existing editor reused"],
[center,'<NucleoTechnicalEvidence',"M4 reading still available"],
[component,'records.slice(0,3)',"Compact shortlist"],
[component,'records.find(record=>record.id===previewId)??records[0]',"Selection stable when recorte changes"],
[component,'aria-pressed={preview.id===item.id}',"Accessible selected card"],
[component,'onOpenWorkstream(preview.id)',"Real editor action"],
[component,'preview.next_action.trim()', "Next action is M3 field"],
[component,'preview.evidence_state', "Declared evidence not invented"],
[component,'preview.specialist.trim()', "Declared specialist"],
[component,'new Date(preview.updated_at)', "Original update time"],
[component,'Evidência declarada não substitui prova técnica M4',"No authority confusion"],
[component,'Nenhuma frente corresponde ao foco atual',"Empty state"],
])assert(src.includes(token),meaning);
assert(!component.includes("INSERT INTO"),"Read-only focus");
console.log("UX-DIN-04: compact contextual preview and read-only M3 provenance PASS");
