/**
 * Núcleo V1.3 — FM-09: recorte de histórico M3 já carregado pela Central.
 * Somente snapshots de identificação/estado: não deduz decisão, sucesso, deploy ou aprendizado.
 * Eventos provêm da janela limitada lida pela Central; ausência não é ausência histórica.
 */
import type { DevelopmentEvent, DevelopmentWorkstream } from "./development.types";

export type FmContinuityRow=Readonly<{
 id:string;code:string;title:string;status:string;nextAction:string;
 evidenceState:string;updatedAt:string;
}>;
export type FmContinuityEvent=Readonly<{
 id:string;workstreamCode:string;eventType:"criado"|"alterado";recordedAt:string;
 hasIdentifiedActor:boolean;
}>;
export function projectFm09Continuity(
 moduleId:string,workstreams:readonly DevelopmentWorkstream[],events:readonly DevelopmentEvent[],
):Readonly<{fronts:readonly FmContinuityRow[];events:readonly FmContinuityEvent[];eventsAreWindowed:true}> {
 const root=workstreams.find(w=>w.id===moduleId&&w.kind==="modulo");
 if(!root)return {fronts:[],events:[],eventsAreWindowed:true};
 const byId=new Map(workstreams.map(w=>[w.id,w]));
 const descendants=workstreams.filter(w=>{
  if(w.id===moduleId)return false;
  let cursor:DevelopmentWorkstream|undefined=w;
  const seen=new Set<string>();
  while(cursor?.parent_id){
   if(seen.has(cursor.id))return false;
   seen.add(cursor.id);
   if(cursor.parent_id===moduleId)return true;
   cursor=byId.get(cursor.parent_id);
  }
  return false;
 });
 const acceptedIds=new Set([moduleId,...descendants.map(w=>w.id)]);
 const codes=new Map<string,string>([[moduleId,root.code],...descendants.map(w=>[w.id,w.code] as [string,string])]);
 return {
  fronts:descendants.map(w=>({
   id:w.id,code:w.code,title:w.title,status:w.status,
   nextAction:w.next_action,evidenceState:w.evidence_state,updatedAt:w.updated_at,
  })),
  events:[...events].filter(e=>acceptedIds.has(e.workstream_id))
   .sort((a,b)=>b.recorded_at.localeCompare(a.recorded_at)).slice(0,12)
   .map(e=>({id:e.id,workstreamCode:codes.get(e.workstream_id)??"não identificado",
    eventType:e.event_type,recordedAt:e.recorded_at,
    hasIdentifiedActor:Boolean(e.actor_auth_uid)})),
  eventsAreWindowed:true,
 };
}
