/** Read-only bridge from existing M3/M4/F21 rows to frozen E3 observations.
 * No inference of technique, recovery or machine identity from completed sets.
 */
import type {SessionObservation} from "./periodizationFlexibleE3";

export type M4SessionRow={
 id:string;program_version_id:string|null;session_template_id:string|null;
 started_at:string|null;status:string;record_status:string;
};
export type M4SetRow={
 session_id:string;status:string;set_type:string;
 reps:number|null;rir:number|null;load_value:number|null;load_unit:string|null;
};
export type M3TemplateRow={
 id:string;program_version_id:string;code:string;status:string;
};
export type E3Mapped={
 observations:SessionObservation[];
 uncategorizedSessions:number;
 totalValidSessions:number;
 missingWorkingSetData:number;
 sourceTruncated:boolean;
};
export function mapM3M4F21Observations(
 sessions:M4SessionRow[],sets:M4SetRow[],templates:M3TemplateRow[],
 versionIds:string[],sourceTruncated=false
):E3Mapped{
 const allowed=new Set(versionIds);
 const byTemplate=new Map(templates.filter(t=>allowed.has(t.program_version_id))
  .map(t=>[t.id,t]));
 const setsBySession=new Map<string,M4SetRow[]>();
 for(const set of sets){
  if(set.status!=="completed"||set.set_type!=="working")continue;
  const list=setsBySession.get(set.session_id)??[];
  list.push(set);setsBySession.set(set.session_id,list);
 }
 const valid=sessions.filter(s=>s.status==="completed"&&s.record_status==="active"&&
  !!s.program_version_id&&allowed.has(s.program_version_id));
 const observations:SessionObservation[]=valid.map(s=>{
  const ownedTemplate=s.session_template_id?byTemplate.get(s.session_template_id):null;
  const matchingTemplate=ownedTemplate?.program_version_id===s.program_version_id;
  const working=setsBySession.get(s.id)??[];
  const comparable=working.length>0&&working.every(set=>
   typeof set.reps==="number"&&Number.isFinite(set.reps)&&set.reps>0&&
   typeof set.rir==="number"&&Number.isFinite(set.rir)&&set.rir>=0&&
   typeof set.load_value==="number"&&Number.isFinite(set.load_value)&&set.load_value>=0&&
   ["kg","lb"].includes(set.load_unit??""));
  return {id:s.id,occurredAt:s.started_at,programVersionId:s.program_version_id!,
   sessionCode:matchingTemplate?ownedTemplate.code:"",
   status:"completed",valid:true,workingSets:working.length,
   exerciseDataComparable:comparable,recoveryObserved:false};
 });
 return {observations,totalValidSessions:valid.length,
  uncategorizedSessions:observations.filter(x=>!x.sessionCode).length,
  missingWorkingSetData:observations.filter(x=>x.workingSets===0).length,
  sourceTruncated};
}
