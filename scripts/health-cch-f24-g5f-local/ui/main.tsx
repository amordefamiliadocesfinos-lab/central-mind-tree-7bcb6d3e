import React, {useCallback,useEffect,useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {supabase} from "@/integrations/supabase/client";
import {HealthWorkoutInteractiveTimerF19} from "@/modules/health/components/HealthWorkoutInteractiveTimerF19";
import {HealthExerciseMovementPreview} from "@/modules/health/components/HealthExerciseMovementPreview";
import type {ExerciseCatalogItem} from "@/modules/health/hooks/useHealthCatalogs";
import {useHealthWorkoutTimerF19} from "@/modules/health/hooks/useHealthWorkoutTimerF19";
import "@/index.css";
import type {WorkoutExercise,WorkoutSet} from "@/modules/health/hooks/useHealthWorkoutM4";

type Config={email:string;password:string;athleteId:string;sessionId:string};
declare global {interface Window {__G5F_TEST_AUTH__?:Config}}
const cfg=window.__G5F_TEST_AUTH__;
function App(){
 const [logged,setLogged]=useState(false);
 const [focusMode,setFocusMode]=useState(true);
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
 // Match F19 production mounting: refreshes with an existing session must not
 // unmount the component and erase the athlete’s explicit next-series choice.
 if(!logged||!sessionStart||(timer.loading&&!timer.sessionTiming)) return <div>Autenticando no GoTrue local e carregando F19...</div>;
 return <main className="mx-auto max-w-2xl space-y-3 p-3">
   <header data-testid="g5f-auth-confirmed" className="rounded-lg border p-3">
     <strong>G5-F AUTENTICADO LOCAL — DADOS SINTÉTICOS</strong>
     <div data-testid="g5f-count">Séries concluídas: {sets.filter(s=>s.workout_exercise_id===exercises[0]?.id).length}</div>
     <div>Ambiente efêmero; não é o Painel Central hospedado</div>
   </header>
   <div data-cch-focus-chrome data-testid="g5f-navigation-chrome">Menu de teste</div>
   <div data-cch-focus={focusMode?"true":undefined}>
   <HealthWorkoutInteractiveTimerF19 focusMode={focusMode} onToggleFocus={()=>setFocusMode(v=>!v)}
    sessionTitle="Treino F19 autenticação local" fallbackStartedAt={sessionStart}
    exercises={exercises} setsByExercise={byExercise}
    exerciseNameById={new Map([["cat-g5f-1","Supino máquina"],["cat-g5f-2","Remada"]])}
    historicalReferences={new Map()} historyLoading={false} timer={timer}
    onCompleteWorkout={async()=>{}} onConfirmEquipment={async()=>{}}/>
   </div>
   <section aria-label="Fixture editorial isolada">
     <HealthExerciseMovementPreview name="Amostra S01 sintética" exercise={{id:"cbbf1aa6-b906-46e8-84ce-b13f67aa4f0a",muscles:[],equipment:[],equivalences:[]} as ExerciseCatalogItem}/>
     <details><summary>Fixtures R04</summary>
       {[
        ["c3e88df3-7414-4ebb-a457-b4a8a266dd72","Supino reto máquina sentado"],
        ["8c608253-bb2b-42e8-a10b-b00c4b502342","Supino inclinado máquina"],
        ["18d9c6a3-4b1e-45ad-8643-02cea77f3461","Elevação lateral com halteres"],
        ["b55f0597-d2a5-4773-b6f7-932092929fa6","Remada baixa"],
        ["8e88d7a9-9cdd-4975-ab2f-f352b8c6da6f","Puxada alta"],
        ["e3fee31e-4811-4573-9297-74ae1e24d057","Leg press 45°"],
        ["651f57cd-a556-4c36-b170-c2a434c289e2","Cadeira extensora"],
        ["unknown-fixture","Exercício sem amostra"]
       ].map(([id,name])=><HealthExerciseMovementPreview key={id} name={name} exercise={{id,muscles:[],equipment:[],equivalences:[]} as ExerciseCatalogItem}/>)}
     </details>
   </section>
 </main>;
}
createRoot(document.getElementById("root")!).render(<App/>);
