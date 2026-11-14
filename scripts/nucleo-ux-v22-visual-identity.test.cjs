#!/usr/bin/env node
"use strict";
/** UI contract: inspect scoped visual classes and known authority messages.
 * No snapshot claims about authenticated visual behavior.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const root="src/components/nucleo/";
const read=name=>fs.readFileSync(root+name+".tsx","utf8");
const css=fs.readFileSync("src/styles/nucleoVisualV22.css","utf8");
const center=read("NucleoDevelopmentCenter");
const atlas=read("NucleoOperationalAtlas");
const executive=read("NucleoExecutiveDevelopment");
const ficha=read("NucleoModuleKnowledge");
const specialist=read("NucleoSpecialistContributions");
const governance=read("NucleoAC01DocumentGovernance");
const desk=read("NucleoContributionDesk");
const sources=[center,atlas,executive,ficha,specialist,governance,desk];
const assertHas=(code,part,label)=>assert(code.includes(part),label);
assertHas(center,'import "@/styles/nucleoVisualV22.css"',"Visual theme imported only in Central");
assertHas(center,'className="nucleo-v22 space-y-4"',"Visual theme scoped");
for(const [name,color] of Object.entries({blue:"#1a73e8",yellow:"#fbbc04",green:"#34a853",red:"#ea4335"})) {
  assert(css.includes(color), "Palette "+name);
}
for(const [name,src] of Object.entries({
  center,atlas,executive,ficha,specialist,governance,desk,
})) {
  assertHas(src,"nucleo-v22-","UI classes in "+name);
}
assertHas(center,'<NucleoExecutiveDevelopment',"Existing Executive");
assertHas(center,'<NucleoOperationalAtlas',"Existing Atlas");
assertHas(center,'<NucleoSupervisionPanel',"Existing Supervision");
assertHas(center,'<NucleoTechnicalEvidence',"Existing evidence");
assertHas(center,'nucleo-v22-board-column',"Kanban retained");
assertHas(center,'data-state={state.key}',"Status cards reflect actual M3 status");
assertHas(center,'border-l-rose-500',"Blocked border remains");
assertHas(center,'border-l-amber-500',"Validation border remains");
assertHas(center,'border-l-emerald-500',"Done with evidence border remains");
for(const tone of ["rose","amber","emerald"]){
  assertHas(css,'.nucleo-v22-card-hover.border-l-'+tone+'-500',"Borders with real-status priority: "+tone);
}
assertHas(atlas,"Nenhum módulo corresponde à busca atual.","Existing empty state");
assertHas(atlas,"NucleoSpecialistContributions","Specialist access");
assertHas(atlas,"NucleoMandateRegistry","Mandate reading");
assertHas(ficha,'authority_state:"rascunho"',"FM draft authority");
assertHas(ficha,'.eq("id",result.data.id).maybeSingle()',"FM readback");
assertHas(ficha,"Comparação integral indisponível:","Conservative diff limitations");
assertHas(specialist,'check.data.authority_state!==(parent?"em_evolucao":"proposta")',"AC01 readback authority");
assertHas(specialist,"Publicação interna AC-01 não comprova atualização canônica","AC01 disclosure");
assertHas(specialist,'nucleo-v22-guard',"Warnings visually prominent");
assertHas(governance,"Publicação interna AC-01 não comprova a vigência","Internal vs canonical distinction");
assertHas(governance,'Prévia de reconciliação canônica — bloqueada',"Canonical gate closed");
assertHas(governance,'{published.length} publicações AC-01 no recorte',"Only internal counts displayed");
assertHas(desk,"Nenhuma dessas ações constitui decisão homologatória","Consultative desk only");
const styleTokens = [".nucleo-v22-banner",".nucleo-v22-surface",".nucleo-v22-card-hover",
 ".nucleo-v22-pill",".nucleo-v22-guard",".nucleo-v22-status-tile"];
for(const token of styleTokens)assertHas(css,token,"Shared scoped style "+token);
assert.match(css,/\.dark \.nucleo-v22/,"Dark mode considered");
assert.match(css,/@media \(max-width: 640px\)/,"Mobile density rules");
console.log("Núcleo V2.2: identidade visual escopada, estados reais e contratos documentais preservados");
