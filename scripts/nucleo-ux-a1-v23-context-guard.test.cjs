#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict"),fs = require("node:fs");
const src=fs.readFileSync("src/components/nucleo/NucleoDevelopmentCenter.tsx","utf8");
function has(s,label){assert(src.includes(s),label)}
has('const [workspaceView, setWorkspaceView] = useState<"geral" | "frentes">("geral")',"Progressive default view");
has('aria-label="Áreas da Central Visual"',"Two-level visual context");
has('aria-pressed={workspaceView === "geral"}',"Accessible overview");
has('aria-pressed={workspaceView === "frentes"}',"Accessible workstream area");
has('<NucleoOperationalAtlas workstreams={items}',"Atlas in overview");
has('<NucleoExecutiveDevelopment workstreams={items}',"Executive in workstream view");
has('hidden={workspaceView !== "geral"}',"Overview kept mounted");
has('hidden={workspaceView !== "frentes"}',"Workstreams kept mounted");
has('if (!choose(id)) return;',"Canceled navigation does not scroll");
has('if (hasPendingChanges && !window.confirm(',"Explicit discard confirmation");
has('if (saving) {',"No selection switch during writes");
has('event.preventDefault()',"Browser unload warning");
has('setEdit(item ? {',"Preserve M3 edit form");
has('setWorkspaceView("frentes")',"Direct selection opens workstreams context");
has('onOpenWorkstream={id=>',"Executive link to same selection");
has('onSelectWorkstream={id => {',"Atlas link to same selection");
has('changedEditableFields(selected, edit)',"Compare dirty against source");
has('nucleo-m3-workstream-detail',"Evidence detail kept");
has('setAtlasNavigationRequest(value => value + 1)',"Atlas navigation waits for mounted view");
has('workspaceView !== "frentes"',"Focus requires visible detail view");
has('detail.focus({ preventScroll: true })',"Focus target accessible");
has('tabIndex={-1}',"Target accepts programmatic focus");
has('managerActionExplanation(selected)',"M3 displays explanation alongside canonical action");
has('NucleoSupervisionPanel',"Supervisor kept");
has('NucleoTechnicalEvidence',"M4 evidence kept");
has('saveItem',"M3 update flow kept");
// M3: expansão consultiva do evento já carregado; sem consulta adicional nem nova escrita.
for(const key of [
  "Ver detalhes técnicos do evento","UUID do evento","UUID da frente",
  "UUID do módulo pai no evento","Estado inicial","Prioridade inicial",
  "Papel funcional inicial","Alcance de evidência inicial",
  'event.actor_auth_uid??(event.registration_origin==="administrativo_lovable"?"Registro administrativo Lovable · sem autoria humana Auth":"Não identificada no evento")',
  'event.event_type==="criado"','event.after_state.parent_id',
  'event.after_state.status','event.after_state.evidence_state',
  "não constituem homologação",
])has(key,"Missing minimal read-only M3 event detail: "+key);
has('Histórico M3 no recorte (últimos 200 eventos globais)',"History window remains explicit");
const atlas=fs.readFileSync("src/components/nucleo/NucleoOperationalAtlas.tsx","utf8");
const helper=fs.readFileSync("src/lib/nucleo/managerActionV13.ts","utf8");
assert(atlas.includes("managerActionExplanation(item)"),"Priority card explains action");
assert(atlas.includes("managerActionExplanation(front)"),"Front card explains action");
assert(atlas.includes("Ver registro técnico original"),"Original action remains accessible");
for(const key of ['item.code !== "OPE-03"','planning_source=mrp','planning_context','não criar compra de teste'])assert(helper.includes(key),"Guarded explanatory copy: "+key);
console.log("UX-A1/V2.3: Atlas focus, manager explanation, protections and M3 history PASS");
