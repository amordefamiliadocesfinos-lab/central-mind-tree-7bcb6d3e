import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {HealthLongitudinalReviewPage} from "../src/modules/health/pages/HealthLongitudinalReviewPage";
import {HealthReplanningPage} from "../src/modules/health/pages/HealthReplanningPage";
import {HealthRoutinePage} from "../src/modules/health/pages/HealthRoutinePage";
const m=vi.hoisted(()=>({athlete:vi.fn(),review:vi.fn(),replanning:vi.fn(),routine:vi.fn(),write:vi.fn(async()=>{}),reload:vi.fn(async()=>{})}));
vi.mock("../src/modules/health/hooks/useHealthAthlete",()=>({useHealthAthlete:m.athlete}));
vi.mock("../src/modules/health/hooks/useHealthLongitudinalReviewF13",()=>({useHealthLongitudinalReviewF13:m.review,longitudinalDomainLabel:(s:string)=>s,longitudinalOutcomeLabel:(s:string)=>s}));
vi.mock("../src/modules/health/hooks/useHealthReplanningF14",()=>({useHealthReplanningF14:m.replanning,replanningCaseStatusLabel:(s:string)=>s,replanningDecisionLabel:(s:string)=>s}));
vi.mock("../src/modules/health/hooks/useHealthRemindersF16",()=>({useHealthRemindersF16:m.routine,reminderScheduleLabel:()=>"",reminderTypeLabel:(s:string)=>s}));
const run={id:"run-a",asOfDate:"2026-11-27",windowDays:28,currentStartDate:"2026-10-31",currentEndDate:"2026-11-27",priorStartDate:"2026-10-03",priorEndDate:"2026-10-30",runStatus:"available",availableDomains:[],unavailableDomains:[],reasonCodes:[],algorithmVersion:"fixture-v1",evidence:{},historical:false};
function setup(){
 m.athlete.mockReturnValue({athlete:{id:"a"},loading:false});
 m.review.mockReturnValue({run,outcome:null,history:[],loading:false,backendAvailable:true,error:null,generating:false,savingOutcome:false,reload:m.reload,recordOutcome:m.write,generateReview:m.write});
 m.replanning.mockReturnValue({currentCase:{id:"case-a",caseStatus:"completed",sourceOutcomeCode:"review_training",openedAt:"2026-11-27",sourceReviewOutcomeId:"o"},items:[{id:"item-a",domain:"training",itemStatus:"keep_current",decisionNotes:"fixture",decidedAt:"2026-11-27"}],history:[],loading:false,saving:false,error:null,backendAvailable:true,reload:m.reload,recordDecision:m.write,completeCase:m.write,voidCase:m.write,openCase:m.write});
 m.routine.mockReturnValue({rules:[],events:[],loading:false,saving:false,error:null,backendAvailable:true,reload:m.reload,saveRule:m.write,archiveRule:m.write,recordEvent:m.write});
}
const wrap=(node:React.ReactNode)=><MemoryRouter>{node}</MemoryRouter>;
afterEach(()=>{cleanup();vi.clearAllMocks()});
describe("SX09 explicit human decisions",()=>{
 it("requires a deliberate review outcome",()=>{
  setup();render(wrap(<HealthLongitudinalReviewPage/>));
  const button=screen.getByRole("button",{name:"Registrar resultado"}) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Registrar resultado humano"),{target:{value:"continue_observation"}});
  expect(button.disabled).toBe(false);
  expect(m.write).not.toHaveBeenCalled();
 });
 it("displays source and window",()=>{
  setup();render(wrap(<HealthLongitudinalReviewPage/>));
  expect(screen.getByText(/snapshot F13 · fixture-v1/)).toBeTruthy();
  expect(screen.getByText("Período atual · 28 dias")).toBeTruthy();
 });
 it("keeps completed case decisions read only",()=>{
  setup();render(wrap(<HealthReplanningPage/>));
  expect((screen.getByLabelText("Decisão humana") as HTMLSelectElement).disabled).toBe(true);
  expect((screen.getByRole("button",{name:"Registrar decisão"}) as HTMLButtonElement).disabled).toBe(true);
  expect(m.write).not.toHaveBeenCalled();
 });
 it("does not create reminders by navigation and discards drafts on athlete change",()=>{
  setup();const view=render(wrap(<HealthRoutinePage/>));
  expect(screen.queryByRole("button",{name:"Criar lembrete"})).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Configurar lembrete opcional"}));
  fireEvent.change(screen.getByLabelText("Nome opcional"),{target:{value:"rascunho privado"}});
  m.athlete.mockReturnValue({athlete:{id:"b"},loading:false});
  view.rerender(wrap(<HealthRoutinePage/>));
  expect(screen.queryByLabelText("Nome opcional")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Configurar lembrete opcional"}));
  expect((screen.getByLabelText("Nome opcional") as HTMLInputElement).value).toBe("");
  expect(m.write).not.toHaveBeenCalled();
 });
 it("does not imply an empty routine after a read failure",()=>{
  setup();m.routine.mockReturnValue({rules:[],events:[],loading:false,saving:false,error:"fixture error",backendAvailable:true,reload:m.reload});
  render(wrap(<HealthRoutinePage/>));
  expect(screen.getByText("Rotina não confirmada. Atualize para consultar.")).toBeTruthy();
  expect(screen.queryByText("Nenhum lembrete ativo está programado para hoje.")).toBeNull();
 });
});
