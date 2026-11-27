import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,render,screen,fireEvent} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {HealthReportsPage} from "../src/modules/health/pages/HealthReportsPage";
import {HealthAnalyticsPage} from "../src/modules/health/pages/HealthAnalyticsPage";
const m=vi.hoisted(()=>({athlete:vi.fn(),review:vi.fn(),replan:vi.fn(),analytics:vi.fn(),reload:vi.fn(async()=>{})}));
vi.mock("../src/modules/health/hooks/useHealthAthlete",()=>({useHealthAthlete:m.athlete}));
vi.mock("../src/modules/health/hooks/useHealthLongitudinalReviewF13",()=>({useHealthLongitudinalReviewF13:m.review,longitudinalDomainLabel:(s:string)=>s,longitudinalOutcomeLabel:(s:string)=>s}));
vi.mock("../src/modules/health/hooks/useHealthReplanningF14",()=>({useHealthReplanningF14:m.replan,replanningCaseStatusLabel:(s:string)=>s,replanningDecisionLabel:(s:string)=>s}));
vi.mock("../src/modules/health/hooks/useHealthAnalyticsF17",()=>({useHealthAnalyticsF17:m.analytics}));
const run={id:"r1",asOfDate:"2026-11-27",windowDays:28,currentStartDate:"2026-10-31",currentEndDate:"2026-11-27",priorStartDate:"2026-10-03",priorEndDate:"2026-10-30",runStatus:"available",availableDomains:[],unavailableDomains:["training"],algorithmVersion:"fixture",evidence:{},historical:false};
const empty={data:[],error:null};
function setup(){
 m.athlete.mockReturnValue({athlete:{id:"a",display_name:"Fixture"},loading:false});
 m.review.mockReturnValue({run,outcome:{id:"o1",outcomeCode:"continue_observation",targetDomains:[]},loading:false,backendAvailable:true,error:null,reload:m.reload});
 m.replan.mockReturnValue({currentCase:null,items:[],loading:false,backendAvailable:true,error:null,reload:m.reload});
 m.analytics.mockReturnValue({training:empty,nutrition:empty,body:empty,recovery:empty,loading:false,coverage:{training:0,nutrition:0,body:0,recovery:0},reload:m.reload});
}
const show=(node:React.ReactNode)=>render(<MemoryRouter>{node}</MemoryRouter>);
afterEach(()=>{cleanup();vi.clearAllMocks()});
describe("SX10 report and analytics",()=>{
 it("preserves explicit print and export for confirmed sources",()=>{
  setup();show(<HealthReportsPage/>);
  expect(screen.getByText("Síntese do acompanhamento")).toBeTruthy();
  expect((screen.getByRole("button",{name:"Exportar JSON"}) as HTMLButtonElement).disabled).toBe(false);
  expect((screen.getByRole("button",{name:"Imprimir / PDF"}) as HTMLButtonElement).disabled).toBe(false);
 });
 it("blocks export when F14 read fails",()=>{
  setup();m.replan.mockReturnValue({currentCase:null,items:[],loading:false,backendAvailable:true,error:"fixture",reload:m.reload});show(<HealthReportsPage/>);
  expect((screen.getByRole("button",{name:"Exportar JSON"}) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/Impressão e exportação bloqueadas/)).toBeTruthy();
 });
 it("does not report absent review on a failed read",()=>{
  setup();m.review.mockReturnValue({run:null,outcome:null,loading:false,backendAvailable:true,error:"fixture",reload:m.reload});show(<HealthReportsPage/>);
  expect(screen.getByText(/Consulta da revisão não confirmada/)).toBeTruthy();
  expect(screen.queryByText(/Ainda não existe revisão longitudinal/)).toBeNull();
 });
 it("excludes a case linked to a superseded outcome",()=>{
  setup();m.replan.mockReturnValue({currentCase:{id:"c",sourceReviewRunId:"r1",sourceReviewOutcomeId:"old",caseStatus:"completed",sourceOutcomeCode:"review_training"},items:[{id:"i",domain:"training",itemStatus:"revise",decisionNotes:"stale fixture"}],loading:false,backendAvailable:true,error:null,reload:m.reload});show(<HealthReportsPage/>);
  expect(screen.queryByText("stale fixture")).toBeNull();
  expect(screen.getByText(/Não há caso F14 vinculado ao resultado humano atual/)).toBeTruthy();
 });
 it("distinguishes unknown coverage from observed zero and filters domains",()=>{
  setup();m.analytics.mockReturnValue({training:{data:[],error:"Consulta incompleta"},nutrition:empty,body:empty,recovery:empty,loading:false,coverage:{training:null,nutrition:0,body:0,recovery:0},reload:m.reload});show(<HealthAnalyticsPage/>);
  expect(screen.getByText("Não confirmado")).toBeTruthy();
  expect(screen.getAllByText("0 / 90")).toHaveLength(3);
  fireEvent.click(screen.getByRole("button",{name:"Alimentação",exact:true}));
  expect(screen.getByRole("button",{name:"Alimentação",exact:true}).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button",{name:"30 dias"}));
  expect(m.analytics).toHaveBeenLastCalledWith("a",30);
 });
});
