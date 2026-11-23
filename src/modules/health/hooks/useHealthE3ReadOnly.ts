import {useCallback,useEffect,useRef,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {mapM3M4F21Observations,viewE3ReadSnapshot} from "../cch/e3ObservationAdapter";
import type {E3Mapped,E3ReadSnapshot} from "../cch/e3ObservationAdapter";

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
   const versions=await supabase.from("health_program_versions")
    .select("id").eq("athlete_id",athleteId).eq("program_id",programId);
   if(versions.error)throw new Error(versions.error.message);
   const ids=(versions.data??[]).map(x=>x.id);
   if(!ids.length){
    if(generation===requestGeneration.current)
     setSnapshot({scopeKey,data:empty,loading:false,error:null});
    return;
   }
   const [sessions,templates]=await Promise.all([
    supabase.from("health_workout_sessions")
     .select("id,program_version_id,session_template_id,started_at,status,record_status")
     .eq("athlete_id",athleteId).in("program_version_id",ids)
     .eq("record_status","active").eq("status","completed")
     .order("started_at",{ascending:false}).limit(301),
    supabase.from("health_session_templates")
     .select("id,program_version_id,code,status").eq("athlete_id",athleteId)
     .in("program_version_id",ids),
   ]);
   if(sessions.error)throw new Error(sessions.error.message);
   if(templates.error)throw new Error(templates.error.message);
   const truncated=(sessions.data??[]).length>300;
   const scoped=(sessions.data??[]).slice(0,300);
   const sessionIds=scoped.map(x=>x.id);
   const rows=sessionIds.length?await supabase.from("health_workout_sets")
     .select("session_id,status,set_type,reps,rir,load_value,load_unit")
     .eq("athlete_id",athleteId).in("session_id",sessionIds)
     .eq("status","completed").eq("set_type","working")
     .limit(1000):null;
   if(rows?.error)throw new Error(rows.error.message);
   // Conservative default: a capped response cannot prove total coverage.
   const setTruncated=(rows?.data?.length??0)>=1000;
   const mapped=mapM3M4F21Observations(scoped,(rows?.data??[]),
    templates.data??[],ids,truncated||setTruncated);
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
