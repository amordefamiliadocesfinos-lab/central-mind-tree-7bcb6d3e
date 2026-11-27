import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {HealthBodyPage,WeightComparison} from "../src/modules/health/pages/HealthBodyPage";
import type {BodyAssessment,BodyPhotoSet,BodyRollingState} from "../src/modules/health/hooks/useHealthBodyM8";
const mock=vi.hoisted(()=>({athlete:vi.fn(),body:vi.fn(),profile:vi.fn(),record:vi.fn(async()=>{}),upload:vi.fn(async()=>{}),voidRecord:vi.fn(async()=>{}),reload:vi.fn(async()=>{}),refresh:vi.fn(async()=>{})}));
vi.mock("../src/modules/health/hooks/useHealthAthlete",()=>({useHealthAthlete:mock.athlete}));
vi.mock("../src/modules/health/hooks/useHealthBodyM8",()=>({useHealthBodyM8:mock.body}));
vi.mock("../src/modules/health/hooks/useHealthProfileM1",()=>({useHealthProfileM1:mock.profile}));
const assessment=(id:string,day:string,value:number,context:string,method="scale",status:BodyAssessment["status"]="active",athlete="a"):BodyAssessment=>({id,athlete_id:athlete,observed_at:day+"T10:00:00Z",observed_on:day,data_source:"MEASURED",confidence:"high",conditions:{weighing_context:context},notes:null,status,supersedes_assessment_id:null,void_reason:null,created_at:day+"T10:00:00Z",measurements:[{id:"m"+id,assessment_id:id,athlete_id:athlete,metric_code:"weight_kg",value,unit_code:"kg",method,confidence:"high",notes:null,created_at:day+"T10:00:00Z"}]});
const photo=(id:string,day:string,protocol="BODY_PHOTO_V1"):BodyPhotoSet=>({id,athlete_id:"a",captured_at:day+"T12:00:00Z",captured_on:day,protocol_version:protocol,conditions:null,notes:null,status:"active",photos:[{id:"p"+id,photo_set_id:id,athlete_id:"a",angle_code:"front_relaxed",capture_order:1,object_path:"a/progress/"+id+"/file.jpg",mime_type:"image/jpeg",signed_url:"/synthetic-"+id+".jpg"}]});
const rolling=(days:7|14|28):BodyRollingState=>({id:"r"+days,athlete_id:"a",as_of_date:"2026-11-27",window_days:days,weight_observation_count:2,weight_first_kg:80,weight_latest_kg:81,weight_change_kg:1,weight_trend_kg_per_week:0.5,waist_observation_count:0,waist_first_cm:null,waist_latest_cm:null,waist_change_cm:null,body_fat_observation_count:0,body_fat_first_pct:null,body_fat_latest_pct:null,body_fat_change_pct:null,photo_set_count:0,latest_bmi:null,coverage_status:"partial",confidence:"moderate",reason_codes:["PARTIAL_WEIGHT_COVERAGE"],computed_at:"2026-11-27T12:00:00Z"});
const data=()=>({assessments:[assessment("a1","2026-11-26",81,"morning_fasted")],states:[rolling(7),rolling(14),rolling(28)],photoSets:[photo("p1","2026-11-26"),photo("p2","2026-11-20"),photo("p3","2026-11-19","other")],loading:false,saving:false,error:null,reload:mock.reload,refreshStates:mock.refresh,recordAssessment:mock.record,voidAssessment:mock.voidRecord,uploadPhotoSet:mock.upload});
const consent=(decision:string)=>({loading:false,error:null,latestConsents:{private_media_storage:{athlete_id:"a",decision}},reload:mock.reload});
function setup(){mock.athlete.mockReturnValue({athlete:{id:"a"},loading:false});mock.body.mockReturnValue(data());mock.profile.mockReturnValue(consent("granted"));}
const page=()=> <MemoryRouter><HealthBodyPage/></MemoryRouter>;
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe("SX04 body UX",()=>{
 it("opens overview first, selects window without mutation and does not load private URLs",()=>{
  setup();render(page());
  expect(screen.getByTestId("sx04-overview").compareDocumentPosition(screen.getByTestId("sx04-registration"))&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByLabelText("Peso (kg)")).toBeNull();
  expect(mock.body).toHaveBeenLastCalledWith("a",false);
  fireEvent.click(screen.getByRole("button",{name:"14 dias"}));
  expect(screen.getByText("14 dias · 2026-11-27")).toBeTruthy();
  expect(mock.refresh).not.toHaveBeenCalled();expect(mock.record).not.toHaveBeenCalled();
 });
 it("requires valid fields, method and condition; registers only explicit values",async()=>{
  setup();render(page());
  fireEvent.click(screen.getByRole("button",{name:"Registrar peso e medidas"}));
  fireEvent.change(screen.getByLabelText("Peso (kg)"),{target:{value:"81,5"}});
  const save=screen.getByRole("button",{name:"Registrar medidas"});
  expect((save as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Método do peso"),{target:{value:"scale"}});
  fireEvent.change(screen.getByLabelText("Condição da pesagem"),{target:{value:"morning_fasted"}});
  fireEvent.change(screen.getByLabelText("Cintura (cm)"),{target:{value:"abc"}});
  expect((save as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Cintura (cm)"),{target:{value:""}});
  fireEvent.click(save);fireEvent.click(save);
  await waitFor(()=>expect(mock.record).toHaveBeenCalledTimes(1));
  expect(mock.record).toHaveBeenCalledWith({measurements:[{metric_code:"weight_kg",value:81.5,unit_code:"kg",method:"scale",confidence:"high"}],conditions:{weighing_context:"morning_fasted"},notes:null});
 });
 it("compares only active same-method and explicit-condition historical weights",()=>{
  const current=assessment("1","2026-11-26",81,"morning_fasted"),prior=assessment("2","2026-11-23",80,"morning_fasted");
  const view=render(<WeightComparison athleteId="a" assessments={[current,assessment("3","2026-11-25",79,"morning_unfasted"),assessment("4","2026-11-24",77,"morning_fasted","scale","voided"),prior,assessment("5","2026-11-25",100,"morning_fasted","scale","active","b")]}/>);
  expect(screen.getByText(/Referência de 2026-11-23/)).toBeTruthy();
  expect(screen.getByText(/diferença \+1,00 kg/)).toBeTruthy();
  view.rerender(<WeightComparison athleteId="a" assessments={[current,assessment("6","2026-11-25",80,"morning_fasted","bioimpedance")]}/>);
  expect(screen.getByText(/Sem referência comparável/)).toBeTruthy();
 });
 it("requires consent and explicit photo view, pairs only equal protocol and angle",()=>{
  setup();const view=render(page());
  expect(screen.queryByRole("img")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Ver fotos privadas"}));
  expect(mock.body).toHaveBeenLastCalledWith("a",true);
  fireEvent.change(screen.getByLabelText("Primeiro registro"),{target:{value:"p1"}});
  fireEvent.change(screen.getByLabelText("Segundo registro"),{target:{value:"p3"}});
  expect(screen.getByText(/Protocolos diferentes/)).toBeTruthy();expect(screen.queryByRole("img")).toBeNull();
  fireEvent.change(screen.getByLabelText("Segundo registro"),{target:{value:"p2"}});
  expect(screen.getAllByRole("img",{name:"Frente relaxado"})).toHaveLength(2);
  mock.profile.mockReturnValue(consent("revoked"));view.rerender(page());
  expect(screen.queryByRole("img")).toBeNull();expect(mock.body).toHaveBeenLastCalledWith("a",false);
  expect(screen.queryByRole("button",{name:"Novo protocolo"})).toBeNull();
 });
 it("preserves void boundary and confirms action explicitly",async()=>{
  setup();render(page());
  fireEvent.click(within(screen.getByTestId("sx04-history")).getByText("2026-11-26 · Ativa"));
  fireEvent.click(screen.getByRole("button",{name:"Anular avaliação"}));
  expect(mock.voidRecord).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Cancelar"}));
  expect(mock.voidRecord).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Anular avaliação"}));
  fireEvent.click(screen.getByRole("button",{name:"Confirmar anulação"}));
  await waitFor(()=>expect(mock.voidRecord).toHaveBeenCalledWith("a1"));
 });
 it("does not display stale overview on read error",()=>{
  setup();mock.body.mockReturnValue({...data(),error:"Falha"});render(page());
  expect(screen.getByText("Estado corporal indisponível.")).toBeTruthy();
  expect(screen.queryByTestId("sx04-weight-comparison")).toBeNull();
  expect(screen.queryByRole("img")).toBeNull();
 });
});
