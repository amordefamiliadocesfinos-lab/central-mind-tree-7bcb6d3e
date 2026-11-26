#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const src=fs.readFileSync("src/components/nucleo/NucleoDevelopmentCenter.tsx","utf8");
const editor=src.slice(src.indexOf('id="nucleo-m3-workstream-detail"'));
assert(editor.length>8000,"Existing complete M3 editor still present");
const requirements=[
  "NÚCLEO / FOCO / EXECUÇÃO",
  "O que fazer agora",
  "Atualizar próxima ação",
  "Alterações não salvas nesta frente",
  "Voltar aos filtros de frentes",
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
assert(editor.indexOf("O que fazer agora")<editor.indexOf("Editar demais dados da frente"),
  "Next Action must be above advanced editor fields");
assert(editor.indexOf("Consultar provas M4")>editor.indexOf("Editar demais dados da frente"),
  "Evidence remains an optional detail");
assert(src.includes('setExpandedEvidenceFor(current=>current===selected.id?null:selected.id)'),"Evidence lazy toggle");
assert(src.includes('id="nucleo-din-focus"'),"Return to focus target");
const create=src.slice(src.indexOf("const addItem ="),src.indexOf("const addDependency ="));
assert(src.includes('acceptance_criteria: "", next_action: ""'),"Optional creation action starts empty");
assert(src.includes('value={draft.next_action}'),"Creation exposes next action");
assert.match(create,/next_action: draft\.next_action\.trim\(\)/,"Creation includes explicit next action");
assert(create.includes('.insert(payload).select("id").maybeSingle()'),"Existing writer preserved");
assert(create.includes('Object.entries(payload).every(([key,value])=>record[key]===value)'),"Readback includes action");
assert(create.includes('matches(audit.data.after_state as Record<string,unknown>)'),"Creation event verifies action");
assert(create.includes("setDraft(emptyDraft)"),"Successful creation clears draft");
assert(editor.indexOf('aria-label="O que fazer agora"')<editor.indexOf('aria-label="Navegação operacional das frentes CRM"'),"Canonical action precedes module shortcuts");
assert(editor.includes('selected.next_action.trim()||"Nenhuma próxima ação registrada nesta frente."'),"Read mode uses persisted record, not draft");
assert(editor.includes('Editar próxima ação'),"Editing is explicit");
assert(editor.includes('Responsável declarado')&&editor.includes('Bloqueio registrado'),"Declared actor and blocker visible");
assert(editor.includes('Voltar à visão geral')&&src.includes('id="nucleo-overview-heading"'),"Direct overview return with focus");
console.log("UX-DIN-05: priority action, progressive editor, M4 on demand and history safety PASS");

const ts=require("typescript"),vm=require("node:vm");
const helper=fs.readFileSync("src/lib/nucleo/managerActionV13.ts","utf8");
const out=ts.transpileModule(helper,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const env={exports:{}};vm.runInNewContext(out,env);
const excerpt=env.exports.explicitNextActionExcerpt;
const literal="reconciliar método com o especialista, sem fabricar resultado. Não equivale a homologação.";
assert.equal(excerpt("Contexto histórico. Próxima ação: "+literal+"\n\nRevisão documental posterior."),literal);
assert.equal(excerpt("Somente texto sem marcador."),null);
assert.equal(excerpt("Próxima ação: Conferir fonte. Próxima ação: Conferir outro dado."),null);
assert(editor.includes("Registro integral, contexto e ressalvas")&&editor.includes("{selected.next_action}"),"Full source still visible on demand");
assert(src.includes("Atalhos de acompanhamento dos outros módulos")&&src.includes("Panorama detalhado das frentes"),"Reduce repeated blocks without dropping callbacks");

/* U06: a atualização auditada pode declarar ação vigente após histórico. */
const currentAction="reconciliar campanha existente com Digital, sem disparos. Operador independente/CA15 continua adiado; orientações anteriores são históricas.";
assert.equal(excerpt("Histórico. Próxima ação: ensaio do operador independente.\n\nCheckpoint U03. Ação vigente: "+currentAction),currentAction);
assert.equal(excerpt("Próxima ação: etapa antiga.\n\nPróxima ação: outra etapa antiga.\n\nCheckpoint. Ação vigente: "+currentAction),currentAction);
assert.equal(excerpt("Próxima ação: etapa antiga.\n\nAção vigente: Conferir fonte.\n\nAção vigente: Conferir outra fonte."),null);
assert.equal(excerpt("Próxima ação: etapa antiga.\n\nAção vigente:"),null);
assert(editor.includes("Trecho literal da ação explicitamente registrada."),"Label does not misidentify marker");
