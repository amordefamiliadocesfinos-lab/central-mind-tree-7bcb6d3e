/**
 * Núcleo 2.0 V1.3 — vínculos consultivos entre FM e os catálogos EXISTENTES.
 * Não gera conteúdo FM, não substitui revisões Core e não comprova deploy/UAT.
 * Valores de referência originais permanecem texto, sem URL pública presumida.
 */
import { MODULE_SCREENS_V12 } from "./moduleScreenDiscoveriesV12";
import { MODULE_CONTROLS_V12 } from "./moduleControlDiscoveriesV12";
import { MODULE_JOURNEYS_V12 } from "./moduleJourneysV12";
import { MODULE_ORIGINAL_SOURCES_V12 } from "./moduleOriginalSourcesV12";
import { MODULE_PROVENANCE } from "./operationalProvenanceV12";
import { CRM_CONTINUITY_CHECKPOINTS_V12 } from "./crmAuthoritySourcesV12";
import { CRM_DRAFTS } from "./operationalDraftsV12";

export type FmEvidenceSection="FM-01"|"FM-02"|"FM-03"|"FM-04"|"FM-05"|"FM-06"|"FM-07"|"FM-08"|"FM-09"|"FM-10";
export type FmEvidenceLink=Readonly<{
 key:string;title:string;detail:string;
 evidence:"codigo_catalogado"|"referencia_historica"|"documento_declarado";
 reference:string;url:string|null;
}>;
const codeLink=(key:string,title:string,detail:string,url:string):FmEvidenceLink=>({
 key,title,detail,evidence:"codigo_catalogado",reference:url,url,
});
const documented=(key:string,title:string,detail:string,reference:string):FmEvidenceLink=>({
 key,title,detail,evidence:"referencia_historica",reference,url:null,
});
export function fmLinkedEvidence(moduleCode:string,section:FmEvidenceSection):readonly FmEvidenceLink[]{
 const screens=MODULE_SCREENS_V12[moduleCode]??[];
 const controls=MODULE_CONTROLS_V12[moduleCode]??[];
 const journeys=MODULE_JOURNEYS_V12[moduleCode]??[];
 const originals=MODULE_ORIGINAL_SOURCES_V12[moduleCode]??[];
 const provenance=MODULE_PROVENANCE[moduleCode];
 switch(section){
  case "FM-04":return screens.map(item=>codeLink(
    "screen:"+item.id,item.name,
    item.description+" · "+(item.route??"Acesso pela navegação do módulo")+" · "+item.limitation,
    item.source,
  ));
  case "FM-05":return controls.map(item=>codeLink(
    "control:"+item.label,item.label,
    item.screen+" · Pré-condição: "+item.prerequisite+" · Conferir: "+item.confirmation+
      " · Limite: "+item.limitation,
    item.source,
  ));
  case "FM-06":return journeys.flatMap(journey=>journey.steps.flatMap((step,index)=>{
    const screen=screens.find(item=>item.id===step.screenId);
    if(!screen)return [];
    const control=step.controlLabel?controls.find(item=>item.label===step.controlLabel):null;
    return [codeLink("journey:"+journey.id+":"+index,journey.title+" · "+step.task,
      "Passo "+(index+1)+" · "+screen.name+(control?" · "+control.label:"")+
      " · Confirmação orientativa: "+step.verify+" · "+step.limit,
      control?.source??screen.source)];
  }));
  case "FM-07":return [
    ...(provenance?.sources??[]).map((item,index)=>({
      key:"source:"+index,title:item.label,detail:item.note,
      evidence:item.authority==="codigo_verificado"?"codigo_catalogado" as const:"documento_declarado" as const,
      reference:item.path,url:item.path,
    })),
    ...originals.map(item=>documented("original:"+item.id,item.title,
      item.sourceStatus+" · "+item.reconciliation,item.archive+" / "+item.originalFile)),
  ];
  case "FM-08":return [
    ...(provenance?[documented("boundary:"+moduleCode,"Fronteira do especialista",
      provenance.ownerBoundary,"Catálogo de proveniência do Núcleo V1.2")]:[]),
    ...originals.map(item=>documented("authority:"+item.id,item.title,
      item.authorityScope+" · "+item.sourceStatus,item.archive+" / "+item.originalFile)),
  ];
  case "FM-09":return moduleCode==="CRM"
    ?CRM_CONTINUITY_CHECKPOINTS_V12.map(item=>documented(
      "checkpoint:"+item.id,item.title,
      item.date+" · Estado documental: "+item.state+" · "+item.evidence+
       " · Conferir: "+item.action,
      item.sourceLocation+" / "+item.originalFile,
    ))
    :[];
  case "FM-10":return moduleCode==="CRM"&&CRM_DRAFTS["FM-10"]
    ?[documented("learning:crm-local-proposal",
      "Aprendizagem CRM — proposta local ainda não homologada",
      "Fonte de aprendizagem proposta: "+CRM_DRAFTS["FM-10"].title+
      ". A existência do modelo não comprova aprendizado registrado em operação.",
      CRM_DRAFTS["FM-10"].source)]
    :[];
  default:return [];
 }
}
