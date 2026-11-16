/**
 * Núcleo V1.3 AC-01 — retrato consultivo da contribuição selecionada.
 * Projeta SOMENTE informações devolvidas nas consultas já existentes.
 * Nem registro localizado nem ausência de pendências equivalem a homologação.
 */
import type {Ac01Record,Ac01Request,Ac01Decision,Ac01Publication,Ac01FM} from "./ac01DocumentGovernance";
import {deriveAc01ReviewCriteria} from "./ac01ReviewCriteriaV13";
import {buildAc01FmLineage} from "./ac01FmLineageV13";
import {compareAc01FmSource} from "./ac01FmSourceMatchV13";

export function summarizeAc01ContributionV13(
 selected:Ac01Record,contributions:readonly Ac01Record[],
 requests:readonly Ac01Request[],decisions:readonly Ac01Decision[],
 publications:readonly Ac01Publication[],target:Ac01FM|null,
){
 const scoped=contributions.filter(c=>c.module_id===selected.module_id&&c.lineage_id===selected.lineage_id);
 const ownReq=requests.filter(r=>r.contribution_id===selected.id);
 const ids=new Set(ownReq.map(r=>r.id));
 const ownDec=decisions.filter(d=>d.contribution_id===selected.id&&ids.has(d.decision_request_id));
 const decIds=new Set(ownDec.map(d=>d.id));
 const ownPub=publications.filter(p=>p.contribution_id===selected.id&&decIds.has(p.decision_act_id));
 const review=deriveAc01ReviewCriteria(selected,contributions,requests,decisions,publications,target);
 const lineage=buildAc01FmLineage(selected,contributions,requests,decisions,publications,target?[target]:[]);
 const validTarget=target?.module_id===selected.module_id?target:null;
 return {
  contributionId:selected.id,version:selected.version_no,title:selected.title,
  declaredState:selected.authority_state,sourceKind:selected.source_kind,
  sourceLocator:selected.source_locator,
  visibleVersions:scoped.length,chainIssueCount:lineage.issues.length,
  requestCount:ownReq.length,decisionCount:ownDec.length,internalPublicationCount:ownPub.length,
  pendingReviewCount:review.criteria.filter(c=>c.result==="pendente").length,
  needsCheckCount:review.criteria.filter(c=>c.result==="conferir").length,
  foundRecordCount:review.criteria.filter(c=>c.result==="registrado").length,
  validFmTarget:!!validTarget,
  locatorMatch:validTarget?compareAc01FmSource(selected,validTarget):null,
  authorityCertified:false as const,externalPublicationVerified:false as const,
  issueResolutionVerified:false as const,readyToPublish:false as const,
 };
}
