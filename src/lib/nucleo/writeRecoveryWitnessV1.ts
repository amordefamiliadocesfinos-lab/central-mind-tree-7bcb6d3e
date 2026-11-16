/**
 * Testemunho técnico para recuperação local: NÃO guarda documento ou minuta.
 * O salt é aleatório por tentativa. O hash cobre todos os campos de negócio
 * e só é comparado contra um registro efetivamente retornado pelo Core.
 */
export type WriteWitness={
 kind:"fm"|"ac01";moduleId:string;requestId?:string;section?:string;
 version?:number;salt:string;digest:string;
};
export const witnessFieldsFm=(r:{
 module_id:string;section_code:string;version_no:number;title:string;body:string;
 source_reference:string;authority_state:string;evidence_level:string;
})=>[r.module_id,r.section_code,r.version_no,r.title,r.body,r.source_reference,
 r.authority_state,r.evidence_level];
export const witnessFieldsAc01=(r:{
 request_id:string;module_id:string;specialist_role:string;contribution_kind:string;
 title:string;source_kind:string;source_locator:string;source_checksum_sha256:string|null;
 note:string;parent_revision_id:string|null;version_no:number;authority_state:string;
})=>[r.request_id,r.module_id,r.specialist_role,r.contribution_kind,r.title,
 r.source_kind,r.source_locator,r.source_checksum_sha256,r.note,r.parent_revision_id,
 r.version_no,r.authority_state];
export async function fingerprint(fields:unknown[],salt:string):Promise<string>{
 const bytes=new TextEncoder().encode(JSON.stringify([salt,fields]));
 const digest=await crypto.subtle.digest("SHA-256",bytes);
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
}
export async function makeWitness(kind:"fm"|"ac01",moduleId:string,
 fields:unknown[],locator:{requestId?:string;section?:string;version?:number}):Promise<WriteWitness>{
 const salt=crypto.randomUUID();
 return {kind,moduleId,...locator,salt,digest:await fingerprint(fields,salt)};
}
export function isWriteWitness(value:unknown):value is WriteWitness{
 if(!value||typeof value!=="object")return false;
 const w=value as Partial<WriteWitness>;
 return (w.kind==="fm"||w.kind==="ac01")&&
 typeof w.moduleId==="string"&&w.moduleId.length>0&&
 typeof w.salt==="string"&&w.salt.length>=16&&
 typeof w.digest==="string"&&/^[0-9a-f]{64}$/.test(w.digest)&&
 (w.kind==="fm"?typeof w.section==="string"&&
  Number.isSafeInteger(w.version)&&Number(w.version)>0:
  typeof w.requestId==="string"&&w.requestId.length>0);
}
