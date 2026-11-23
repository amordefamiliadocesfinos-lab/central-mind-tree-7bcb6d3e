import {useEffect,useMemo,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import type {WorkoutExercise} from "./useHealthWorkoutM4";
import {selectF24ComparableHistory} from "../cch/f24ComparableHistory";
import type {F24HistoryReference,F24HistoryRow} from "../cch/f24ComparableHistory";

export type F24ExerciseHistoryStatus = {
 reference:F24HistoryReference|null;
 equipmentLabel:string|null;
 reason:"comparable"|"equipment_unconfirmed"|"no_recent_match"|"unavailable";
};

/** Read-only, scoped and capped. No fallback numeric comparison across machines.
 * Old sessions/sets remain untouched. No clinical data or E5 collection.
 */
export function useF24WorkoutHistory(
 athleteId:string|null|undefined,
 sessionId:string|null|undefined,
 exercises:WorkoutExercise[]
){
 const [state,setState]=useState<{
  scope:string|null;records:Map<string,F24ExerciseHistoryStatus>;loading:boolean
 }>({scope:null,records:new Map(),loading:false});
 const exerciseIds=useMemo(()=>[...new Set(exercises.map(e=>e.exercise_id))].sort(),
  [exercises]);
 const key=athleteId&&sessionId?JSON.stringify([athleteId,sessionId,exerciseIds]):null;
 useEffect(()=>{
  let cancelled=false;
  if(!key||!athleteId||!sessionId||!exercises.length){
   setState({scope:key,records:new Map(),loading:false});
   return;
  }
  const run=async()=>{
   setState({scope:key,records:new Map(),loading:true});
   const unavailable=()=>new Map(exercises.map(e=>[e.id,{
    reference:null,equipmentLabel:null,reason:"unavailable" as const
   }]));
   try {
    const current=await supabase.from("health_cch_workout_equipment")
      .select("workout_exercise_id,equipment_label")
      .eq("athlete_id",athleteId).eq("session_id",sessionId);
    if(current.error)throw current.error;
    const currentLabels=new Map((current.data??[])
      .map(x=>[x.workout_exercise_id,x.equipment_label]));
    const result=new Map<string,F24ExerciseHistoryStatus>();
    for(const ex of exercises){
     const equipmentLabel=currentLabels.get(ex.id)??null;
     result.set(ex.id,{reference:null,equipmentLabel,
      reason:equipmentLabel?"no_recent_match":"equipment_unconfirmed"});
    }
    if(![...result.values()].some(x=>x.equipmentLabel)){
     if(!cancelled)setState({scope:key,records:result,loading:false});
     return;
    }
    // One bounded window of completed sessions; overflow is unknown, not EOF.
    const sessions=await supabase.from("health_workout_sessions")
      .select("id,started_at")
      .eq("athlete_id",athleteId).eq("status","completed")
      .eq("record_status","active").neq("id",sessionId)
      .order("started_at",{ascending:false}).limit(101);
    if(sessions.error)throw sessions.error;
    if((sessions.data??[]).length>100)throw new Error("Histórico maior que limite consultivo.");
    const sessionRows=sessions.data??[];
    const historyRows:F24HistoryRow[]=[];
    for(let offset=0;offset<sessionRows.length;offset+=25){
     const chunk=sessionRows.slice(offset,offset+25);
     const listed=await supabase.from("health_workout_exercises")
      .select("id,session_id,exercise_id")
      .eq("athlete_id",athleteId).in("session_id",chunk.map(x=>x.id))
      .in("exercise_id",exerciseIds).limit(1001);
     if(listed.error)throw listed.error;
     if((listed.data??[]).length>1000)throw new Error("Histórico de exercícios truncado.");
     const past=listed.data??[];
     if(!past.length)continue;
     const [equipment,sets]=await Promise.all([
      supabase.from("health_cch_workout_equipment")
       .select("workout_exercise_id,equipment_label")
       .eq("athlete_id",athleteId).in("workout_exercise_id",past.map(x=>x.id)).limit(1001),
      supabase.from("health_workout_sets")
       .select("workout_exercise_id,load_value,load_unit,reps,rir,completed_at")
       .eq("athlete_id",athleteId).eq("status","completed").eq("set_type","working")
       .in("workout_exercise_id",past.map(x=>x.id))
       .order("completed_at",{ascending:false}).limit(1001)
     ]);
     if(equipment.error||sets.error)throw equipment.error??sets.error;
     if((equipment.data??[]).length>1000||(sets.data??[]).length>1000)
      throw new Error("Histórico de séries truncado.");
     const byEquipment=new Map((equipment.data??[])
      .map(x=>[x.workout_exercise_id,x.equipment_label]));
     const byPast=new Map(past.map(x=>[x.id,x]));
     const dates=new Map(chunk.map(x=>[x.id,x.started_at]));
     for(const s of sets.data??[]){
      const ex=byPast.get(s.workout_exercise_id);
      if(!ex)continue;
      historyRows.push({
       sessionId:ex.session_id,sessionStartedAt:dates.get(ex.session_id)??"",
       workoutExerciseId:ex.id,exerciseId:ex.exercise_id,
       equipmentLabel:byEquipment.get(ex.id)??null,
       loadValue:s.load_value,loadUnit:s.load_unit,reps:s.reps,rir:s.rir,
       completedAt:s.completed_at
      });
     }
    }
    for(const ex of exercises){
     const entry=result.get(ex.id)!;
     if(!entry.equipmentLabel)continue;
     const reference=selectF24ComparableHistory(ex.exercise_id,entry.equipmentLabel,historyRows);
     result.set(ex.id,{...entry,reference,reason:reference?"comparable":"no_recent_match"});
    }
    if(!cancelled)setState({scope:key,records:result,loading:false});
   }catch{
    if(!cancelled)setState({scope:key,records:unavailable(),loading:false});
   }
  };
  void run();
  return ()=>{cancelled=true};
 },[key,athleteId,sessionId,exercises]);
 const visible=state.scope===key?state.records:new Map<string,F24ExerciseHistoryStatus>();
 return {records:visible,loading:state.scope!==key||state.loading};
}
