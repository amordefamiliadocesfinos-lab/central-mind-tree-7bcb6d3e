/**
 * Núcleo V1.3 AC-01: matriz por PAPEL, não por pessoa.
 * Uma linha da matriz NÃO constitui mandato ou permissão. Toda delegação real
 * depende de comprovação humana, fonte soberana, RLS e contrato de escrita.
 */
export const AC01_DOCUMENT_CATEGORIES = [
 "metodo","ecossistema","manual","procedimento","aprendizado",
 "mapa","checkpoint","arquivo","outro",
] as const;
export type DocumentCategory = typeof AC01_DOCUMENT_CATEGORIES[number];
export const AC01_FUNCTIONS = [
 { role:"Autor / proponente", propose:true, review:false, decide:false, publish:false,
   prerequisite:"Autoria identificada; origem e permissões preservadas" },
 { role:"Revisor", propose:false, review:true, decide:false, publish:false,
   prerequisite:"Revisão fundamentada e registrada sem mudar vigente" },
 { role:"Decisor", propose:false, review:false, decide:true, publish:false,
   prerequisite:"Mandato certificado e delegação válida por módulo, especialidade, categoria e prazo" },
 { role:"Executor", propose:false, review:false, decide:false, publish:true,
   prerequisite:"Delegação distinta; ato de aprovação anterior; destino canônico e readback" },
 { role:"Camada Mestre / proprietário", propose:false, review:false, decide:false, publish:false,
   prerequisite:"Institui autoridades documentalmente; não equivale a concessão técnica automática" },
] as const;
export type Ac01Record = {
 id:string;module_id:string;lineage_id:string;version_no:number;
 specialist_role:string;contribution_kind:string;title:string;
 authority_state:string;recorded_at:string;parent_revision_id:string|null;
 source_locator:string;source_kind:string;recorded_by_auth_uid:string;
};
export type Ac01Request = {
 id:string;contribution_id:string;recorded_at:string;requested_outcome:string;
 submitter_auth_uid:string;
};
export type Ac01Decision = {
 id:string;contribution_id:string;decision_request_id:string;outcome:string;
 recorded_at:string;decided_by_auth_uid:string;
};
export type Ac01Publication = {
 id:string;contribution_id:string;decision_act_id:string;
 previous_publication_id:string|null;recorded_at:string;executed_by_auth_uid:string;
};
export type Ac01Mandate = {
 id:string;module_id:string;specialist_role:string;
 record_kind:string;specialist_auth_uid:string|null;
 effective_from:string|null;effective_until:string|null;
 supersedes_record_id:string|null;
};
export type Ac01Grant = {
 id:string;module_id:string;specialist_role:string;contribution_kind:string;
 authority_kind:string;delegate_auth_uid:string;mandate_record_id:string;
 effective_from:string;effective_until:string|null;supersedes_grant_id?:string|null;
};
export type Ac01Revocation={id:string;authority_grant_id:string;revocation_kind:'revogacao'|'suspensao';reason:string;revoked_by_auth_uid:string;recorded_at:string};
export type Ac01FM = {
 id:string;module_id:string;section_code:string;version_no:number;
 title:string;authority_state:string;source_reference:string;recorded_at:string;
};
export function buildAc01DocumentView(
 contributions:readonly Ac01Record[], requests:readonly Ac01Request[],
 decisions:readonly Ac01Decision[], publications:readonly Ac01Publication[],
) {
 const latestByLineage=new Map<string,Ac01Record>();
 const byId=new Map(contributions.map(x=>[x.id,x]));
 for(const c of contributions){
  const prior=latestByLineage.get(c.lineage_id);
  if(!prior || c.version_no>prior.version_no)latestByLineage.set(c.lineage_id,c);
 }
 const decisionsByRequest=new Map(decisions.map(x=>[x.decision_request_id,x]));
 const publishedIds=new Set(publications.map(x=>x.contribution_id));
 const pending=requests.filter(x=>!decisionsByRequest.has(x.id));
 const latest=[...latestByLineage.values()].sort((a,b)=>b.recorded_at.localeCompare(a.recorded_at));
 const history=contributions.filter(x=>latestByLineage.get(x.lineage_id)?.id!==x.id);
 const internalPublications=publications.map(p=>({...p,contribution:byId.get(p.contribution_id)??null}));
 const pendingRequests=pending.map(r=>({...r,contribution:byId.get(r.contribution_id)??null}));
 return {
  latest,
  proposals:latest.filter(x=>x.authority_state==="proposta" && !publishedIds.has(x.id)),
  evolving:latest.filter(x=>x.authority_state==="em_evolucao" && !publishedIds.has(x.id)),
  pendingRequests,
  history,
  internalPublications,
  decisions:[...decisions].sort((a,b)=>b.recorded_at.localeCompare(a.recorded_at)),
 };
}
export function isActiveCertifiedMandate(
 m:Ac01Mandate, all:readonly Ac01Mandate[], now:string,
) {
 return m.record_kind==="certificacao" && !!m.effective_from &&
  m.effective_from<=now && (!m.effective_until || m.effective_until>now) &&
  !all.some(x=>x.record_kind==="revogacao" && x.supersedes_record_id===m.id);
}
/** Declarativo apenas: não concede autoridade de fato, não substitui checagem RLS. */
export function declaredAuthorityCoverage(
 moduleId:string,specialist:string,category:string,
 grants:readonly Ac01Grant[],mandates:readonly Ac01Mandate[],now:string,
 revocations:readonly Ac01Revocation[]=[],
) {
 const byId=new Map(mandates.map(m=>[m.id,m]));
 return grants.filter(g=>g.module_id===moduleId && g.specialist_role===specialist &&
  g.contribution_kind===category && !revocations.some(r=>r.authority_grant_id===g.id) && g.effective_from<=now &&
  (!g.effective_until || g.effective_until>now) &&
  !!byId.get(g.mandate_record_id) &&
  isActiveCertifiedMandate(byId.get(g.mandate_record_id)!,mandates,now));
}

/** Procedimento previsto, NÃO substitui autorização humana nem habilita escrita. */
export const AC01_AUTHORITY_PROCEDURE = [
 {code:"01",step:"Certificação",detail:"Camada Mestre confirma a pessoa, especialidade, categoria e fonte de autoridade; registra ato de certificação de mandato com prova verificável no contrato vigente."},
 {code:"02",step:"Delegação",detail:"Ato próprio com autor concedente, delegado humano, escopo por módulo/papel/tipo, fonte, referência da decisão, início e fim; acesso ao Núcleo não confere competência substantiva."},
 {code:"03",step:"Revisão independente",detail:"Autor e revisor registram originais, diferenças e justificativas; a solicitação de decisão aponta uma revisão específica e não equivale a aprovação."},
 {code:"04",step:"Decisão competente",detail:"Decisor autenticado, distinto do proponente e solicitante, confere mandato/delegação vigentes; registra ato e prova sem atualizar referência automaticamente."},
 {code:"05",step:"Publicação controlada",detail:"Executor humano distinto do autor e decisor confirma alvo canônico, versão anterior, permissões de origem, ato aprovado e CAS/transação; lê de volta o destino e mantém histórico."},
 {code:"06",step:"Revogação / suspensão",detail:"Registrar revogação explícita, motivo, autor competente, data e escopo; cancelar acesso decisório antes da próxima execução. O ledger AC-01 atual NÃO possui evento autônomo de revogação de delegação: portão de ativação permanece fechado até contrato de revogação implementado/testado."},
 {code:"07",step:"Substituição",detail:"Revogar competência anterior e certificar substituto com prova e prazo, checar sobreposição; nenhum sucessor herda automaticamente grants, credenciais, sessões ou atos. Conservar originais e histórico."},
 {code:"08",step:"Homologação posterior",detail:"Ensaios autorizados com pessoa real: positivo, negativo, revogado, duplicado, concorrência, rollback/readback, origem externa, desktop/mobile. Não tratar CI isolado como UAT."},
] as const;
