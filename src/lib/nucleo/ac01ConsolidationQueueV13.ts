/**
 * Núcleo 2.0 V1.3 — CA-26/28: fila consultiva de consolidação.
 * Não cria documento consolidado, decisão ou autorização.
 * Usa somente o recorte governado que já foi lido pelo AC-01.
 */
import type {Ac01Record,Ac01Request,Ac01Decision,Ac01Publication,Ac01FM} from "./ac01DocumentGovernance";
import {buildAc01FmLineage} from "./ac01FmLineageV13";

export type Ac01QueueIssue="historico_incompleto"|"decisao_pendente"|"origem_sem_fm"|"divergencia_de_origem"|"publicacao_sem_decisao_no_recorte"|"sem_decisao_aprovada";
export type Ac01ConsolidationItem=Readonly<{
 contributionId:string;lineageId:string;version:number;title:string;role:string;
 kind:string;recordedAt:string;issues:readonly Ac01QueueIssue[];
 matchedFm:number;status:"exige_conciliacao"|"pronto_para_revisao_humana";
}>;
export function buildAc01ConsolidationQueue(
 contributions:readonly Ac01Record[],
 requests:readonly Ac01Request[],
 decisions:readonly Ac01Decision[],
 publications:readonly Ac01Publication[],
 fm:readonly Ac01FM[],
):readonly Ac01ConsolidationItem[]{
 const latest=new Map<string,Ac01Record>();
 for(const c of contributions){
  const p=latest.get(c.lineage_id);
  if(!p||c.version_no>p.version_no)latest.set(c.lineage_id,c);
 }
 return [...latest.values()].sort((a,b)=>b.recorded_at.localeCompare(a.recorded_at)).map(c=>{
  const track=buildAc01FmLineage(c,contributions,requests,decisions,publications,fm);
  const issues=new Set<Ac01QueueIssue>();
  if(track.issues.some(x=>x.includes("publicação interna")))issues.add("publicacao_sem_decisao_no_recorte");
  if(track.issues.some(x=>!x.includes("publicação interna")))issues.add("historico_incompleto");
  const allEntries=track.entries;
  if(allEntries.some(entry=>entry.requests.some(req=>
   !entry.decisions.some(dec=>dec.requestId===req.id))))issues.add("decisao_pendente");
  const matchedFm=track.fmCandidates.filter(x=>x.match==="localizador_identico").length;
  if(track.fmCandidates.length===0)issues.add("origem_sem_fm");
  else if(!matchedFm)issues.add("divergencia_de_origem");
  if(!allEntries.some(entry=>entry.decisions.some(dec=>dec.outcome==="aprovada")))
   issues.add("sem_decisao_aprovada");
  const list=[...issues];
  return {
   contributionId:c.id,lineageId:c.lineage_id,version:c.version_no,
   title:c.title,role:c.specialist_role,kind:c.contribution_kind,
   recordedAt:c.recorded_at,issues:list,matchedFm,
   status:list.length?"exige_conciliacao":"pronto_para_revisao_humana",
  };
 });
}
export const AC01_QUEUE_ISSUE_LABELS:Readonly<Record<Ac01QueueIssue,string>>={
 historico_incompleto:"Cadeia documental incompleta neste recorte",
 decisao_pendente:"Solicitação sem decisão confirmada",
 origem_sem_fm:"Nenhuma revisão FM no recorte",
 divergencia_de_origem:"Nenhuma coincidência exata de origem FM",
 publicacao_sem_decisao_no_recorte:"Publicação interna sem decisão confirmada na janela",
 sem_decisao_aprovada:"Sem decisão aprovada confirmada nesta cadeia",
};
