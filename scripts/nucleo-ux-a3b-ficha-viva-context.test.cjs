#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const text=fs.readFileSync("src/components/nucleo/NucleoOperationalAtlas.tsx","utf8");
for(const token of ['const [specialistVisited,setSpecialistVisited]=useState(false)','const [knowledgeVisited,setKnowledgeVisited]=useState(false)','setSpecialistVisited(false)','setKnowledgeVisited(false)']) assert(text.includes(token),"Escopo por módulo: "+token);
assert.match(text,/if \(area === "especialista"\) setSpecialistVisited\(true\)/);
assert.match(text,/setKnowledgeVisited\(true\)/);
assert.match(text,/selectedRecord && \(moduleSection==="especialista" \|\| specialistVisited\)/);
assert.match(text,/hidden=\{moduleSection!=="especialista"\}/);
assert.match(text,/selectedRecord && \(moduleSection==="conhecimento" \|\| knowledgeVisited\)/);
assert.match(text,/hidden=\{moduleSection!=="conhecimento"\}/);
assert.match(text,/hidden=\{!knowledgeOpen\}/);
assert.match(text,/onClick=\{\(\) => selectModuleArea\("especialista"\)\}/);
assert.match(text,/onClick=\{\(\) => selectModuleArea\("conhecimento"\)\}/);
for(const name of ['NucleoMandateRegistry','NucleoSpecialistContributions','NucleoModuleKnowledge'])assert(text.includes('<'+name),"Não remover componente "+name);
assert.match(text,/Nenhuma aprovação é inferida/);
console.log("UX-A3B: acesso contextual bidirecional, painéis montados após visita, autoridades preservadas");
