/** AC-01 piloto NUC: contrato restrito, sem texto livre ou poderes de governança. */
export const NUC_MODULE_ID = "636768e6-e782-4c7d-8132-e7381621be12";
export const PILOT_ROLE = "Especialista Núcleo 2.0";
export const PILOT_TITLE = "Mapa de Continuidade Canônica dos Especialistas — Núcleo 2.0 V1.1";
export const PILOT_SOURCE =
  "docs/architecture/MAPA_CONTINUIDADE_CANONICA_ESPECIALISTAS_NUCLEO20_V1_1_CONGELADO_PLANEJAMENTO_2026-11-19.md";
export type PilotRequest = Readonly<{request_id:string; module_id:typeof NUC_MODULE_ID}>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parsePilotRequest(input:unknown):PilotRequest|null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const obj=input as Record<string,unknown>;
  if (Object.keys(obj).length!==2 || !Object.hasOwn(obj,"request_id") || !Object.hasOwn(obj,"module_id"))return null;
  if (typeof obj.request_id!=="string" || !uuid.test(obj.request_id) ||
      obj.module_id!==NUC_MODULE_ID) return null;
  return {request_id:obj.request_id.toLowerCase(),module_id:NUC_MODULE_ID};
}
export type PilotRecord = Readonly<{
  id:string;request_id:string;module_id:string;workstream_id:string|null;
  specialist_role:string; contribution_kind:string;title:string;
  source_kind:string;source_locator:string;source_checksum_sha256:string|null;
  note:string;parent_revision_id:string|null;version_no:number;
  authority_state:string;recorded_by_auth_uid:string;
}>;
export function matchesPilotRecord(row:PilotRecord,request:PilotRequest,uid:string):boolean {
  return row.request_id===request.request_id && row.module_id===NUC_MODULE_ID &&
    row.workstream_id===null && row.specialist_role===PILOT_ROLE &&
    row.contribution_kind==="mapa" && row.title===PILOT_TITLE &&
    row.source_kind==="github" && row.source_locator===PILOT_SOURCE &&
    row.source_checksum_sha256===null && row.note==="" &&
    row.parent_revision_id===null && row.version_no===1 &&
    row.authority_state==="proposta" && row.recorded_by_auth_uid===uid;
}
