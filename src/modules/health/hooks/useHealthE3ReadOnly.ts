import {useCallback,useEffect,useRef,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {mapM3M4F21Observations,viewE3ReadSnapshot} from "../cch/e3ObservationAdapter";
import type {E3Mapped,E3ReadSnapshot,M4SetRow} from "../cch/e3ObservationAdapter";
import {readE3BoundedPages} from "../cch/e3Pagination";
const byId={identity:(row:{id:string})=>row.id,
 ordered:(a:{id:string},b:{id:string})=>a.id<b.id};
const bySession={
 identity:(row:{id:string})=>row.id,
 ordered:(a:{id:string;started_at:string|null},b:{id:string;started_at:string|null})=>{
  if(!a.started_at)return !b.started_at&&a.id<b.id;
  if(!b.started_at)return true;
  return a.started_at>b.started_at||
   (a.started_at===b.started_at&&a.id<b.id);
 }
};

const empty:E3Mapped={observations:[],totalValidSessions:0,uncategorizedSessions:0,
 missingWorkingSetData:0,sourceTruncated:false};

/** No E3 data from a previous athlete/program may be rendered or accepted. */
export function useHealthE3ReadOnly(athleteId:string|null|undefined,programId:string|null|undefined){
 const scopeKey=athleteId&&programId?JSON.stringify([athleteId,programId]):null;
 const [snapshot,setSnapshot]=useState<E3ReadSnapshot>({
  scopeKey:null,data:empty,loading:false,error:null
 });
 const requestGeneration=useRef(0);
 const reload=useCallback(async()=>{
  const generation=++requestGeneration.current;
  if(!scopeKey||!athleteId||!programId){
   setSnapshot({scopeKey:null,data:empty,loading:false,error:null});
   return;
  }
  // Clear previous observations on reload and do not retain an old athlete's
  // data while requests for the new athlete/program are in flight.
  setSnapshot({scopeKey,data:empty,loading:true,error:null});
  try{
   // Stable ordering and a (limit+1) sentinel prove whether the selected
   // history is complete. Do not treat the API's default 1000-row cap as EOF.
   const versions=await readE3BoundedPages((from,to)=>supabase
    .from("health_program_versions").select("id")
    .eq("athlete_id",athleteId).eq("program_id",programId)
    .order("id",{ascending:true}).range(from,to),1000,400,byId);
   if(versions.truncated){
    if(generation===requestGeneration.current)
     setSnapshot({scopeKey,data:{...empty,sourceTruncated:true},loading:false,error:null});
    return;
   }
   const ids=versions.rows.map(x=>x.id);
   if(!ids.length){
    if(generation===requestGeneration.current)
     setSnapshot({scopeKey,data:empty,loading:false,error:null});
    return;
   }
   const [sessions,templates]=await Promise.all([
    readE3BoundedPages((from,to)=>supabase.from("health_workout_sessions")
     .select("id,program_version_id,session_template_id,started_at,status,record_status")
     .eq("athlete_id",athleteId).in("program_version_id",ids)
     .eq("record_status","active").eq("status","completed")
     .order("started_at",{ascending:false,nullsFirst:false}).order("id",{ascending:true})
     .range(from,to),300,400,bySession),
    readE3BoundedPages((from,to)=>supabase.from("health_session_templates")
     .select("id,program_version_id,code,status").eq("athlete_id",athleteId)
     .in("program_version_id",ids).order("id",{ascending:true})
     .range(from,to),3000,400,byId)
   ]);
   const sessionIds=sessions.rows.map(x=>x.id);
   const sets:M4SetRow[]=[];
   let setTruncated=false;
   // Bounded IN groups avoid URL limits. Each group is paginated with a
   // stable set ID ordering, and one shared budget across every group.
   for(let offset=0;offset<sessionIds.length;offset+=25){
    if(sets.length>=10000){setTruncated=true;break;}
    const chunk=sessionIds.slice(offset,offset+25);
    const page=await readE3BoundedPages((from,to)=>supabase
     .from("health_workout_sets")
     .select("id,session_id,status,set_type,reps,rir,load_value,load_unit")
     .eq("athlete_id",athleteId).in("session_id",chunk)
     .eq("status","completed").eq("set_type","working")
     .order("id",{ascending:true}).range(from,to),10000-sets.length,400,byId);
    sets.push(...page.rows);
    if(page.truncated){setTruncated=true;break;}
   }
   const sourceTruncated=sessions.truncated||templates.truncated||setTruncated;
   const mapped=mapM3M4F21Observations(sessions.rows,sets,
    templates.rows,ids,sourceTruncated);
   if(generation===requestGeneration.current)
    setSnapshot({scopeKey,data:mapped,loading:false,error:null});
  }catch(cause){
   if(generation===requestGeneration.current)
    setSnapshot({scopeKey,data:empty,loading:false,
     error:cause instanceof Error?cause.message:"E3 sem leitura disponível"});
  }
 },[athleteId,programId,scopeKey]);
 useEffect(()=>{
  void reload();
  // Invalidate all outstanding responses on change/unmount, even when the
  // server ignores cancellation. Never allow a stale result to overwrite E3.
  return ()=>{requestGeneration.current+=1;};
 },[reload]);
 return {...viewE3ReadSnapshot(scopeKey,snapshot),reload};
}
