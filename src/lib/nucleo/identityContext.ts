export type IdentityReference={id:string;contribution_id:string|null;fm_id:string|null;evidence_id:string|null;event_id:string|null;label:string;source_ref:string};
export type IdentityContext={
 contract:'nucleo_identity_context_v1';checked_at:string;valid_until:string;
 assignment_id:string;auth_uid:string;instance_id:string;specialty_id:string;specialty_code:string;
 specialty_title:string;module_id:string;front_id:string|null;responsibility:'primary'|'collaborator';
 general_method_ref:string;local_method_ref:string|null;provenance_ref:string;
 authority:'consultivo_sem_mandato';references:IdentityReference[];
};
export type IdentityAssignment={assignment_id:string;specialty_title:string;front_id:string|null;responsibility:'primary'|'collaborator'};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const text=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=2000;
const role=(v:unknown)=>v==='primary'||v==='collaborator';
export function isIdentityAssignments(value:unknown):value is IdentityAssignment[]{
 return Array.isArray(value)&&value.length<=200&&value.every(x=>x&&uuid(x.assignment_id)&&text(x.specialty_title)&&
  (x.front_id===null||uuid(x.front_id))&&role(x.responsibility))&&new Set(value.map(x=>x.assignment_id)).size===value.length;
}
/** Validate response against the actual requested identity and context, never names. */
export function isIdentityContext(value:unknown,uid:string,moduleId:string,assignmentId:string,now=Date.now()):value is IdentityContext{
 if(!value||typeof value!=='object')return false;
 const x=value as IdentityContext;
 return x.contract==='nucleo_identity_context_v1'&&x.authority==='consultivo_sem_mandato'&&
  x.auth_uid===uid&&x.module_id===moduleId&&x.assignment_id===assignmentId&&
  [x.auth_uid,x.module_id,x.assignment_id,x.instance_id,x.specialty_id].every(uuid)&&
  (x.front_id===null||uuid(x.front_id))&&role(x.responsibility)&&
  [x.specialty_code,x.specialty_title,x.general_method_ref,x.provenance_ref].every(text)&&
  (x.local_method_ref===null||text(x.local_method_ref))&&
  Number.isFinite(Date.parse(x.checked_at))&&Date.parse(x.checked_at)<=now+30_000&&
  Number.isFinite(Date.parse(x.valid_until))&&Date.parse(x.valid_until)>now&&Date.parse(x.checked_at)<Date.parse(x.valid_until)&&
  Array.isArray(x.references)&&x.references.length<=200&&x.references.every(r=>r&&uuid(r.id)&&text(r.label)&&text(r.source_ref)&&
   [r.contribution_id,r.fm_id,r.evidence_id,r.event_id].filter(v=>v!==null).length===1&&
   [r.contribution_id,r.fm_id,r.evidence_id,r.event_id].every(v=>v===null||uuid(v)));
}
