/**
 * Núcleo 2.0 V1.3 — rastreabilidade AC-01 → FM, somente leitura.
 * Vincula ATOS pelo ID explícito do contrato existente; FM é apenas candidata
 * por localizador declarado, jamais destino publicado ou FK inventada.
 */
import type {Ac01Record,Ac01Request,Ac01Decision,Ac01Publication,Ac01FM} from "./ac01DocumentGovernance";
import {assessAc01FmCandidates} from "./ac01FmSourceMatchV13";

export type LineageEntry=Readonly<{
 id:string;version:number;parentId:string|null;recordedAt:string;
 sourceLocator:string;authorityState:string;
 requests:readonly Readonly<{id:string;outcome:string;recordedAt:string}>[];
 decisions:readonly Readonly<{id:string;outcome:string;requestId:string;recordedAt:string}>[];
 publications:readonly Readonly<{id:string;decisionId:string;recordedAt:string;chainConfirmed:boolean}>[];
}>;
export function buildAc01FmLineage(
 selected:Ac01Record,
 contributions:readonly Ac01Record[],
 requests:readonly Ac01Request[],
 decisions:readonly Ac01Decision[],
 publications:readonly Ac01Publication[],
 revisions:readonly Ac01FM[],
){
 const versions=contributions.filter(c=>c.module_id===selected.module_id&&
  c.lineage_id===selected.lineage_id).sort((a,b)=>a.version_no-b.version_no);
 const byId=new Map(versions.map(x=>[x.id,x]));
 const visibleIssues:string[]=[];
 for(const row of versions){
  if(row.parent_revision_id&&!byId.has(row.parent_revision_id))
   visibleIssues.push("Anterior da versão "+row.version_no+" fora do recorte ou da cadeia visível");
  if(row.parent_revision_id&&byId.has(row.parent_revision_id)&&
     byId.get(row.parent_revision_id)!.version_no!==row.version_no-1)
   visibleIssues.push("Sequência anterior da versão "+row.version_no+" exige reconciliação");
 }
 if(versions.length&&versions[0].version_no!==1)
  visibleIssues.push("Início da cadeia fora do recorte");
 const chainIds=new Set(versions.map(x=>x.id));
 const entries:LineageEntry[]=versions.map(c=>{
  const relevantRequests=requests.filter(r=>r.contribution_id===c.id);
  const reqIds=new Set(relevantRequests.map(r=>r.id));
  const acts=decisions.filter(d=>d.contribution_id===c.id&&reqIds.has(d.decision_request_id));
  const actIds=new Set(acts.map(d=>d.id));
  const pubs=publications.filter(p=>p.contribution_id===c.id);
  return {
   id:c.id,version:c.version_no,parentId:c.parent_revision_id,recordedAt:c.recorded_at,
   sourceLocator:c.source_locator,authorityState:c.authority_state,
   requests:relevantRequests.map(r=>({id:r.id,outcome:r.requested_outcome,recordedAt:r.recorded_at})),
   decisions:acts.map(d=>({id:d.id,outcome:d.outcome,requestId:d.decision_request_id,recordedAt:d.recorded_at})),
   publications:pubs.map(p=>({id:p.id,decisionId:p.decision_act_id,recordedAt:p.recorded_at,
    chainConfirmed:actIds.has(p.decision_act_id)})),
  };
 });
 if(publications.some(p=>chainIds.has(p.contribution_id)&&
  !entries.some(entry=>entry.publications.some(pub=>pub.id===p.id&&pub.chainConfirmed))))
  visibleIssues.push("Há publicação interna cuja cadeia de decisão não foi confirmada neste recorte");
 const candidates=assessAc01FmCandidates(selected,revisions);
 return {
  entries,issues:visibleIssues,
  fmCandidates:candidates.map(({fm,match})=>({
   id:fm.id,section:fm.section_code,version:fm.version_no,
   declaredAuthority:fm.authority_state,match,
  })),
  fmHasPersistentLink:false as const,
  externalPublicationVerified:false as const,
 };
}
