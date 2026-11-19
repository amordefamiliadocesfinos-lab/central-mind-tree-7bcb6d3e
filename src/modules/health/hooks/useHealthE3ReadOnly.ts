import {useCallback,useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {mapM3M4F21Observations} from "../cch/e3ObservationAdapter";
import type {E3Mapped} from "../cch/e3ObservationAdapter";

const empty:E3Mapped={observations:[],totalValidSessions:0,uncategorizedSessions:0,
 missingWorkingSetData:0,sourceTruncated:false};
export function useHealthE3ReadOnly(athleteId:string|null|undefined,programId:string|null|undefined){
 const [data,setData]=useState<E3Mapped>(empty);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const reload=useCallback(async()=>{
  if(!athleteId||!programId){setData(empty);setError(null);setLoading(false);return;}
  setLoading(true);setError(null);
  try{
   const versions=await supabase.from("health_program_versions")
    .select("id").eq("athlete_id",athleteId).eq("program_id",programId);
   if(versions.error)throw new Error(versions.error.message);
   const ids=(versions.data??[]).map(x=>x.id);
   if(!ids.length){setData(empty);return;}
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
     .limit(10001):null;
   if(rows?.error)throw new Error(rows.error.message);
   const setTruncated=(rows?.data?.length??0)>10000;
   const mapped=mapM3M4F21Observations(scoped,(rows?.data??[]).slice(0,10000),
    templates.data??[],ids,truncated||setTruncated);
   setData(mapped);
  }catch(cause){setError(cause instanceof Error?cause.message:"E3 sem leitura disponível");setData(empty);}
  finally{setLoading(false);}
 },[athleteId,programId]);
 useEffect(()=>{void reload();},[reload]);
 return {...data,loading,error,reload};
}
