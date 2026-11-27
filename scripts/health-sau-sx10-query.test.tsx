import {afterEach,describe,expect,it,vi} from "vitest";
import {act,cleanup,renderHook,waitFor} from "@testing-library/react";
import {useHealthAnalyticsF17} from "../src/modules/health/hooks/useHealthAnalyticsF17";
const m=vi.hoisted(()=>({from:vi.fn(),rpc:vi.fn()}));
vi.mock("@/integrations/supabase/client",()=>({supabase:m}));
type Reply={data:unknown[],error:null|{message:string},count:number};
const ok=(data:unknown[]=[],count=data.length):Reply=>({data,error:null,count});
const filtersSeen:Array<{table:string,filters:Record<string,unknown>}>= [];
function setup(read:(table:string,filters:Record<string,unknown>)=>Reply|Promise<Reply>){
 m.from.mockImplementation((table:string)=>{
  const filters:Record<string,unknown>={};
  const q={select:()=>q,eq:(k:string,v:unknown)=>{filters[k]=v;return q},gte:(k:string,v:unknown)=>{filters["gte:"+k]=v;return q},lte:(k:string,v:unknown)=>{filters["lte:"+k]=v;return q},lt:(k:string,v:unknown)=>{filters["lt:"+k]=v;return q},in:(k:string,v:unknown)=>{filters["in:"+k]=v;return q},order:()=>q,limit:()=>q,then:(resolve:(r:Reply)=>unknown,reject:(e:unknown)=>unknown)=>{filtersSeen.push({table,filters:{...filters}});return Promise.resolve(read(table,filters)).then(resolve,reject)}};
  return q;
 });
}
const day={id:"d",log_date:"2026-11-20",completeness_status:"partial"};
afterEach(()=>{cleanup();vi.resetAllMocks();filtersSeen.length=0});
describe("SX10 analytics source integrity",()=>{
 it("reads nutrition by meal linkage rather than insertion date",async()=>{
  setup(table=>table==="health_food_log_days"?ok([day]):table==="health_meal_logs"?ok([{id:"meal",food_log_day_id:"d"}]):table==="health_meal_items"?ok([{meal_log_id:"meal",energy_kcal_snapshot:150,protein_g_snapshot:12}]):ok());
  const {result}=renderHook(()=>useHealthAnalyticsF17("a",30));
  await waitFor(()=>expect(result.current.loading).toBe(false));
  expect(result.current.nutrition.data[0]).toMatchObject({energyKcal:150,proteinG:12,completenessStatus:"partial"});
  const query=filtersSeen.find(x=>x.table==="health_meal_items")!;
  expect(query.filters["in:meal_log_id"]).toEqual(["meal"]);
  expect(query.filters["gte:created_at"]).toBeUndefined();
  expect(m.rpc).not.toHaveBeenCalled();
 });
 it("does not convert truncated data into coverage zero",async()=>{
  setup(table=>table==="health_workout_sessions"?ok([],3):ok());
  const {result}=renderHook(()=>useHealthAnalyticsF17("a",30));
  await waitFor(()=>expect(result.current.loading).toBe(false));
  expect(result.current.training.error).toContain("incompleta");
  expect(result.current.coverage.training).toBeNull();
  expect(result.current.coverage.nutrition).toBe(0);
 });
 it("keeps missing nutrition snapshots absent",async()=>{
  setup(table=>table==="health_food_log_days"?ok([day]):table==="health_meal_logs"?ok([{id:"meal",food_log_day_id:"d"}]):table==="health_meal_items"?ok([{meal_log_id:"meal",energy_kcal_snapshot:0,protein_g_snapshot:null}]):ok());
  const {result}=renderHook(()=>useHealthAnalyticsF17("a",30));
  await waitFor(()=>expect(result.current.loading).toBe(false));
  expect(result.current.nutrition.data[0]).toMatchObject({energyKcal:0,proteinG:null});
 });
 it("discards a late athlete response",async()=>{
  let release:(r:Reply)=>void=()=>{};
  const old=new Promise<Reply>(resolve=>{release=resolve});
  setup((table,f)=>table==="health_food_log_days"&&f.athlete_id==="a"?old:ok());
  const {result,rerender}=renderHook(({id})=>useHealthAnalyticsF17(id,30),{initialProps:{id:"a"}});
  rerender({id:"b"});
  await waitFor(()=>expect(result.current.loading).toBe(false));
  await act(async()=>{release(ok([day]));await old});
  expect(result.current.nutrition.data).toEqual([]);
  expect(result.current.coverage.nutrition).toBe(0);
 });
 it("recovers from a rejected transport without inventing zero",async()=>{
  setup(()=>Promise.reject(new Error("fixture transport")));
  const {result}=renderHook(()=>useHealthAnalyticsF17("a",30));
  await waitFor(()=>expect(result.current.loading).toBe(false));
  expect(result.current.coverage.training).toBeNull();
  expect(result.current.training.error).toContain("não confirmada");
 });
});
