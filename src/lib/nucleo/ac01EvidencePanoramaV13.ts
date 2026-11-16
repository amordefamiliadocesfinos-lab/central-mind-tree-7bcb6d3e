/**
 * Núcleo V1.3 — panorama de prova por contribuição AC-01.
 * Fontes: somente IDs visíveis em review_events, decision_requests e decision_acts.
 * "Registro localizado" nunca certifica mandato, resolução, aprovação externa ou publicação.
 */
import type {ReviewEventV13} from "./ac01ReviewContinuityV13";
import type {DecisionRequestLinkV13,DecisionActLinkV13} from "./ac01VerifiedLinksV13";
import {verifyAc01DecisionLinks} from "./ac01VerifiedLinksV13";

export type EvidenceCheckpointV13=Readonly<{
 code:"revisao"|"encaminhamento"|"solicitacao"|"ato"|"cadeia"|"resolucao"|"fonte_externa";
 title:string;state:"registro_localizado"|"vinculo_incompleto"|"verificacao_externa";
 evidence:string;
}>;
export function buildAc01EvidencePanoramaV13(
 moduleId:string,contributionId:string,
 events:readonly ReviewEventV13[],
 requests:readonly DecisionRequestLinkV13[],
 decisions:readonly DecisionActLinkV13[],
):Readonly<{checkpoints:readonly EvidenceCheckpointV13[];brokenLinks:number;
 completeIdChains:number;resolutionConfirmed:false;publicationConfirmed:false}>{
 const scopedEvents=events.filter(x=>x.module_id===moduleId&&x.contribution_id===contributionId);
 const scopedRequests=requests.filter(x=>x.module_id===moduleId&&x.contribution_id===contributionId);
 const scopedDecisions=decisions.filter(x=>x.contribution_id===contributionId);
 const links=verifyAc01DecisionLinks(moduleId,contributionId,scopedEvents,scopedRequests,scopedDecisions);
 const full=links.lines.filter(x=>x.referralConfirmed&&x.decisionRecorded).length;
 const broken=links.lines.filter(x=>!x.referralConfirmed||!x.decisionRecorded).length+
  links.referralWithoutVisibleRequest+links.decisionsNotLinkedToVisibleRequest;
 const anyReferral=scopedEvents.some(x=>x.event_kind==="encaminhar_decisao");
 const anyReview=scopedEvents.length>0;
 const row=(code:EvidenceCheckpointV13["code"],title:string,state:EvidenceCheckpointV13["state"],evidence:string):EvidenceCheckpointV13=>({code,title,state,evidence});
 return {
  checkpoints:[
   row("revisao","Eventos de revisão",anyReview?"registro_localizado":"vinculo_incompleto",
    anyReview?scopedEvents.length+" evento(s) desta contribuição localizados no Core.":"Nenhum evento de revisão retornado; não equivale a ausência externa."),
   row("encaminhamento","Encaminhamento da revisão",anyReferral?"registro_localizado":"vinculo_incompleto",
    anyReferral?"Encaminhamento(s) registrado(s), sem constituir decisão.":"Nenhum encaminhamento visível no recorte."),
   row("solicitacao","Solicitações formais",scopedRequests.length?"registro_localizado":"vinculo_incompleto",
    scopedRequests.length?scopedRequests.length+" solicitação(ões) retornada(s) para esta contribuição.":"Nenhuma solicitação retornada no recorte."),
   row("ato","Atos decisórios",scopedDecisions.length?"registro_localizado":"vinculo_incompleto",
    scopedDecisions.length?scopedDecisions.length+" ato(s) registrado(s), sem reconfirmação de competência atual.":"Nenhum ato decisório retornado no recorte."),
   row("cadeia","Vínculos entre IDs",broken===0&&full>0?"registro_localizado":"vinculo_incompleto",
    broken>0?broken+" vínculo(s) não confirmado(s) nas fontes consultadas.":
     full>0?full+" cadeia(s) encaminhamento → solicitação → decisão verificadas por IDs.":"Nenhuma cadeia completa por IDs retornada."),
   row("resolucao","Resolução de pendências","verificacao_externa",
    "Não existe vínculo estruturado evento → pendência nem prova de baixa neste contrato."),
   row("fonte_externa","Documento vigente e publicação externa","verificacao_externa",
    "Conteúdo original, direitos de acesso, versão vigente e readback externo não foram consultados."),
  ],
  brokenLinks:broken,completeIdChains:full,resolutionConfirmed:false,publicationConfirmed:false,
 };
}
