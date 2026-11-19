/** Contrato consultivo fechado para NUC; nunca é um mandato ou writer. */
export const NUC_MODULE_ID="636768e6-e782-4c7d-8132-e7381621be12";
export const PILOT_CONTRIBUTION_ID="80f64bfb-cfa0-4012-a2ad-b75226881c2d";
export const PILOT_MAP_SOURCE="docs/architecture/MAPA_CONTINUIDADE_CANONICA_ESPECIALISTAS_NUCLEO20_V1_1_CONGELADO_PLANEJAMENTO_2026-11-19.md";
export const FRONT_CODES=["NUC-M0","NUC-M1","NUC-M2","NUC-M3","NUC-M4","NUC-M5"] as const;
export type NucFront={id:string;code:string;kind:string;parent_id:string|null;title:string;status:string;next_action:string;evidence_state:string};
export type NucContribution={id:string;module_id:string;specialist_role:string;contribution_kind:string;title:string;source_kind:string;source_locator:string;version_no:number;authority_state:string};
export const validRequest=(value:unknown):boolean=>{
 if(!value||typeof value!=="object"||Array.isArray(value))return false;
 const obj=value as Record<string,unknown>;
 return Object.keys(obj).length===1&&obj.module_id===NUC_MODULE_ID;
};
export const validateFronts=(rows:NucFront[]):boolean=>{
 if(rows.length!==6)return false;
 const codes=rows.map(row=>row.code);
 if(new Set(codes).size!==6||FRONT_CODES.some(code=>!codes.includes(code)))return false;
 return rows.every(row=>row.kind==="frente"&&row.parent_id===NUC_MODULE_ID&&
  typeof row.id==="string"&&typeof row.title==="string"&&typeof row.status==="string"&&
  typeof row.next_action==="string"&&typeof row.evidence_state==="string");
};
export const validContribution=(r:NucContribution):boolean=>
 r.id===PILOT_CONTRIBUTION_ID&&r.module_id===NUC_MODULE_ID&&
 r.specialist_role==="Especialista Núcleo 2.0"&&r.contribution_kind==="mapa"&&
 r.source_kind==="github"&&r.source_locator===PILOT_MAP_SOURCE&&
 r.version_no===1&&r.authority_state==="proposta";
