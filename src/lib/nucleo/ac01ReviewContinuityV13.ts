/**
 * Núcleo V1.3 — continuidade da revisão AC-01, sem promoção de autoridade.
 * Apenas eventos append-only do Core; não há aprovação nem conclusão automática.
 */
export type ReviewEventV13=Readonly<{
 id:string;module_id:string;contribution_id:string;
 event_kind:"comentario"|"solicitar_refinamento"|"minuta_consolidacao"|"encaminhar_decisao";
 actor_auth_uid:string;recorded_at:string;body:string;
}>;
export const REVIEW_EVENT_LABELS_V13={
 comentario:"Comentário de análise",
 solicitar_refinamento:"Solicitação de refinamento",
 minuta_consolidacao:"Minuta de consolidação não homologada",
 encaminhar_decisao:"Encaminhamento para decisão (não é decisão)",
} as const;
export function summarizeAc01ReviewContinuity(
 moduleId:string,contributionId:string,events:readonly ReviewEventV13[],
){
 const visible=events.filter(e=>e.module_id===moduleId&&e.contribution_id===contributionId)
  .slice().sort((a,b)=>a.recorded_at.localeCompare(b.recorded_at)||a.id.localeCompare(b.id));
 return {
  events:visible,
  refinementRequests:visible.filter(e=>e.event_kind==="solicitar_refinamento").length,
  draftCount:visible.filter(e=>e.event_kind==="minuta_consolidacao").length,
  referrals:visible.filter(e=>e.event_kind==="encaminhar_decisao").length,
  decisionVerified:false as const,
  refinementsResolved:false as const,
  published:false as const,
 };
}
