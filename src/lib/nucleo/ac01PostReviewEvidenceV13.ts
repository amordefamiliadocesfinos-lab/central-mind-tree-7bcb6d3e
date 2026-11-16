/**
 * Núcleo V1.3 AC-01 — acompanhamento após eventos de revisão.
 * Somente indicadores de EVENTOS explicitamente retornados pelo Core. O schema
 * não possui FK evento → código da pendência, nem ato de resolução.
 * Nunca atribuir resolução a comentário, minuta, refinamento ou encaminhamento.
 */
import type {Ac01QueueIssue} from "./ac01ConsolidationQueueV13";
import type {ReviewEventV13} from "./ac01ReviewContinuityV13";
export function summarizePostReviewEvidence(
 moduleId:string,contributionId:string,
 issues:readonly Ac01QueueIssue[],
 events:readonly ReviewEventV13[],
){
 const valid=events.filter(e=>e.module_id===moduleId&&e.contribution_id===contributionId);
 const counts={
  comments:valid.filter(e=>e.event_kind==="comentario").length,
  refinementRequests:valid.filter(e=>e.event_kind==="solicitar_refinamento").length,
  drafts:valid.filter(e=>e.event_kind==="minuta_consolidacao").length,
  referrals:valid.filter(e=>e.event_kind==="encaminhar_decisao").length,
 };
 return {
  counts,
  issues:[...new Set(issues)].map(issue=>({
   issue,status:"resolucao_nao_comprovada" as const,
   linkedEventId:null as null, // Sem chave de associação no contrato atual
  })),
  eventEvidenceOnly:true as const,
  independentResolutionVerified:false as const,
  decisionVerified:false as const,
  publicationVerified:false as const,
 };
}
