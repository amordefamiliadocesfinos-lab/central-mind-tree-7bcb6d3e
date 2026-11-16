/**
 * AC-01 V1.3 — conferência de vínculos por IDs do Core.
 * Não compara conteúdos documentais, não certifica autoridade vigente,
 * nem dá baixa em pendências; cadeias incompletas permanecem explícitas.
 */
import type {ReviewEventV13} from "./ac01ReviewContinuityV13";
export type DecisionRequestLinkV13=Readonly<{
 id:string;module_id:string;contribution_id:string;review_event_id:string;
 requested_outcome:string;recorded_at:string;
}>;
export type DecisionActLinkV13=Readonly<{
 id:string;contribution_id:string;decision_request_id:string;
 outcome:string;recorded_at:string;
}>;
export function verifyAc01DecisionLinks(
 moduleId:string,contributionId:string,
 events:readonly ReviewEventV13[],
 requests:readonly DecisionRequestLinkV13[],
 decisions:readonly DecisionActLinkV13[],
){
 const referrals=new Map(events.filter(e=>e.module_id===moduleId&&
  e.contribution_id===contributionId&&e.event_kind==="encaminhar_decisao").map(e=>[e.id,e]));
 const scopedRequests=requests.filter(r=>r.module_id===moduleId&&r.contribution_id===contributionId);
 const lines=scopedRequests.map(r=>{
  const referral=referrals.get(r.review_event_id);
  const acts=decisions.filter(d=>d.contribution_id===contributionId&&d.decision_request_id===r.id);
  return {
   requestId:r.id,requestedOutcome:r.requested_outcome,
   referralId:referral?.id??null,
   referralConfirmed:!!referral,
   decisions:acts.map(d=>({id:d.id,outcome:d.outcome,recordedAt:d.recorded_at})),
   decisionRecorded:acts.length>0,
   resolutionVerified:false as const,
   externalPublicationVerified:false as const,
  };
 });
 return {
  lines,
  referralWithoutVisibleRequest:[...referrals.values()].filter(e=>!scopedRequests.some(r=>r.review_event_id===e.id)).length,
  decisionsNotLinkedToVisibleRequest:decisions.filter(d=>d.contribution_id===contributionId&&
   !scopedRequests.some(r=>r.id===d.decision_request_id)).length,
  pendingResolution:true as const,
  externalPublicationVerified:false as const,
 };
}
