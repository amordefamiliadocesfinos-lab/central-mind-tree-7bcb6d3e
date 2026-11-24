import React, {useCallback,useEffect,useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {supabase} from "@/integrations/supabase/client";
import {HealthWorkoutInteractiveTimerF19} from "@/modules/health/components/HealthWorkoutInteractiveTimerF19";
import {useHealthWorkoutTimerF19} from "@/modules/health/hooks/useHealthWorkoutTimerF19";
import "@/index.css";
import type {WorkoutExercise,WorkoutSet} from "@/modules/health/hooks/useHealthWorkoutM4";

type Config={email:string;password:string;athleteId:string;sessionId:string};
declare global {interface Window {__G5F_TEST_AUTH__?:Config}}
const cfg=window.__G5F_TEST_AUTH__;
function App(){
 const [logged,setLogged]=useState(false);
 const [error,setError]=useState("");
 const [exercises,setExercises]=useState<WorkoutExercise[]>([]);
 const [sets,setSets]=useState<WorkoutSet[]>([]);
 const [sessionStart,setSessionStart]=useState("");
 const refresh=useCallback(async()=>{
   if(!cfg) return;
   const [e,s]=await Promise.all([
    supabase.from("health_workout_exercises").select("*").eq("session_id",cfg.sessionId).order("id"),
    supabase.from("health_workout_sets").select("*").eq("session_id",cfg.sessionId).order("set_number")
   ]);
   if(e.error || s.error) throw Error(e.error?.message??s.error?.message);
   setExercises(e.data as unknown as WorkoutExercise[]);
   setSets(s.data as unknown as WorkoutSet[]);
 },[]);
 const timer=useHealthWorkoutTimerF19(logged?cfg?.athleteId:null,logged?cfg?.sessionId:null,refresh);
 useEffect(()=>{let cancelled=false;
   (async()=>{try{
    if(!cfg) throw Error("No local CI credentials injected");
    const signed=await supabase.auth.signInWithPassword({email:cfg.email,password:cfg.password});
    if(signed.error||!signed.data.user) throw Error("Local Auth login denied");
    if(!cancelled){
      setLogged(true);
      await refresh();
      const res=await supabase.from("health_workout_sessions").select("started_at").eq("id",cfg.sessionId).single();
      if(res.data?.started_at) setSessionStart(res.data.started_at);
    }
   }catch(e){if(!cancelled)setError(e instanceof Error?e.message:"Local Auth failure");}})();
   return()=>{cancelled=true;};
 },[refresh]);
 const byExercise=useMemo(()=>{
    const m=new Map<string,WorkoutSet[]>();
    for(const s of sets){const e=s.workout_exercise_id; m.set(e,[...(m.get(e)??[]),s]);}
    return m;
 },[sets]);
 if(error) return <div role="alert">G5-F local auth error: {error}</div>;
 if(!logged||timer.loading||!sessionStart) return <div>Autenticando no GoTrue local e carregando F19...</div>;
 return <main className="mx-auto max-w-2xl space-y-3 p-3">
   <header data-testid="g5f-auth-confirmed" className="rounded-lg border p-3">
     <strong>G5-F AUTENTICADO LOCAL — DADOS SINTÉTICOS</strong>
     <div data-testid="g5f-count">Séries concluídas: {sets.filter(s=>s.workout_exercise_id===exercises[0]?.id).length}</div>
     <div>Ambiente efêmero; não é o Painel Central hospedado</div>
   </header>
   <HealthWorkoutInteractiveTimerF19
    sessionTitle="Treino F19 autenticação local" fallbackStartedAt={sessionStart}
    exercises={exercises} setsByExercise={byExercise}
    exerciseNameById={new Map([["cat-g5f-1","Supino máquina"],["cat-g5f-2","Remada"]])}
    historicalReferences={new Map()} historyLoading={false} timer={timer}
    onCompleteWorkout={async()=>{}} onConfirmEquipment={async()=>{}}/>
 </main>;
}
createRoot(document.getElementById("root")!).render(<App/>);
