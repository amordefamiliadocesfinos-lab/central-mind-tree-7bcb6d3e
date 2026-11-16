/**
 * Núcleo V1.3 — preparação de repasse para revisão humana, sem gerar ato.
 * Usa o recorte AC-01/FM já lido; não consulta original, não emite decisão e
 * não publica. IDs são localizadores técnicos, NÃO comprovação de autoridade.
 */
import type {Ac01Record,Ac01Request,Ac01Decision,Ac01Publication,Ac01FM} from "./ac01DocumentGovernance";
import {deriveAc01ReviewCriteria} from "./ac01ReviewCriteriaV13";
import {buildAc01FmLineage} from "./ac01FmLineageV13";

export function prepareAc01HumanReviewBrief(
 contribution:Ac01Record,
 contributions:readonly Ac01Record[],
 requests:readonly Ac01Request[],
 decisions:readonly Ac01Decision[],
 publications:readonly Ac01Publication[],
 target:Ac01FM|null,
){
 const review=deriveAc01ReviewCriteria(contribution,contributions,requests,decisions,publications,target);
 const lineage=buildAc01FmLineage(contribution,contributions,requests,decisions,publications,target?[target]:[]);
 const scoped=contributions.filter(c=>c.module_id===contribution.module_id&&c.lineage_id===contribution.lineage_id);
 const validTarget=target?.module_id===contribution.module_id?target:null;
 const relatedRequests=requests.filter(r=>r.contribution_id===contribution.id);
 const relatedDecisions=decisions.filter(d=>d.contribution_id===contribution.id&&
  relatedRequests.some(r=>r.id===d.decision_request_id));
 const relatedPublications=publications.filter(p=>p.contribution_id===contribution.id&&
  relatedDecisions.some(d=>d.id===p.decision_act_id));
 const tasks=review.criteria.map(c=>({
  code:c.code,label:c.title,status:c.result,reason:c.detail,
  requiredAction:c.code==="origem"?"Abrir o original com acesso autorizado e conferir a versão/hash."
   :c.code==="cadeia"?"Conferir versões predecessoras, vínculos e eventuais lacunas na origem."
   :c.code==="comparacao"?"Confrontar efetivamente o conteúdo original e a revisão de destino."
   :c.code==="alvo"?"Confirmar a revisão canônica de destino, sua autoridade e fonte."
   :c.code==="solicitacoes"?"Verificar identidade, segregação e competência dos autores/decisores."
   :"Verificar autorização específica, CAS, versão vigente e readback na origem.",
 }));
 return {
  moduleId:contribution.module_id,contributionId:contribution.id,
  contributionVersion:contribution.version_no,contributionTitle:contribution.title,
  lineageId:contribution.lineage_id,visibleVersions:scoped.length,
  originalLocator:contribution.source_locator,
  target:validTarget?{id:validTarget.id,section:validTarget.section_code,version:validTarget.version_no}:null,
  requests:relatedRequests.map(r=>r.id),
  decisions:relatedDecisions.map(d=>({id:d.id,outcome:d.outcome})),
  internalPublications:relatedPublications.map(p=>p.id),
  chainIssues:lineage.issues,
  tasks,
  unverifiedTasks:tasks.filter(t=>t.status!=="registrado").length,
  recorteNaoExaustivo:true as const,
  containsExternalContent:false as const,
  replacesOriginal:false as const,
  authorizedForApproval:false as const,
  authorizedForPublication:false as const,
 };
}
