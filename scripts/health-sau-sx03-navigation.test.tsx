import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {MemoryRouter,Route,Routes,useLocation,useNavigate} from "react-router-dom";
import {HealthShell} from "../src/modules/health/ui/HealthShell";
import {HealthDashboardPage} from "../src/modules/health/pages/HealthDashboardPage";
import type {HealthDashboardF10} from "../src/modules/health/hooks/useHealthDashboardF10";
const mocks=vi.hoisted(()=>({athlete:vi.fn(),dashboard:vi.fn(),integrated:vi.fn(),journey:vi.fn(),evaluate:vi.fn(async()=>{}),reload:vi.fn(async()=>{})}));
vi.mock("../src/modules/health/hooks/useHealthAthlete",()=>({useHealthAthlete:mocks.athlete}));
vi.mock("../src/modules/health/hooks/useHealthDashboardF10",()=>({useHealthDashboardF10:mocks.dashboard}));
vi.mock("../src/modules/health/hooks/useHealthIntegratedDecisionF11",()=>({useHealthIntegratedDecisionF11:mocks.integrated,integratedDecisionCodeLabel:(x:string)=>x,integratedReasonLabel:(x:string)=>x}));
vi.mock("../src/modules/health/hooks/useHealthJourneyF12",()=>({useHealthJourneyF12:mocks.journey}));
const paths=["hoje","treino","alimentacao","evolucao","recuperacao","exames","perfil","treino/programa","treino/historico","treino/atividades","biblioteca","revisao","replanejamento","rotina","relatorios","analytics"].map(x=>"/saude/"+x);
function Current(){const l=useLocation();const go=useNavigate();return <><p data-testid="route">{l.pathname}</p><button onClick={()=>go(-1)}>Voltar fixture</button><div data-cch-focus="true">Sessão fixture</div></>;}
const nav=(initial="/saude/hoje")=>render(<MemoryRouter initialEntries={[initial]}><Routes><Route element={<HealthShell/>}><Route path="*" element={<Current/>}/></Route></Routes></MemoryRouter>);
const more=()=>screen.getByRole("button",{name:/Mais áreas do Saúde/});
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe("SX03 navigation",()=>{
 it("lists all sixteen destinations without horizontal menu dependency and supports direct links",()=>{
  nav();const menu=screen.getByRole("navigation",{name:"Navegação Saúde"});
  expect(within(menu).getAllByRole("link")).toHaveLength(4);
  fireEvent.click(more());
  expect(within(menu).getAllByRole("link").map(a=>a.getAttribute("href")).sort()).toEqual([...paths].sort());
  fireEvent.click(within(menu).getByRole("link",{name:"Biblioteca de exercícios"}));
  expect(screen.getByTestId("route").textContent).toBe("/saude/biblioteca");
  expect(more().getAttribute("aria-expanded")).toBe("false");
  expect(more().getAttribute("data-active")).toBe("true");
  fireEvent.click(screen.getByRole("button",{name:"Voltar fixture"}));
  expect(screen.getByTestId("route").textContent).toBe("/saude/hoje");
  expect(screen.getByRole("link",{name:"Hoje"}).getAttribute("aria-current")).toBe("page");
 });
 it("preserves parent selection, Escape return focus and focus-mode chrome markers",()=>{
  nav("/saude/treino/programa");
  expect(screen.getByRole("link",{name:"Treino",exact:true}).getAttribute("aria-current")).toBe("page");
  fireEvent.click(more());
  expect(screen.getByRole("link",{name:"Programa de treino"}).getAttribute("aria-current")).toBe("page");
  fireEvent.keyDown(screen.getByRole("link",{name:"Programa de treino"}),{key:"Escape"});
  expect(more().getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(more());
  expect(document.querySelector("[data-cch-health-shell] [data-cch-focus-chrome]")).toBeTruthy();
  expect(document.querySelector("[data-cch-health-main] [data-cch-focus=true]")).toBeTruthy();
 });
});
const meta:Pick<HealthDashboardF10["training"],"availability"|"freshness"|"asOf"|"error"|"confidence"|"coverage"|"reasonCodes">={availability:"unknown",freshness:"not_applicable",asOf:null,error:null,confidence:null,coverage:null,reasonCodes:[]};
function fixture(overrides:Partial<HealthDashboardF10>={}){
 return {training:{...meta,availability:"available" as const,activeSession:{id:"s",status:"paused",templateName:"Treino fixture",startedAt:"2026-11-27T12:00:00Z"},nextQueue:null},nutrition:{...meta,daily:null,rolling7:null,decision:null},body:{...meta,state:null},recovery:{...meta,state:null},exams:{...meta,latestReport:null,latestReportMarkerCount:null,longitudinalStateCount:0,latestLongitudinalAsOf:null,latestVital:null,pendingReviewCount:0},...overrides,issues:[],loading:false,readFailed:false,reload:mocks.reload};
}
function setup(d=fixture()){
 mocks.athlete.mockReturnValue({athlete:{id:"a",display_name:"Fixture"},loading:false});
 mocks.dashboard.mockReturnValue(d);
 mocks.integrated.mockReturnValue({backendAvailable:true,run:null,error:null,loading:false,evaluating:false,evaluationError:null,evaluate:mocks.evaluate,reload:mocks.reload});
 mocks.journey.mockReturnValue({stages:[],nextAction:null,loading:false,reload:mocks.reload});
}
const today=()=>render(<MemoryRouter><HealthDashboardPage/></MemoryRouter>);
describe("SX03 Today",()=>{
 it("puts active workout before other domains and never executes an action on render",()=>{
  setup();today();
  const train=screen.getByTestId("sau-sx03-training-priority"),domains=screen.getByTestId("sau-sx03-domains");
  expect(within(train).getByText("Pausado")).toBeTruthy();
  expect(within(train).getByRole("link",{name:"Continuar treino"}).getAttribute("href")).toBe("/saude/treino");
  expect(train.compareDocumentPosition(domains)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(domains).getByRole("link",{name:"Abrir diário alimentar"})).toBeTruthy();
  expect(within(domains).getAllByText("Sem observação confirmada nesta área.")).toHaveLength(4);
  expect(mocks.evaluate).not.toHaveBeenCalled();expect(mocks.reload).not.toHaveBeenCalled();
 });
 it("does not show a stale session or clinical reading as confirmed when a domain failed",()=>{
  const d=fixture();setup(fixture({training:{...d.training,availability:"error",error:"failure"} as HealthDashboardF10["training"]}));today();
  const train=screen.getByTestId("sau-sx03-training-priority");
  expect(within(train).getByRole("alert")).toBeTruthy();
  expect(within(train).queryByText("Treino fixture")).toBeNull();
  expect(within(train).queryByRole("link",{name:"Continuar treino"})).toBeNull();
  expect(within(train).getByRole("link",{name:"Abrir área de treino"})).toBeTruthy();
 });
 it("global read failure still permits independent domains; profile swap uses new scope",()=>{
  setup({...fixture(),readFailed:true});const view=today();
  expect(screen.getByRole("alert")).toBeTruthy();
  for(const name of ["Treino","Alimentação","Evolução","Recuperação","Exames"])expect(screen.getByRole("link",{name})).toBeTruthy();
  mocks.athlete.mockReturnValue({athlete:{id:"b",display_name:"Outro perfil"},loading:false});
  mocks.dashboard.mockReturnValue({...fixture(),loading:true});
  view.rerender(<MemoryRouter><HealthDashboardPage/></MemoryRouter>);
  expect(mocks.dashboard).toHaveBeenLastCalledWith("b");
  expect(screen.queryByText("Treino fixture")).toBeNull();
 });
 it("all operational issues are reachable and exam review not hidden behind count",()=>{
  const d=fixture();setup({...d,issues:[{id:"1",domain:"training",message:"Treino pendente",href:"/saude/treino"},{id:"2",domain:"nutrition",message:"Nutrição pendente",href:"/saude/alimentacao"},{id:"3",domain:"body",message:"Corpo pendente",href:"/saude/evolucao"},{id:"4",domain:"recovery",message:"Recuperação pendente",href:"/saude/recuperacao"},{id:"5",domain:"exams",message:"Documento aguarda revisão",href:"/saude/exames"}] as never});today();
  expect(screen.getByRole("link",{name:"Documento aguarda revisão"})).toBeTruthy();
  expect(screen.getByText("Ver mais 2 pendências")).toBeTruthy();
  expect(screen.getByText("Recuperação pendente").closest("details")).toBeTruthy();
 });
});
