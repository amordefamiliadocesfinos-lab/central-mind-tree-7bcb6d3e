import {afterEach,describe,expect,it,vi} from "vitest";
import {act,cleanup,renderHook,waitFor} from "@testing-library/react";
import {useHealthRemindersF16} from "../src/modules/health/hooks/useHealthRemindersF16";
import {useHealthLongitudinalReviewF13} from "../src/modules/health/hooks/useHealthLongitudinalReviewF13";
import {useHealthReplanningF14} from "../src/modules/health/hooks/useHealthReplanningF14";
const m=vi.hoisted(()=>({from:vi.fn(),rpc:vi.fn()}));
vi.mock("@/integrations/supabase/client",()=>({supabase:m}));
type Reply={data:unknown,error:null|{message:string},count?:number};
const ok=(data:unknown,count?:number):Reply=>({data,error:null,count});
const fail=():Reply=>({data:null,error:{message:"fixture read failure"}});
function setup(read:(table:string,filters:Record<string,unknown>)=>Reply|Promise<Reply>){
 m.from.mockImplementation((table:string)=>{
  const filters:Record<string,unknown>={};
  const q={
   select:()=>q,eq:(key:string,value:unknown)=>{filters[key]=value;return q},
   gte:()=>q,order:()=>q,limit:()=>q,
   maybeSingle:()=>Promise.resolve(read(table,filters)),
   then:(resolve:(r:Reply)=>unknown,reject:(e:unknown)=>unknown)=>Promise.resolve(read(table,filters)).then(resolve,reject)
  };return q;
 });
}
const reminder={id:"rule-a",reminder_type:"training",label:"fixture",enabled:true,schedule_kind:"daily",days_of_week:[],local_time:"08:00:00",interval_days:null,start_on:"2026-11-01",timezone:"UTC",status:"active",created_at:"2026-11-01",updated_at:"2026-11-01"};
const run={id:"run-a",as_of_date:"2026-11-27",window_days:28,current_start_date:"2026-10-31",current_end_date:"2026-11-27",prior_start_date:"2026-10-03",prior_end_date:"2026-10-30",run_status:"available",available_domains:[],unavailable_domains:[],reason_codes:[],algorithm_version:"fixture",evidence_snapshot:{},created_at:"2026-11-27"};
const caseRow={id:"case-a",source_review_run_id:"run-a",source_review_outcome_id:"outcome-a",source_outcome_code:"review_training",source_target_domains:["training"],source_snapshot:{},case_status:"open",reason_codes:[],opened_at:"2026-11-27",record_status:"current"};
afterEach(()=>{cleanup();vi.resetAllMocks()});
describe("SX09 readback integrity",()=>{
 it("F13 does not confirm a different generated run",async()=>{
  setup((table,filters)=>table==="health_longitudinal_review_runs"?ok(run):ok(filters.record_status?null:[]));
  m.rpc.mockResolvedValue(ok("different-id"));
  const {result}=renderHook(()=>useHealthLongitudinalReviewF13("athlete-a"));
  await waitFor(()=>expect(result.current.run?.id).toBe("run-a"));
  await act(async()=>{await expect(result.current.generateReview()).rejects.toThrow("Gravação não confirmada")});
  expect(result.current.error).toContain("Gravação não confirmada");
  await act(async()=>{await expect(result.current.generateReview()).rejects.toThrow("Aguarde")});
  expect(m.rpc).toHaveBeenCalledTimes(1);
  await act(async()=>{await result.current.reload()});
  expect(result.current.error).toBeNull();
 });
 it("F14 rejects a close without persisted completed state",async()=>{
  setup((table,filters)=>table==="health_replanning_cases"?ok(filters.record_status?caseRow:[caseRow]):ok([]));
  m.rpc.mockResolvedValue(ok("case-a"));
  const {result}=renderHook(()=>useHealthReplanningF14("athlete-a"));
  await waitFor(()=>expect(result.current.currentCase?.id).toBe("case-a"));
  await act(async()=>{await expect(result.current.completeCase("case-a")).rejects.toThrow("Gravação não confirmada")});
  expect(result.current.currentCase?.caseStatus).toBe("open");
 });
 it("F16 rejects truncated reads",async()=>{
  setup(table=>table==="health_reminder_rules"?ok([reminder],2):ok([],0));
  const {result}=renderHook(()=>useHealthRemindersF16("athlete-a"));
  await waitFor(()=>expect(result.current.error).toContain("incompleta"));
  expect(result.current.rules).toEqual([]);
  expect(m.rpc).not.toHaveBeenCalled();
 });
 it("F16 verifies the returned event and rejects write after failed readback",async()=>{
  let failed=false;
  setup(table=>failed?fail():table==="health_reminder_rules"?ok([reminder],1):ok([],0));
  m.rpc.mockImplementation(async()=>{failed=true;return ok("event-a")});
  const {result}=renderHook(()=>useHealthRemindersF16("athlete-a"));
  await waitFor(()=>expect(result.current.rules).toHaveLength(1));
  await act(async()=>{await expect(result.current.recordEvent("rule-a","completed","2026-11-27")).rejects.toThrow("Gravação não confirmada")});
  expect(result.current.rules).toEqual([]);
  await act(async()=>{await expect(result.current.recordEvent("rule-a","completed","2026-11-27")).rejects.toThrow("Aguarde")});
  expect(m.rpc).toHaveBeenCalledTimes(1);
 });
 it("F16 discards late results from the previous athlete",async()=>{
  let resolveOld:(value:Reply)=>void=()=>{};
  const old=new Promise<Reply>(resolve=>{resolveOld=resolve});
  setup((table,filters)=>table==="health_reminder_rules"?(filters.athlete_id==="a"?old:ok([{...reminder,id:"rule-b"}],1)):ok([],0));
  const {result,rerender}=renderHook(({id})=>useHealthRemindersF16(id),{initialProps:{id:"a"}});
  rerender({id:"b"});
  await waitFor(()=>expect(result.current.rules[0]?.id).toBe("rule-b"));
  await act(async()=>{resolveOld(ok([reminder],1));await old});
  expect(result.current.rules[0]?.id).toBe("rule-b");
 });
});
