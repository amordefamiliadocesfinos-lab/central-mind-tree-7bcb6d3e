import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "vite";
import React from "react";
import path from "node:path";
import {renderToStaticMarkup} from "react-dom/server";

/** SSR contract of the REAL F19 React tree (not the production database).
 * No athlete data, no Supabase, no UI event, no browser claim.
 * Exercises are fixtures. Remounting replays a server-persisted rest snapshot.
 */
const vite=await createServer({configFile:false,root:process.cwd(),
  resolve:{alias:{"@":path.resolve("src")}},
  esbuild:{jsx:"automatic"},optimizeDeps:{noDiscovery:true},
  server:{middlewareMode:true},appType:"custom",logLevel:"silent"});
let Workout;
try {
 ({HealthWorkoutInteractiveTimerF19:Workout}=
  await vite.ssrLoadModule("/src/modules/health/components/HealthWorkoutInteractiveTimerF19.tsx"));
} catch(error) {
 await vite.close();throw error;
}
const fakeSet=(n)=>({
 id:"set-"+n,session_id:"session-1",workout_exercise_id:"ex-1",athlete_id:"athlete-synthetic",
 set_number:n,status:"completed",set_type:"working",load_value:80,load_unit:"kg",reps:8,rir:2,
 updated_at:"2026-11-23T20:00:00Z",created_at:"2026-11-23T19:00:00Z"
});
const makeProps=(count)=>{
 const active={id:"ex-1",athlete_id:"athlete-synthetic",session_id:"session-1",exercise_id:"cat-1",
  sequence_order:1,status:"active",planned_sets_min:3,planned_sets_max:3,
  planned_reps_min:6,planned_reps_max:10,planned_rir_target:2,planned_rest_seconds:90};
 const next={...active,id:"ex-2",exercise_id:"cat-2",sequence_order:2,status:"pending"};
 const sets=Array.from({length:count},(_,i)=>fakeSet(i+1));
 const rest={id:"rest-"+count,interval_type:"rest",workout_exercise_id:"ex-1",
  workout_set_id:"set-"+count,session_id:"session-1",athlete_id:"athlete-synthetic",
  set_number:count,status:"running",started_at:"2026-11-23T21:00:00Z",target_seconds:90,
  pause_accumulated_seconds:0,paused_at:null,ended_at:null};
 const timer={loading:false,saving:false,available:true,activeInterval:rest,intervals:[rest],
  sessionTiming:{id:"timer-session",status:"active",started_at:"2026-11-23T19:00:00Z",
   pause_accumulated_seconds:0,timer_paused_at:null,ended_at:null},
  startWorkInterval:async()=>{},finishRest:async()=>{},updateSetExecution:async()=>{},
  finishWorkStartRest:async()=>{},pauseWorkout:async()=>{},resumeWorkout:async()=>{},
  cancelInterval:async()=>{}};
 return {
  sessionTitle:"Sessão sintética",fallbackStartedAt:"2026-11-23T19:00:00Z",
  exercises:[active,next],
  setsByExercise:new Map([["ex-1",sets],["ex-2",[]]]),
  exerciseNameById:new Map([["cat-1","Supino máquina"],["cat-2","Remada"]]),
  historicalReferences:new Map(),historyLoading:false,timer,
  onCompleteWorkout:async()=>{},onConfirmEquipment:async()=>{}
 };
};
const render=(count)=>renderToStaticMarkup(React.createElement(Workout,makeProps(count)));
try{
 test("the real F19 screen offers equal choice after 3/3 in persisted rest state",()=>{
  const html=render(3);
  assert.match(html,/\+ Série extra/);
  assert.match(html,/Próximo exercício/);
  assert.match(html,/Salvar resultado/);
  assert.match(html,/Supino máquina/);
 });
 test("remount from completed 4/3 rest re-offers explicit extra choice for 5/3",()=>{
  const html=render(4);
  assert.match(html,/\+ Série extra/);
  assert.match(html,/Próximo exercício/);
 });
 test("same screen never offers extra after hard cap 100",()=>{
  const html=render(100);
  assert.doesNotMatch(html,/\+ Série extra/);
 });
}finally{
 await vite.close();
}
