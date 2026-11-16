#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const src=fs.readFileSync("src/components/nucleo/NucleoDevelopmentCenter.tsx","utf8");
const editor=src.slice(src.indexOf('id="nucleo-m3-workstream-detail"'));
assert(editor.length>8000,"Existing complete M3 editor still present");
const requirements=[
  "NÚCLEO / FOCO / EXECUÇÃO",
  "PRÓXIMA AÇÃO · EDITÁVEL",
  "Atualizar próxima ação",
  "Alterações não salvas nesta frente",
  "Voltar ao foco",
  "Editar demais dados da frente",
  "Consultar provas M4",
  "Consulta de evidências técnicas M4",
  "expandedEvidenceFor===selected.id&&<NucleoTechnicalEvidence workstreamId={selected.id} />",
  "Dependências registradas",
  "Histórico M3 no recorte",
  "selectedHistory.map(event",
  "onClick={addDependency}",
  "onClick={saveItem}",
  "disabled={saving || !hasPendingChanges}",
  "if (hasPendingChanges && !window.confirm(",
  "if (saving) {",
];
for(const req of requirements)assert(src.includes(req),"DIN-05 inherited functional guarantee: "+req);
assert.equal(editor.split('value={edit.next_action||""}').length-1,1,"One controlled Next Action input");
assert.equal(editor.split('onClick={saveItem}').length-1,1,"One visible save action");
assert(editor.indexOf("PRÓXIMA AÇÃO · EDITÁVEL")<editor.indexOf("Editar demais dados da frente"),
  "Next Action must be above advanced editor fields");
assert(editor.indexOf("Consultar provas M4")>editor.indexOf("Editar demais dados da frente"),
  "Evidence remains an optional detail");
assert(src.includes('setExpandedEvidenceFor(current=>current===selected.id?null:selected.id)'),"Evidence lazy toggle");
assert(src.includes('id="nucleo-din-focus"'),"Return to focus target");
console.log("UX-DIN-05: priority action, progressive editor, M4 on demand and history safety PASS");
