// AC-01 CA-28/29: projections of authorized, already-read metadata.
// No source fetch, status mutation, certification, or automatic publication.
export type ContributionMetadata = {
  id:string;module_id:string;specialist_role:string;contribution_kind:string;
  title:string;source_kind:string;source_locator:string;source_checksum_sha256:string|null;
  note:string;authority_state:string;recorded_at:string;recorded_by_auth_uid:string|null;registration_origin?:string;registration_reference?:string|null;
  lineage_id:string;version_no:number;parent_revision_id:string|null;
};
export type DeskState = "todas"|"proposta"|"em_evolucao";
export function latestContributions<T extends ContributionMetadata>(rows:readonly T[]):T[] {
  const latest=new Map<string,T>();
  for(const row of rows) {
    const prior=latest.get(row.lineage_id);
    if(!prior || row.version_no>prior.version_no ||
      (row.version_no===prior.version_no && row.recorded_at>prior.recorded_at)) latest.set(row.lineage_id,row);
  }
  return [...latest.values()].sort((a,b)=>b.recorded_at.localeCompare(a.recorded_at));
}
export function deskFilter<T extends ContributionMetadata>(
  rows:readonly T[], state:DeskState, search:string,
):T[] {
  const term=search.trim().toLocaleLowerCase("pt-BR");
  return rows.filter(row=>(state==="todas"||row.authority_state===state) &&
    (!term || [row.title,row.specialist_role,row.contribution_kind,row.source_kind,row.source_locator]
      .some(s=>s.toLocaleLowerCase("pt-BR").includes(term))));
}
export function continuityContext(
 moduleName:string,role:string,rows:readonly ContributionMetadata[],readAt:string,
) {
 const latest=latestContributions(rows);
 return {
  kind:"nucleo_ac01_contexto_consultivo",
  recorded_at:readAt,
  module:moduleName,
  specialist_role_declared:role,
  coverage:"recorte autorizado e completo desta consulta; não representa todo o acervo",
  normative_warning:"Metadados de propostas e revisões; nenhum registro AC-01 atesta documento vigente, mandato, conteúdo original ou decisão competente.",
  usage_limit:"Somente humano/IA expressamente autorizados; conferir permissões da fonte original antes de abrir ou transmitir seu conteúdo.",
  current_homologated:[],
  current_homologated_status:"não determinado por AC-01; conferir registros canônicos/decisões humanas separadamente",
  pending:latest.map(row=>({
    id:row.id,lineage_id:row.lineage_id,version:row.version_no,
    title:row.title,role:row.specialist_role,kind:row.contribution_kind,
    source:row.source_kind,locator:row.source_locator,hash_declared:row.source_checksum_sha256,
    state:row.authority_state,author_uid:row.recorded_by_auth_uid,registration_origin:row.registration_origin??null,registration_reference:row.registration_reference??null,recorded_at:row.recorded_at,
    previous_revision_id:row.parent_revision_id,
  })),
  history:rows.map(row=>({id:row.id,lineage_id:row.lineage_id,version:row.version_no,
    previous_revision_id:row.parent_revision_id,state:row.authority_state,recorded_at:row.recorded_at})),
  missing:"decisões humanas, revisão de conteúdo, homologação, vigência canônica e acesso às fontes",
 };
}
