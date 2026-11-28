"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),ts=require("typescript"),vm=require("node:vm");
const source=fs.readFileSync("src/lib/nucleo/humanLanguageV1.ts","utf8");
const box={exports:{}};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,box);
const {humanWorkName,originalWorkReference,matchesHumanWork,knowledgeSectionLabels}=box.exports;
for(const [id,name] of Object.entries({NUC:"Núcleo",SHO:"Integração Shopee",CRM:"CRM — Relacionamento com clientes",FIN:"Financeiro",OPE:"Operações",SAU:"Saúde",DIG:"Digital",ASS:"Assistente IA",CAP:"Captura Central",ROT:"Rotina","NUC-M0":"Histórico e preservação","NUC-M1":"Gestão de documentos","NUC-M2":"Biblioteca e referências","NUC-M3":"Acompanhamento do desenvolvimento","NUC-M4":"Evidências do desenvolvimento","NUC-M5":"Supervisão e alertas"})){
 assert.equal(humanWorkName(id,"Original"),name);
 assert(matchesHumanWork(id,id,"Original"));
 assert(matchesHumanWork(name,id,"Original"));
 assert(matchesHumanWork("original",id,"Original"));
 assert.equal(originalWorkReference(id,"Original"),id+" — Original");
}
assert(matchesHumanWork("saude","SAU","Saúde / CCH"));
assert(matchesHumanWork("integracao shopee","SHO","Inventário"));
assert(!matchesHumanWork("sem relação","NUC","Original"));
assert.equal(humanWorkName("FUTURO","Título desconhecido"),"Título desconhecido");
assert.equal(humanWorkName("FUTURO",""),"FUTURO");
assert.equal(humanWorkName("constructor","Original"),"Original");
assert.equal(Object.keys(knowledgeSectionLabels).length,10);
for(let i=1;i<=10;i++)assert(knowledgeSectionLabels["FM-"+String(i).padStart(2,"0")]);
const ui=fs.readFileSync("src/components/nucleo/NucleoDevelopmentCenter.tsx","utf8");
assert(ui.includes("matchesHumanWork(term,item.code,item.title,item.specialist,item.next_action)"));
assert(ui.includes("originalWorkReference(selected.code,selected.title)"));
assert(ui.includes('explicitNextActionExcerpt(item.next_action||"")'));
assert(ui.includes("{value}</p>"));
const atlas=fs.readFileSync("src/components/nucleo/NucleoOperationalAtlas.tsx","utf8");
assert(atlas.includes("matchesHumanWork(term,item.id,item.name,item.domain"));
assert(atlas.includes("{selected.id} · {selected.name} · {selected.domain}"));
const fm=fs.readFileSync("src/components/nucleo/NucleoModuleKnowledge.tsx","utf8");
assert(fm.includes("knowledgeSectionLabels[entry.code]"));
assert(fm.includes("sections[section]"));
console.log("PASS LH02/LH03 human names, original identity, search, fallback and presentation-only separation");

// LH04: use the original navigation handler and preserve the mounted draft panels.
assert(atlas.includes("MODULE_SECTIONS.indexOf(currentModuleArea)"));
assert(atlas.includes("selectModuleArea(previousArea.id)"));
assert(atlas.includes("selectModuleArea(nextArea.id)"));
assert(atlas.includes("ordem de leitura, não progresso do trabalho"));
assert(atlas.includes('hidden={moduleSection!=="conhecimento"}'));
assert(atlas.includes('hidden={moduleSection!=="especialista"}'));

const {humanNucleusState,humanKnowledgeSection}=box.exports;
assert.equal(humanNucleusState("observado"),"Observação registrada");
assert.equal(humanNucleusState("verificado"),"Verificado na origem");
assert.notEqual(humanNucleusState("observado"),humanNucleusState("homologado"));
assert.equal(humanNucleusState("desconhecido"),"desconhecido");
assert.equal(humanKnowledgeSection("FM-10"),"Aprendizados");
assert.equal(humanKnowledgeSection("FM-99"),"FM-99");
const continuity=fs.readFileSync("src/components/nucleo/NucleoAc02NucContextRead.tsx","utf8");
assert(continuity.includes("Preparar continuidade do especialista"));
assert(continuity.includes("Conhecimento recuperado para consulta. Não representa aprovação formal."));
const evidence=fs.readFileSync("src/components/nucleo/NucleoTechnicalEvidence.tsx","utf8");
assert(evidence.includes('observado: "Observado", verificado: "Verificado na origem"'));
assert(evidence.includes("Identificação técnica: {record.external_key}"));
assert(evidence.includes('record.registration_origin === "administrativo_lovable"'));

// LH06 residual: a readable failure has a next action, preserves diagnostic
// categories and cannot expose the raw response or token.
const readFailureSource=fs.readFileSync("src/components/nucleo/NucleoAc02ContinuityRead.tsx","utf8");
const failureStart=readFailureSource.indexOf("function explainAc02ReadFailure(");
const failureEnd=readFailureSource.indexOf("// Apenas classes textuais",failureStart);
assert(failureStart>=0&&failureEnd>failureStart);
const failure=vm.runInNewContext(ts.transpileModule(readFailureSource.slice(failureStart,failureEnd)+"\nexplainAc02ReadFailure;",{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText);
for(const [status,phrase] of [[401,"Entre novamente"],[403,"Procure o responsável pelo acesso"],[404,"Solicite uma verificação"],[400,"a conferência do módulo"],[413,"a conferência do módulo"],[500,"Tente novamente"],[503,"Tente novamente"],[418,"Procure o responsável"]]){
 const result=failure({name:"FunctionsHttpError",context:{status,body:"TOKEN-PRIVADO"},message:"TOKEN-PRIVADO"});
 assert(result.includes(phrase)&&result.includes("HTTP "+status), "Human next action and diagnostic status "+status);
 assert(!result.includes("TOKEN-PRIVADO"));
 assert(!/JWT|nucleo_manage|endpoint|gateway/.test(result));
}
assert(failure({name:"FunctionsFetchError",message:"TOKEN-PRIVADO"}).includes("Confira a internet"));
assert(failure({name:"FunctionsRelayError"}).includes("Tente novamente"));
assert(failure(null).includes("Nenhum contexto foi preparado"));
