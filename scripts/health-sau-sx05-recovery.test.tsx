import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import {HealthRecoveryPage,localDay,validateSleep} from "../src/modules/health/pages/HealthRecoveryPage";
const mock=vi.hoisted(()=>({athlete:vi.fn(),recovery:vi.fn(),record:vi.fn(async()=>{}),checkin:vi.fn(async()=>{}),voidSleep:vi.fn(async()=>{}),voidMetric:vi.fn(async()=>{}),refresh:vi.fn(async()=>{}),reload:vi.fn(async()=>{})}));
vi.mock("../src/modules/health/hooks/useHealthAthlete",()=>({useHealthAthlete:mock.athlete}));
vi.mock("../src/modules/health/hooks/useHealthRecoveryM9",()=>({useHealthRecoveryM9:mock.recovery}));
const sleep={id:"s1",athlete_id:"a",sleep_date:"2026-11-20",period_type:"nocturnal",declared_sleep_minutes:null,calculated_time_in_bed_minutes:480,calculated_sleep_minutes:null,data_source:"USER_REPORTED",confidence:"moderate",status:"active",created_at:"2026-11-20T12:00:00Z"};
const checkin={id:"c1",athlete_id:"a",checkin_event_id:"e1",observed_on:"2026-11-20",metric_code:"sleep_quality",value_ordinal:3,scale_version:"M9_RECOVERY_ORDINAL_V1",data_source:"USER_REPORTED",confidence:"moderate",status:"active",created_at:"2026-11-20T12:00:00Z"};
const rolling=(days:number)=>({id:"r"+days,athlete_id:"a",window_days:days,as_of_date:"2026-11-20",window_start_date:"2026-11-14",computed_at:"2026-11-20T15:00:00Z",confidence:"low",average_sleep_minutes:null,sleep_duration_observed_days:0,sleep_duration_coverage:"unobserved",sleep_quality_coverage:"sparse",sleep_quality_observed_days:1,recovery_coverage:"unobserved",recovery_observed_days:0,fatigue_coverage:"unobserved",fatigue_observed_days:0,readiness_coverage:"unobserved",readiness_observed_days:0,sleep_timing_coverage:"sparse",sleep_timing_observed_days:1,reason_codes:["TIME_IN_BED_ONLY"],algorithm_version:"M9"});
const data=()=>({sleepPeriods:[sleep],checkins:[checkin,{...checkin,id:"c2",metric_code:"general_fatigue",value_ordinal:4}],states:[rolling(7),rolling(14)],deviceObservations:[{id:"d1",athlete_id:"a",status:"active",observed_on:"2026-11-20",metric_code:"sleep_duration_minutes_estimated",numeric_value:420,unit_code:"min",provider:"Fixture",confidence:"moderate"}],deviceError:null,loading:false,saving:false,error:null,recordSleepPeriod:mock.record,recordRecoveryCheckin:mock.checkin,voidSleepPeriod:mock.voidSleep,voidRecoveryCheckin:mock.voidMetric,refreshStates:mock.refresh,reload:mock.reload});
function setup(){mock.athlete.mockReturnValue({athlete:{id:"a"},loading:false});mock.recovery.mockReturnValue(data());}
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe("SX05 recovery",()=>{
 it("shows unknown sleep separately from bed time, and window selection does not mutate",()=>{
  setup();render(<HealthRecoveryPage/>);
  const card=within(screen.getByTestId("sx05-overview"));
  expect(card.getByText(/Tempo na cama: 8h00/)).toBeTruthy();
  expect(card.getAllByText("—").length).toBeGreaterThan(0);
  expect(screen.queryByLabelText("Duração declarada (horas)")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"14 dias"}));
  expect(screen.getByRole("button",{name:"14 dias"}).getAttribute("aria-pressed")).toBe("true");
  expect(mock.refresh).not.toHaveBeenCalled();expect(mock.record).not.toHaveBeenCalled();
 });
 it("requires evidence, uses local day, accepts explicit zero and leaves missing fields null",async()=>{
  setup();render(<HealthRecoveryPage/>);
  fireEvent.click(screen.getByRole("button",{name:"Registrar sono"}));
  expect((screen.getByLabelText("Data de referência do período") as HTMLInputElement).value).toBe(localDay());
  const save=screen.getByRole("button",{name:"Salvar sono"});
  expect((save as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Duração declarada (horas)"),{target:{value:"0"}});
  fireEvent.click(save);fireEvent.click(save);
  await waitFor(()=>expect(mock.record).toHaveBeenCalledTimes(1));
  expect(mock.record).toHaveBeenCalledWith(expect.objectContaining({declaredSleepMinutes:0,bedAt:null,sleepStartAt:null,finalWakeAt:null,awakeningsCount:null,awakeMinutes:null}));
 });
 it("does not assume midnight; validates explicit chronology and missing duration",()=>{
  const form={sleepDate:"2000-01-01",periodType:"nocturnal" as const,hours:"",bed:"2000-01-01T23:00",start:"",wake:"2000-01-02T07:00",out:"",awakenings:"",awake:"",notes:""};
  expect(validateSleep(form)).toBeNull();
  expect(validateSleep({...form,wake:"2000-01-01T07:00"})).toMatch(/ordem/);
  expect(validateSleep({...form,hours:"abc"})).toBeTruthy();
 });
 it("saves only selected perceptions and permits removing selection",async()=>{
  setup();render(<HealthRecoveryPage/>);
  fireEvent.click(screen.getByRole("button",{name:"Check-in",exact:true}));
  fireEvent.click(screen.getByRole("button",{name:"Qualidade do sono: 3"}));
  fireEvent.click(screen.getByRole("button",{name:"Fadiga geral: 4"}));
  fireEvent.click(screen.getByRole("button",{name:"Não informar fadiga geral"}));
  fireEvent.click(screen.getByRole("button",{name:"Salvar check-in"}));
  await waitFor(()=>expect(mock.checkin).toHaveBeenCalledTimes(1));
  expect(mock.checkin).toHaveBeenCalledWith([{metric_code:"sleep_quality",value_ordinal:3}],expect.any(Date),"");
 });
 it("corrects only a selected metric, with confirmation",async()=>{
  setup();render(<HealthRecoveryPage/>);
  fireEvent.click(screen.getByText("Check-in de recuperação · 2026-11-20"));
  fireEvent.click(screen.getByRole("button",{name:"Anular apenas fadiga geral"}));
  expect(mock.voidMetric).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Confirmar anulação"}));
  await waitFor(()=>expect(mock.voidMetric).toHaveBeenCalledWith("c2"));
 });
 it("separates device estimates and hides stale facts on failed main read",()=>{
  setup();const view=render(<HealthRecoveryPage/>);
  expect(screen.getByText("Duração de sono estimada: 420 min")).toBeTruthy();
  mock.recovery.mockReturnValue({...data(),error:"Falha"});view.rerender(<HealthRecoveryPage/>);
  expect(screen.queryByText(/Tempo na cama: 8h00/)).toBeNull();
  expect(screen.queryByText("Duração de sono estimada: 420 min")).toBeNull();
 });
});
