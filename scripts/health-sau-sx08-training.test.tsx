import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,within,waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {HealthActivitiesPage} from "../src/modules/health/pages/HealthActivitiesPage";
import {HealthTrainingHistoryPage} from "../src/modules/health/pages/HealthTrainingHistoryPage";
import {HealthLibraryPage} from "../src/modules/health/pages/HealthLibraryPage";
const m=vi.hoisted(()=>({athlete:vi.fn(),activities:vi.fn(),history:vi.fn(),catalog:vi.fn(),resume:vi.fn(async()=>{}),start:vi.fn(async()=>{}),reload:vi.fn(async()=>{}),voidSession:vi.fn(async()=>{}),toast:vi.fn()}));
vi.mock("@/hooks/use-toast",()=>({useToast:()=>({toast:m.toast})}));
vi.mock("../src/modules/health/hooks/useHealthAthlete",()=>({useHealthAthlete:m.athlete}));
vi.mock("../src/modules/health/hooks/useHealthActivitiesF20",()=>({useHealthActivitiesF20:m.activities}));
vi.mock("../src/modules/health/hooks/useHealthTrainingHistoryF21",()=>({useHealthTrainingHistoryF21:m.history}));
vi.mock("../src/modules/health/hooks/useHealthCatalogs",()=>({useHealthCatalogs:m.catalog}));
const active={id:"a1",athlete_id:"athlete-a",modality_code:"running",title:"Corrida fixture",status:"paused",started_at:"2026-11-20T10:00:00Z",paused_at:"2026-11-20T10:10:00Z",pause_accumulated_seconds:0};
const activities=(overrides={})=>({activeActivity:active,activitiesToday:[],strengthToday:[],segmentsByActivity:new Map(),modalities:[{code:"running",name:"Corrida"}],openStrengthSessionId:null,available:true,loading:false,saving:false,error:null,resumeActivity:m.resume,startActivity:m.start,reload:m.reload,...overrides});
const strength={id:"s1",kind:"strength",status:"completed",started_at:"2026-11-20T10:00:00Z",ended_at:"2026-11-20T10:30:00Z",template_code:"A1",template_name:"Peito fixture",notes:null,exercises:[]};
const aerobic={id:"a2",kind:"activity",status:"completed",started_at:"2026-11-21T10:00:00Z",ended_at:"2026-11-21T10:30:00Z",title:"Corrida histórica",modality_name:"Corrida",modality_code:"running",active_duration_seconds:1801,distance_meters:null};
const history=()=>({sessions:[strength,aerobic],modalities:[{code:"running",name:"Corrida"}],strengthCount:1,activityCount:1,loading:false,saving:false,available:true,error:null,reload:m.reload,voidWorkoutSession:m.voidSession});
const exercise=(id:string,name:string)=>({id,name,code:id,movement_pattern:"horizontal_press",muscles:[{muscle_group_id:"m",role:"primary",muscle:{id:"m",name:"Peitoral"}}],equipment:[{equipment_id:"e",equipmentItem:{id:"e",name:"Barra"}}],equivalences:[]});
function setup(){m.athlete.mockReturnValue({athlete:{id:"athlete-a"},loading:false});m.activities.mockReturnValue(activities());m.history.mockReturnValue(history());m.catalog.mockReturnValue({exercises:[exercise("cbbf1aa6-b906-46e8-84ce-b13f67aa4f0a","Supino fixture"),exercise("unknown","Supino sem referência")],muscles:[{id:"m",name:"Peitoral"}],equipment:[{id:"e",name:"Barra"}],foods:[],foodSources:[],counts:{exercises:2,muscles:1,equipment:1,foods:0,foodSources:0},loading:false,error:null,reload:m.reload});}
const show=(node:React.ReactNode)=>render(<MemoryRouter>{node}</MemoryRouter>);
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe("SX08 complementary training",()=>{
 it("shows paused timer before secondary actions without starting anything",async()=>{
  setup();show(<HealthActivitiesPage/>);
  expect(screen.getByTestId("sx08-active-clock").textContent).toContain("10:00");
  expect(m.resume).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Retomar"}));
  await waitFor(()=>expect(m.resume).toHaveBeenCalledWith("a1"));
 });
 it("does not presume modality for a new activity",()=>{
  setup();m.activities.mockReturnValue(activities({activeActivity:null}));show(<HealthActivitiesPage/>);
  expect((screen.getByRole("button",{name:"Iniciar cronômetro"}) as HTMLButtonElement).disabled).toBe(true);
  expect(m.start).not.toHaveBeenCalled();
 });
 it("filters by session kind and preserves history records",()=>{
  setup();show(<HealthTrainingHistoryPage/>);
  fireEvent.click(screen.getByRole("button",{name:"Atividades",exact:true}));
  expect(screen.getByText("1 registros no filtro")).toBeTruthy();
  expect(screen.getByText(/Peito fixture/).closest("[hidden]")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Buscar sessão ou exercício"),{target:{value:"inexistente"}});
  expect(screen.getByText("Nenhum registro corresponde aos filtros.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Limpar filtros"}));
  expect(screen.getByText("2 registros no filtro")).toBeTruthy();
  expect(m.voidSession).not.toHaveBeenCalled();
 });
 it("rejects stale history when consultation failed",()=>{
  setup();m.history.mockReturnValue({...history(),error:"Falha",available:false});show(<HealthTrainingHistoryPage/>);
  expect(screen.getByText("Histórico não confirmado. Atualize para consultar.")).toBeTruthy();
  expect(screen.queryByText(/Peito fixture/)).toBeNull();
 });
 it("uses exact exercise identity for provisional sample, never the name",()=>{
  setup();show(<HealthLibraryPage/>);
  expect(screen.queryByTestId("cch-movement-sample")).toBeNull();
  const first=screen.getByText("Supino fixture").closest("[class*='rounded']")!;
  const buttons=screen.getAllByRole("button",{name:"Ver movimento"});
  expect(buttons).toHaveLength(2);expect(first).toBeTruthy();
  fireEvent.click(buttons[1]);expect(screen.queryByTestId("cch-movement-sample")).toBeNull();
  fireEvent.click(buttons[0]);expect(screen.getByTestId("cch-movement-sample")).toBeTruthy();
  expect(screen.getByRole("button",{name:"Reproduzir amostra (5 s)"})).toBeTruthy();
 });
 it("retains exercise search when switching to foods and back",()=>{
  setup();show(<HealthLibraryPage/>);
  fireEvent.change(screen.getByLabelText("Buscar no catálogo de treino"),{target:{value:"fixture"}});
  fireEvent.click(screen.getByRole("button",{name:"Nutrição"}));
  fireEvent.click(screen.getByRole("button",{name:"Treino",exact:true}));
  expect((screen.getByLabelText("Buscar no catálogo de treino") as HTMLInputElement).value).toBe("fixture");
  expect(screen.queryByText("Supino sem referência")).toBeNull();
 });
});
