/** CCH E5-D: contract proposal only; no database queries, writes, or enabled UI.
 * Session review is an explicit, authored M4 note—not an inferred M9 check-in.
 * This validator prepares a future E5SessionReview after authorized persistence.
 */
import type {E5SessionReview} from "./e5ProvenanceAdapter";
import {validE5Date} from "./longitudinalEvidenceE5.js";
export type M4ReviewEvent={
 id:string;athlete_id:string;session_id:string;
 event_type:string;source:string;occurred_at:string;
 created_by_auth_user_id:string|null;payload:unknown;
};
export type SessionReviewSource={
 athlete_id:string;session_id:string;status:string;record_status:string;
};
export type ConsentPlan={
 contract:"cch-e5d-consent-plan-v1";targetTable:"health_consents";
 proposedType:"e5_personalized_review";currentSchemaAccepts:false;
 requiresVersionedMigration:true;requiresExplicitAthleteAction:true;
 mayReuseGenericProcessingConsent:false;writeAuthorized:false;
};
export const consentPlan:ConsentPlan={
 contract:"cch-e5d-consent-plan-v1",targetTable:"health_consents",
 proposedType:"e5_personalized_review",currentSchemaAccepts:false,
 requiresVersionedMigration:true,requiresExplicitAthleteAction:true,
 mayReuseGenericProcessingConsent:false,writeAuthorized:false
};
const validTime=(s:string)=>validE5Date(s)&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(s);
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x);
/** Refuses third-party, system, cross-athlete, unsourced and ambiguous notes.
 * The event already persisted in M4 would be immutable audit provenance.
 * This prototype does not create events or grant any new permissions.
 */
export function reviewFromExistingM4Event(
 event:M4ReviewEvent,session:SessionReviewSource,authorizedActorId:string
):{review:E5SessionReview|null;missing:string[]}{
 const missing:string[]=[];
 if(!session.athlete_id.trim()||!session.session_id.trim()||
   event.athlete_id!==session.athlete_id||event.session_id!==session.session_id)
  missing.push("athlete_session_mismatch");
 if(session.status!=="completed"||session.record_status!=="active")
  missing.push("session_not_valid");
 if(event.event_type!=="note"||event.source!=="user"||!event.id.trim()||
   !authorizedActorId.trim()||!event.created_by_auth_user_id?.trim()||event.created_by_auth_user_id!==authorizedActorId)
  missing.push("authored_user_note_required");
 if(!validTime(event.occurred_at))missing.push("invalid_event_time");
 const p=object(event.payload)?event.payload:{};
 if(p.contract!=="cch-e5-session-review-v1"||p.explicit_confirmation!==true)
  missing.push("explicit_versioned_confirmation_missing");
 if(p.recovery!=="good"&&p.recovery!=="poor"&&p.recovery!=="unknown")
  missing.push("invalid_recovery");
 if(p.symptoms!=="none"&&p.symptoms!=="pain"&&p.symptoms!=="unknown")
  missing.push("invalid_symptoms");
 if(missing.length)return {review:null,missing};
 return {review:{
  athlete_id:event.athlete_id,session_id:event.session_id,
  recovery:p.recovery as E5SessionReview["recovery"],
  symptoms:p.symptoms as E5SessionReview["symptoms"],
  source:"explicit_session_review",reviewed_at:event.occurred_at
 },missing:[]};
}
export type E5CaptureReadiness={
 contract:"cch-e5d-capture-readiness-v1";status:"blocked";
 outstanding:readonly string[];readyForRealCollection:false;
 writeAuthorized:false;automatedAdaptation:false;
};
export function captureReadiness():E5CaptureReadiness{
 return {contract:"cch-e5d-capture-readiness-v1",status:"blocked",
  outstanding:["versioned_m1_consent_constraint_and_policy_review",
   "approved_m4_session_review_payload_and_permission_contract",
   "authenticated_rls_homologation",
   "athlete_explicit_decision_and_current_goal",
   "repeated_real_comparable_evidence"],
  readyForRealCollection:false,writeAuthorized:false,automatedAdaptation:false};
}
