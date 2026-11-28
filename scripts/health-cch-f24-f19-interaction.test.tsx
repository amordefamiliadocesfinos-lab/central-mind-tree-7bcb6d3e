import React, {useMemo, useState} from "react";
import {describe,it,expect} from "vitest";
import {render,fireEvent,screen,waitFor,cleanup} from "@testing-library/react";
import {HealthWorkoutContextualGuidance} from "../src/modules/health/components/HealthWorkoutContextualGuidance";
import {HealthWorkoutInteractiveTimerF19} from "../src/modules/health/components/HealthWorkoutInteractiveTimerF19";
import type {WorkoutExercise,WorkoutSet} from "../src/modules/health/hooks/useHealthWorkoutM4";
import type {F24ExerciseHistoryStatus} from "../src/modules/health/hooks/useF24WorkoutHistory";
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
function ExerciseHarness({initialCount=3,onStart=()=>{},history=new Map(),historyLoading=false,scope,paused=false,ready=false,onEnd=()=>{}}:{
 initialCount?:number;onStart?:(target:string)=>void;history?:Map<string,F24ExerciseHistoryStatus>;historyLoading?:boolean;scope?:string;paused?:boolean;ready?:boolean;onEnd?:()=>void
}){
 const [count,setCount]=useState(initialCount);
 const rest=useMemo(()=>makeRest(count),[count]);
 const sets=useMemo(()=>Array.from({length:count},(_,i)=>completed(i+1)),[count]);
 const timer={
  available:true,loading:false,saving:false,activeInterval:ready?null:rest,intervals:ready?[]:[rest],
  sessionTiming:{id:"synthetic-session-timer",status:paused?"paused":"active",
   started_at:"2026-11-23T20:00:00Z",pause_accumulated_seconds:0,
   timer_paused_at:null,ended_at:null},
  finishRest:async (_id:string, options?:{startNextWork?:boolean;nextWorkoutExerciseId?:string|null})=>{
   if(options?.startNextWork){
    onStart(options.nextWorkoutExerciseId??"none");
    setCount(n=>n+1); // synthetic response: next work then next completed rest
   }
  },
  startWorkInterval:async(id:string)=>onStart(id),finishWorkStartRest:async()=>{},
  updateSetExecution:async()=>{},pauseWorkout:async()=>{},
  resumeWorkout:async()=>{},cancelInterval:async()=>{}
 } as unknown as HealthWorkoutTimerF19Controller;
 return <HealthWorkoutInteractiveTimerF19
   sessionTitle="Treino sintético" fallbackStartedAt={base} guidanceScope={scope} guidanceReadReady={true}
   exercises={exercises} setsByExercise={new Map([["ex1",sets],["ex2",[]]])}
   exerciseNameById={names} historicalReferences={history} historyLoading={historyLoading}
   timer={timer} onCompleteWorkout={async()=>{onEnd();}}
   onConfirmEquipment={async()=>{}}
 />;
}
const extraButton=()=>screen.getAllByRole("button",{name:/\+ Série extra$/}).at(-1)!;
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

describe("F24 R03 — historical values remain distinct from actual result",()=>{
 const reference={sessionId:"previous",occurredAt:"2026-11-20T10:00:00Z",equipmentLabel:"Máquina A",loadValue:95,loadUnit:"kg" as const,reps:11,rir:1};
 const history=new Map<string,F24ExerciseHistoryStatus>([
  ["ex1",{reference,equipmentLabel:"Máquina A",reason:"comparable"}],
  ["ex2",{reference:null,equipmentLabel:"Máquina B",reason:"no_recent_match"}],
 ]);
 it("shows load, reps, RIR and label provenance without copying history into actual inputs",()=>{
  render(<ExerciseHarness history={history}/>);
  const card=screen.getByTestId("cch-history-reference");
  expect(card.textContent).toContain("95 kg");
  expect(card.textContent).toContain("11 reps");
  expect(card.textContent).toContain("RIR 1");
  expect(card.textContent).toContain("Identidade física não confirmada");
  expect((screen.getByPlaceholderText("kg") as HTMLInputElement).value).toBe("80");
  fireEvent.click(screen.getByLabelText("Próximo exercício"));
  expect(card.textContent).not.toContain("95 kg");
  expect(card.textContent).toContain("Sem registro anterior com o mesmo rótulo");
  fireEvent.click(screen.getByLabelText("Exercício anterior"));
  expect(card.textContent).toContain("95 kg");
  cleanup();
 });
 it("suppresses stale numbers while loading or if reason is unavailable",()=>{
  const view=render(<ExerciseHarness history={history} historyLoading/>);
  expect(screen.getByTestId("cch-history-reference").textContent).not.toContain("95 kg");
  const unavailable=new Map<string,F24ExerciseHistoryStatus>([["ex1",{reference,equipmentLabel:null,reason:"unavailable"}]]);
  view.rerender(<ExerciseHarness history={unavailable}/>);
  expect(screen.getByTestId("cch-history-reference").textContent).toContain("Histórico indisponível");
  expect(screen.getByTestId("cch-history-reference").textContent).not.toContain("95 kg");
  cleanup();
 });
});

describe("F24 R05 — optional guidance without interference",()=>{
 const history=new Map<string,F24ExerciseHistoryStatus>([["ex1",{reference:null,equipmentLabel:null,reason:"equipment_unconfirmed"}]]);
 it("silence survives pause/resume and resets only with a new session scope",()=>{
  const view=render(<ExerciseHarness initialCount={2} scope="session-a" history={history}/>);
  const tip=screen.getByTestId("cch-contextual-guidance");
  expect(tip.textContent).not.toContain("Sem rótulo confirmado");
  expect(screen.getByRole("button",{name:"Iniciar próxima série"}).compareDocumentPosition(tip)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Ver dica"}));
  fireEvent.click(screen.getByRole("button",{name:"Silenciar dicas"}));
  expect(screen.queryByTestId("cch-contextual-guidance")).toBeNull();
  view.rerender(<ExerciseHarness initialCount={2} scope="session-a" history={history} paused/>);
  expect(screen.queryByRole("button",{name:"Reativar orientações"})).toBeNull();
  view.rerender(<ExerciseHarness initialCount={2} scope="session-a" history={history}/>);
  expect(screen.getByRole("button",{name:"Reativar orientações"})).toBeTruthy();
  view.rerender(<ExerciseHarness initialCount={2} scope="session-b" history={history}/>);
  expect(screen.getByRole("button",{name:"Ver dica"})).toBeTruthy();
  cleanup();
 });
 it("defers and reopens in one tap, explains only on demand, ignores repeated equipment advice",()=>{
  const view=render(<HealthWorkoutContextualGuidance context="exercise-a" sessionContext="session-a" eligible unconfirmed/>);
  fireEvent.click(screen.getByRole("button",{name:"Ver dica"}));
  expect(screen.queryByText(/Origem:/)).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Por quê?"}));
  expect(screen.getByText(/Origem:/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Ver depois"}));
  fireEvent.click(screen.getByRole("button",{name:"Consultar dica"}));
  expect(screen.getByText(/Sem rótulo confirmado/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Ignorar"}));
  view.rerender(<HealthWorkoutContextualGuidance context="exercise-b" sessionContext="session-a" eligible unconfirmed/>);
  expect(screen.queryByTestId("cch-contextual-guidance")).toBeNull();
  view.rerender(<HealthWorkoutContextualGuidance context="exercise-b" sessionContext="session-a" eligible unconfirmed executionSignal="below_rir"/>);
  fireEvent.click(screen.getByRole("button",{name:"Ver dica"}));
  expect(screen.getByText(/não diagnostica fadiga/)).toBeTruthy();
  view.rerender(<HealthWorkoutContextualGuidance context="exercise-b" sessionContext="session-a" eligible={false} unconfirmed executionSignal="below_rir"/>);
  expect(screen.queryByTestId("cch-contextual-guidance")).toBeNull();
  view.rerender(<HealthWorkoutContextualGuidance context="exercise-b" sessionContext="session-a" eligible unconfirmed executionSignal="below_rir"/>);
  expect(screen.queryByText(/não diagnostica fadiga/)).toBeNull();
  expect(screen.getByRole("button",{name:"Ver dica"})).toBeTruthy();
  cleanup();
 });
});

describe("F24 R07 — ready state and explicit completion boundary",()=>{
 it("ready state starts only after a human action and ending requires confirmation",async()=>{
  const starts:string[]=[];let ended=0;
  render(<ExerciseHarness initialCount={0} ready onStart={id=>starts.push(id)} onEnd={()=>ended++}/>);
  expect(screen.getByTestId("cch-r07-exercise-state").textContent).toBe("PRONTO");
  expect(starts).toEqual([]);
  fireEvent.click(screen.getByRole("button",{name:"Iniciar série",exact:true}));
  await waitFor(()=>expect(starts).toEqual(["ex1"]));
  fireEvent.click(screen.getByRole("button",{name:"Encerrar treino",exact:true}));
  expect(ended).toBe(0);
  fireEvent.click(screen.getByRole("button",{name:"Cancelar encerramento"}));
  expect(ended).toBe(0);
  fireEvent.click(screen.getByRole("button",{name:"Encerrar treino",exact:true}));
  fireEvent.click(screen.getByRole("button",{name:"Confirmar encerramento"}));
  await waitFor(()=>expect(ended).toBe(1));
  cleanup();
 });
});

describe("SAU visual refinement — pause presentation",()=>{
 it("marks viewed position without claiming completed exercises and keeps explicit resume",()=>{
  render(<ExerciseHarness paused/>);
  expect(screen.getByText("Treino pausado")).toBeTruthy();
  expect(screen.getByLabelText("Posição 1 de 2").querySelectorAll('[data-position="current"]')).toHaveLength(1);
  fireEvent.click(screen.getByLabelText("Próximo exercício"));
  expect(screen.getByLabelText("Posição 2 de 2").querySelectorAll('[data-position="current"]')).toHaveLength(1);
  expect(screen.getAllByRole("button",{name:"Retomar treino"})).toHaveLength(2);
  cleanup();
 });
});

describe("SAU compact execution",()=>{
 it("keeps rest clock, editable result and next action available together",()=>{
  const {container}=render(<ExerciseHarness initialCount={1}/>);
  expect(container.querySelector('[data-sau-phase="rest"]')).toBeTruthy();
  expect(screen.getByTestId("cch-rest-clock")).toBeTruthy();
  expect(container.querySelector(".sau-result-fields")?.querySelectorAll("input")).toHaveLength(3);
  expect(screen.getByRole("button",{name:"Iniciar próxima série"})).toBeTruthy();
  expect(screen.getByText("Trocar exercício").closest("details")?.open).toBe(false);
  cleanup();
 });
 it("keeps pause and ready states distinct",()=>{
  const view=render(<ExerciseHarness paused/>);
  expect(view.container.querySelector('[data-sau-phase="paused"]')).toBeTruthy();
  view.rerender(<ExerciseHarness ready initialCount={0}/>);
  expect(view.container.querySelector('[data-sau-phase="ready"]')).toBeTruthy();
  expect(screen.getByRole("button",{name:"Iniciar série",exact:true})).toBeTruthy();
  cleanup();
 });
});
