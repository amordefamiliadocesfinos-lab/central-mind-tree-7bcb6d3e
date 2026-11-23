import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { HealthWorkoutInteractiveTimerF19 } from "../../src/modules/health/components/HealthWorkoutInteractiveTimerF19";
import "../../src/index.css";
import type { WorkoutExercise, WorkoutSet } from "../../src/modules/health/hooks/useHealthWorkoutM4";
import type { HealthWorkoutTimerF19Controller } from "../../src/modules/health/hooks/useHealthWorkoutTimerF19";

// G5-E CI ONLY. No Supabase client, no live credentials, no real athlete or cloud service.
// A localStorage snapshot is a UI/remount fixture, NOT a transactional or authenticated database.
const KEY = "cch-f24-g5e-synthetic-v1";
const ATHLETE = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SESSION = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const EX1 = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const EX2 = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
type Phase = "rest" | "work" | "none";
type SyntheticSet = { id: string; set_number: number; load_value: number; reps: number; rir: number; updated_at: string; };
type Snapshot = { athleteId: string; sessionId: string; revision: number; phase: Phase; count: number; sets: SyntheticSet[]; restStart: string; paused: boolean; };
function initial(): Snapshot {
 const now = Date.now();
 return { athleteId: ATHLETE, sessionId: SESSION, revision: 0, phase: "rest", count: 3, paused: false,
   restStart: new Date(now-35_000).toISOString(),
   sets: [1,2,3].map(n=>({ id:"synthetic-set-"+n, set_number:n, load_value:80, reps:8, rir:2, updated_at:new Date(now).toISOString() })) };
}
function read():Snapshot {
 try {
   const stored = localStorage.getItem(KEY);
   if (!stored) return initial();
   const value:Snapshot = JSON.parse(stored);
   return value.athleteId === ATHLETE && value.sessionId === SESSION && value.count >=3 && value.count<=100 && Array.isArray(value.sets)
    ? value : initial();
 } catch { return initial(); }
}
const exercise = (id: string, cat: string, order: number, status: "active"|"pending"):WorkoutExercise =>
 ({ id, athlete_id:ATHLETE, session_id:SESSION, exercise_id:cat, sequence_order:order, status,
 planned_sets_min:3, planned_sets_max:3, planned_reps_min:6, planned_reps_max:10,
 planned_rir_target:2, planned_rest_seconds:90 } as unknown as WorkoutExercise);
const exercises = [exercise(EX1,"synthetic-catalog-1",1,"active"),exercise(EX2,"synthetic-catalog-2",2,"pending")];
function App() {
 const [snapshot, setSnapshot] = useState(read);
 useEffect(()=>{
   const listener = (event:StorageEvent)=>{ if(event.key===KEY) setSnapshot(read()); };
   window.addEventListener("storage",listener);
   return ()=>window.removeEventListener("storage",listener);
 },[]);
 const mutate = (updater:(current:Snapshot)=>Snapshot)=>{
   const state=read();
   const next={...updater(state),revision:state.revision+1};
   localStorage.setItem(KEY,JSON.stringify(next));
   setSnapshot(next);
 };
 const reset = ()=>{const value=initial();localStorage.setItem(KEY,JSON.stringify(value));setSnapshot(value);};
 const sets = useMemo(()=>snapshot.sets.map(s=>({
   id:s.id, athlete_id:ATHLETE,session_id:SESSION,workout_exercise_id:EX1,
   set_number:s.set_number,status:"completed",set_type:"working",load_value:s.load_value,
   load_unit:"kg",reps:s.reps,rir:s.rir,rest_seconds:90,updated_at:s.updated_at,
   created_at:new Date(Date.parse(s.updated_at)-60_000).toISOString()
 } as unknown as WorkoutSet)),[snapshot.sets]);
 const rest = snapshot.phase==="none" ? null : ({
   id: "synthetic-"+snapshot.phase+"-"+snapshot.count,
   athlete_id:ATHLETE,session_id:SESSION, workout_exercise_id:EX1,
   workout_set_id:snapshot.phase==="rest"?"synthetic-set-"+snapshot.count:null,
   interval_type:snapshot.phase,set_number:snapshot.phase==="work"?snapshot.count+1:snapshot.count,
   status:"running",started_at:snapshot.restStart,target_seconds:90,
   pause_accumulated_seconds:0,paused_at:null,ended_at:null
 });
 const timer={
   loading:false,saving:false,available:true,
   activeInterval:rest,intervals:rest?[rest]:[],
   sessionTiming:{id:"synthetic-timer",status:snapshot.paused?"paused":"active",
     started_at:new Date(Date.now()-300_000).toISOString(),pause_accumulated_seconds:0,timer_paused_at:snapshot.paused?new Date().toISOString():null,ended_at:null},
   finishRest:async(_intervalId:string,options?:{startNextWork?:boolean;nextWorkoutExerciseId?:string|null})=>{
     mutate(old=>{
       if(old.phase!=="rest") throw new Error("synthetic interval not in rest");
       if(options?.startNextWork){
         if(options.nextWorkoutExerciseId!==EX1) return {...old,phase:"none"};
         if(old.count>=100) throw new Error("synthetic max");
         return {...old,phase:"work",restStart:new Date().toISOString()};
       }
       return {...old,phase:"none"};
     });
   },
   finishWorkStartRest:async(_intervalId:string)=>{
     mutate(old=>{
       if(old.phase!=="work" || old.count>=100) throw new Error("synthetic work not running");
       const n=old.count+1; const now=Date.now();
       return {...old,count:n,phase:"rest",restStart:new Date(now).toISOString(),
         sets:[...old.sets,{id:"synthetic-set-"+n,set_number:n,load_value:80,reps:8,rir:2,updated_at:new Date(now-20_000).toISOString()}]};
     });
   },
   updateSetExecution:async(setId:string,v:{loadValue?:number;reps?:number;rir?:number})=>{
     mutate(old=>({...old,sets:old.sets.map(s=>s.id===setId?{...s,load_value:v.loadValue??s.load_value,
       reps:v.reps??s.reps,rir:v.rir??s.rir,updated_at:new Date(Date.now()+1000).toISOString()}:s)}));
   },
   startWorkInterval:async()=>{mutate(old=>({...old,phase:"work",restStart:new Date().toISOString()}));},
   pauseWorkout:async()=>mutate(old=>({...old,paused:true})),
   resumeWorkout:async()=>mutate(old=>({...old,paused:false})),
   cancelInterval:async()=>mutate(old=>({...old,phase:"none"}))
 } as unknown as HealthWorkoutTimerF19Controller;
 return <div className="mx-auto max-w-2xl space-y-3 p-3">
  <header className="rounded-xl border border-amber-600 bg-amber-50 p-3 text-sm text-black" data-testid="g5e-isolation">
   <strong>G5-E · SESSÃO SINTÉTICA LOCAL — SEM AUTENTICAÇÃO REAL</strong>
   <p>Atleta fictício de ensaio · dados somente neste navegador de CI · nenhuma conexão com o Painel Central ou Supabase.</p>
   <p data-testid="g5e-snapshot">Sessão: {snapshot.sessionId} · Estado: {snapshot.phase} {snapshot.count}/3 · Revisão local: {snapshot.revision}</p>
   <button type="button" onClick={reset} className="mt-2 rounded border border-black px-3 py-2">Reiniciar ensaio sintético</button>
  </header>
  <HealthWorkoutInteractiveTimerF19 sessionTitle="Treino isolado F24 G5-E" fallbackStartedAt={new Date(Date.now()-300_000).toISOString()}
   exercises={exercises} setsByExercise={new Map([[EX1,sets],[EX2,[]]])}
   exerciseNameById={new Map([["synthetic-catalog-1","Supino máquina"],["synthetic-catalog-2","Remada"]])}
   historicalReferences={new Map()} historyLoading={false} timer={timer}
   onCompleteWorkout={async()=>mutate(old=>({...old,phase:"none"}))}
   onConfirmEquipment={async()=>{}} />
 </div>;
}
createRoot(document.getElementById("root")!).render(<App/>);
