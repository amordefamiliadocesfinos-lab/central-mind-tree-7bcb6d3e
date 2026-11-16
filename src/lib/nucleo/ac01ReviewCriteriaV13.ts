/**
 * Núcleo V1.3 — critérios de revisão para consolidação AC-01 (CA-25/26/28).
 * Projeção exclusivamente consultiva do recorte já autorizado no Core.
 * "Sem pendência encontrada" NÃO significa decisão, completude ou autorização.
 */
import type {Ac01Record,Ac01Request,Ac01Decision,Ac01Publication,Ac01FM} from "./ac01DocumentGovernance";
import {prepareAc01AssistedComparison} from "./ac01AssistedComparisonV13";
import {buildAc01FmLineage} from "./ac01FmLineageV13";

export type ReviewCriterion=Readonly<{
 code:string;title:string;result:"pendente"|"conferir"|"registrado";
 detail:string;
}>;
export function deriveAc01ReviewCriteria(
 selected:Ac01Record,
 contributions:readonly Ac01Record[],
 requests:readonly Ac01Request[],
 decisions:readonly Ac01Decision[],
 publications:readonly Ac01Publication[],
 target:Ac01FM|null,
):Readonly<{criteria:readonly ReviewCriterion[];pendingCount:number;requiresHumanReview:true;canPublish:false}>{
 const comparison=prepareAc01AssistedComparison(selected,contributions,target);
 const lineage=buildAc01FmLineage(selected,contributions,requests,decisions,publications,target?[target]:[]);
 const ownRequests=requests.filter(x=>x.contribution_id===selected.id);
 const ownDecisions=decisions.filter(x=>x.contribution_id===selected.id&&ownRequests.some(r=>r.id===x.decision_request_id));
 const ownPublications=publications.filter(x=>x.contribution_id===selected.id);
 const pendingRequests=ownRequests.filter(r=>!ownDecisions.some(d=>d.decision_request_id===r.id));
 const approved=ownDecisions.some(d=>d.outcome==="aprovada");
 const linkedPublications=ownPublications.filter(p=>ownDecisions.some(d=>d.id===p.decision_act_id));
 const chainHasIssue=lineage.issues.some(x=>!x.includes("publicação interna"));
 const criteria:ReviewCriterion[]=[
  {code:"origem",title:"Conferir fonte original e acesso",result:"pendente",
   detail:"Conteúdo e permissão da fonte externa não foram lidos; requer verificação humana na origem."},
  {code:"cadeia",title:"Conferir genealogia documental",
   result:chainHasIssue||comparison.issues.some(x=>x.includes("anterior")||x.includes("Sequência"))?"pendente":"registrado",
   detail:chainHasIssue?"Existe lacuna ou divergência de versão no recorte.":"Cadeia de versões consistente apenas no recorte visível."},
  {code:"comparacao",title:"Conferir diferenças substanciais",
   result:"pendente",detail:"Somente metadados AC-01 foram comparados; conteúdo da origem e corpo FM não foram confrontados."},
  {code:"alvo",title:"Selecionar e reconciliar destino FM",
   result:comparison.originMatch==="localizador_identico"?"conferir":"pendente",
   detail:comparison.originMatch==="localizador_identico"
    ?"Localizador textualmente idêntico; vínculo por ID e conteúdo permanecem não verificados."
    :target?"Destino selecionado, mas origem insuficiente ou divergente.":"Nenhum alvo FM selecionado."},
  {code:"solicitacoes",title:"Revisar solicitações e decisões",
   result:pendingRequests.length||!approved?"pendente":"registrado",
   detail:pendingRequests.length
    ?pendingRequests.length+" solicitação(ões) ainda sem ato decisório confirmado."
    :approved?"Há decisão aprovada registrada para a contribuição selecionada; competência e validade não reconfirmadas."
    :"Nenhuma decisão aprovada vinculada à contribuição selecionada neste recorte."},
  {code:"publicacao",title:"Conferir publicação e versão vigente",
   result:"pendente",detail:linkedPublications.length
    ?"Há publicação interna ligada por ID. Destino externo, controle de concorrência e readback não verificados."
    :"Publicação canônica e readback não comprovados neste recorte."},
 ];
 return {criteria,pendingCount:criteria.filter(x=>x.result==="pendente").length,
  requiresHumanReview:true,canPublish:false};
}
