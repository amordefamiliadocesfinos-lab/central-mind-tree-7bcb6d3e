import React, {useMemo, useState} from "react";
import {describe,it,expect} from "vitest";
import {render,fireEvent,screen,waitFor,cleanup} from "@testing-library/react";
import {HealthWorkoutInteractiveTimerF19} from "../src/modules/health/components/HealthWorkoutInteractiveTimerF19";
import type {WorkoutExercise,WorkoutSet} from "../src/modules/health/hooks/useHealthWorkoutM4";
import type {HealthWorkoutTimerF19Controller} from "../src/modules/health/hooks/useHealthWorkoutTimerF19";

const base="2026-11-23T20:00:00Z";
const completed=(index:number):WorkoutSet=>({
 id:"s-"+index,session_id:"synth-session",athlete_id:"synth-athlete",
 workout_exercise_id:"ex1",set_number:index,status:"completed",set_type:"working",
 reps:8,rir:2,load_value:80,load_unit:"kg",rest_seconds:90,
 created_at:base,updated_at:"2026-11-23T22:01:00Z"
} as unknown as WorkoutSet);
const ex=(id:string,n:number,status:"active"|"pending"):WorkoutExercise=>({
 id,athlete_id:"synth-athlete",session_id:"synth-session",exercise_id:"cat-"+n,
 sequence_order:n,status,planned_sets_min:3,planned_sets_max:3,
 planned_reps_min:6,planned_reps_max:10,planned_rir_target:2,planned_rest_seconds:90
} as unknown as WorkoutExercise);
const exercises=[ex("ex1",1,"active"),ex("ex2",2,"pending")];
const names=new Map([["cat-1","Supino máquina"],["cat-2","Remada"]]);
const makeRest=(n:number)=>({
 id:"rest-"+n,interval_type:"rest",status:"running",workout_exercise_id:"ex1",
 workout_set_id:"s-"+n,set_number:n,started_at:"2026-11-23T22:00:00Z",
 target_seconds:90,pause_accumulated_seconds:0,paused_at:null,ended_at:null
});
function ExerciseHarness({initialCount=3,onStart=()=>{}}:{
 initialCount?:number;onStart?:(target:string)=>void
}){
 const [count,setCount]=useState(initialCount);
 const rest=useMemo(()=>makeRest(count),[count]);
 const sets=useMemo(()=>Array.from({length:count},(_,i)=>completed(i+1)),[count]);
 const timer={
  available:true,loading:false,saving:false,activeInterval:rest,intervals:[rest],
  sessionTiming:{id:"synthetic-session-timer",status:"active",
   started_at:"2026-11-23T20:00:00Z",pause_accumulated_seconds:0,
   timer_paused_at:null,ended_at:null},
  finishRest:async (_id:string, options?:{startNextWork?:boolean;nextWorkoutExerciseId?:string|null})=>{
   if(options?.startNextWork){
    onStart(options.nextWorkoutExerciseId??"none");
    setCount(n=>n+1); // synthetic response: next work then next completed rest
   }
  },
  startWorkInterval:async()=>{},finishWorkStartRest:async()=>{},
  updateSetExecution:async()=>{},pauseWorkout:async()=>{},
  resumeWorkout:async()=>{},cancelInterval:async()=>{}
 } as unknown as HealthWorkoutTimerF19Controller;
 return <HealthWorkoutInteractiveTimerF19
   sessionTitle="Treino sintético" fallbackStartedAt={base}
   exercises={exercises} setsByExercise={new Map([["ex1",sets],["ex2",[]]])}
   exerciseNameById={names} historicalReferences={new Map()} historyLoading={false}
   timer={timer} onCompleteWorkout={async()=>{}}
   onConfirmEquipment={async()=>{}}
 />;
}
const extraButton=()=>screen.getAllByRole("button",{name:/\\+ Série extra$/}).at(-1)!;
const nextButton=()=>screen.getAllByRole("button",{name:/^Próximo exercício$/}).at(-1)!;
describe("CCH F24 F19 — interface real com backend sintético isolado",()=>{
 it("at 3/3 selects extra instead of next, then 4/3 → 5/3 requires another click",async()=>{
  const selections:string[]=[];
  render(<ExerciseHarness onStart={id=>selections.push(id)}/>);
  expect(extraButton()).toBeTruthy();
  expect(nextButton()).toBeTruthy();
  fireEvent.click(extraButton());
  // Navigate to another exercise and return without losing the explicit extra choice.
  fireEvent.click(screen.getByLabelText("Próximo exercício"));
  fireEvent.click(screen.getByLabelText("Exercício anterior"));
  await waitFor(()=>expect(screen.getByRole("button",{name:/Iniciar Supino máquina/i})).toBeTruthy());
  fireEvent.click(screen.getByRole("button",{name:/Iniciar Supino máquina/i}));
  await waitFor(()=>expect(selections).toEqual(["ex1"]));
  await waitFor(()=>expect(screen.getByText(/Série 4 concluída/)).toBeTruthy());
  expect(extraButton()).toBeTruthy();
  // No automatic 5th until athlete explicitly chooses it again.
  expect(selections.length).toBe(1);
  fireEvent.click(extraButton());
  fireEvent.click(screen.getByRole("button",{name:/Iniciar Supino máquina/i}));
  await waitFor(()=>expect(selections).toEqual(["ex1","ex1"]));
  cleanup();
 });
 it("fresh mount at 4/3 rest has both choices but does not pick extra without a click",()=>{
  render(<ExerciseHarness initialCount={4}/>);
  expect(extraButton().getAttribute("aria-pressed")).toBe("false");
  expect(nextButton().getAttribute("aria-pressed")).toBe("false");
  cleanup();
 });
});
