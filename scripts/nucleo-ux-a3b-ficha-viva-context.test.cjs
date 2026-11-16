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
// V1.3 UX-3: mesma frente M3, mesmo contexto FM-09, sem espelhar dados.
const fm=fs.readFileSync("src/components/nucleo/NucleoModuleKnowledge.tsx","utf8");
for(const token of [
 'const [fmSectionRequest,setFmSectionRequest]',
 'const openFm09Continuity=()=>',
 'setFmSectionRequest(previous=>({section:"FM-09",seq:(previous?.seq??0)+1}))',
 'onClick={openFm09Continuity}',
 'onOpenWorkstream={onSelectWorkstream}',
 'requestedSection={fmSectionRequest}',
 'setFmSectionRequest(null)',
])assert(text.includes(token),"Retomada M3 / FM-09: "+token);
for(const token of [
 'requestedSection?:{section:FMSection;seq:number}|null',
 'if(requestedSection?.section)setSection(requestedSection.section)',
 'onClick={()=>onOpenWorkstream(front.id)}',
 'Abrir ficha M3 desta frente',
 'onOpenWorkstream&&',
])assert(fm.includes(token),"Ficha FM-09: "+token);
assert(text.includes('selectedRecord && (moduleSection==="conhecimento" || knowledgeVisited)'),"Preservar a Ficha Viva montada");
console.log("UX-A3B: acesso contextual bidirecional, painéis montados após visita, autoridades preservadas");
