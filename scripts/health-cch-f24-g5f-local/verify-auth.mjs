import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import {spawnSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";

const API = process.env.API_URL;
const ANON = process.env.ANON_KEY;
const SERVICE = process.env.SERVICE_ROLE_KEY;
const DB = process.env.DB_URL;
if(!API || !ANON || !SERVICE || !DB) throw Error("local CLI keys/DSN missing");
const address = new URL(API);
if(!["localhost","127.0.0.1"].includes(address.hostname)) throw Error("non-local API blocked");
const db = new URL(DB);
if(!["localhost","127.0.0.1"].includes(db.hostname)) throw Error("non-local DB blocked");
if(process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_URL ||
   process.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_PUBLISHABLE_KEY)
 throw Error("hosted Supabase env variables detected");
const suffix = process.env.GITHUB_RUN_ID || "local";
const ATH_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ATH_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SESSION_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SESSION_B = "cccccccc-cccc-4ccc-8ccc-cccccccccccb";
const EX_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const EX_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const OTHER = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const REST3 = "20000000-0000-4000-8000-000000000003";
const uniq = () => crypto.randomUUID();
const admin = createClient(API,SERVICE,{auth:{autoRefreshToken:false,persistSession:false}});
const publicClient=()=>createClient(API,ANON,{auth:{autoRefreshToken:false,persistSession:false}});
const pgsql=(sql)=>{
 const proc=spawnSync("psql",[DB,"-X","-v","ON_ERROR_STOP=1","-q"],{input:sql,encoding:"utf8",stdio:["pipe","pipe","pipe"]});
 if(proc.status!==0) throw Error("local PostgreSQL fixture failed: "+proc.stderr.replace(/(password|token|secret)\S*/ig,"[redacted]").slice(0,700));
};
const createUser=async(name)=>{
 const email="cch-g5f-"+name+"-"+suffix+"@example.invalid";
 const password=crypto.randomBytes(24).toString("base64url");
 const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});
 if(error || !data?.user?.id) throw Error("local Auth create user failed: "+(error?.message||"missing id"));
 const client=publicClient();
 const sign=await client.auth.signInWithPassword({email,password});
 if(sign.error || !sign.data.user) throw Error("local Auth password sign-in failed: "+sign.error?.message);
 const check=await client.auth.getUser();
 assert.equal(check.data.user?.id,data.user.id);
 assert.ok(sign.data.session?.access_token?.length>40);
 return {userId:data.user.id,client,email,password};
};
const rpc=async(client,name,args)=>{
 const {data,error}=await client.rpc(name,args);
 if(error) throw Error(name+": "+error.message);
 return data;
};
const expectRejected=async(client,name,args)=>{
 const {error}=await client.rpc(name,args);
 assert.ok(error, "expected F19 RPC denial: "+name);
};
console.log("G5-F API and DB verified localhost, credentials kept outside CI logs");
const a=await createUser("a");
const b=await createUser("b");
pgsql(`
 INSERT INTO public.health_g5f_access VALUES
 ('${a.userId}','${ATH_A}'),('${b.userId}','${ATH_B}');
 INSERT INTO public.health_workout_sessions(id,athlete_id,status) VALUES
 ('${SESSION_A}','${ATH_A}','active'),('${SESSION_B}','${ATH_B}','active');
 INSERT INTO public.health_workout_exercises(id,athlete_id,session_id,status,planned_sets_min,planned_sets_max,planned_rest_seconds)
 VALUES
 ('${EX_A}','${ATH_A}','${SESSION_A}','active',3,3,90),
 ('${OTHER}','${ATH_A}','${SESSION_A}','pending',3,3,90),
 ('${EX_B}','${ATH_B}','${SESSION_B}','active',3,3,90);
 INSERT INTO public.health_workout_sets(athlete_id,session_id,workout_exercise_id,set_number,status,set_type)
 SELECT '${ATH_A}','${SESSION_A}','${EX_A}',n,'completed','working'
 FROM generate_series(1,3) AS n;
 INSERT INTO public.health_workout_timer_intervals(id,athlete_id,session_id,workout_exercise_id,
 workout_set_id,interval_type,set_number,status,client_event_id,started_at,target_seconds,created_by_auth_user_id)
 SELECT '${REST3}','${ATH_A}','${SESSION_A}','${EX_A}',id,'rest',3,'running',
 '${uniq()}',now()-interval '100 seconds',90,'${a.userId}'
 FROM public.health_workout_sets WHERE workout_exercise_id='${EX_A}' AND set_number=3;
`);
const list=async client=>{
 const {data,error}=await client.from("health_workout_sessions").select("id,athlete_id");
 if(error) throw Error("RLS read failed "+error.message);
 return data;
};
const aa=await list(a.client), bb=await list(b.client);
assert.deepEqual(aa.map(v=>v.id),[SESSION_A]);
assert.deepEqual(bb.map(v=>v.id),[SESSION_B]);
// Explicit 42501 is the stronger expected default-deny result for anon.
const anonResult=await publicClient().from("health_workout_sessions").select("id");
assert.ok(anonResult.error || (anonResult.data||[]).length===0);
if(anonResult.error) assert.match(anonResult.error.message,/permission denied|not permitted|authorization/i);
for(const table of ["health_workout_sessions","health_workout_sets","health_workout_timer_intervals"]){
 const {data,error}=await b.client.from(table).select("*").eq("athlete_id",ATH_A);
 if(error) throw Error(table+" RLS failed "+error.message);
 assert.equal(data.length,0);
}
await expectRejected(b.client,"health_f19_finish_rest",
 {p_rest_interval_id:REST3,p_client_event_id:uniq(),p_start_next_work:true,p_next_workout_exercise_id:EX_A});
await expectRejected(publicClient(),"health_f19_finish_rest",
 {p_rest_interval_id:REST3,p_client_event_id:uniq(),p_start_next_work:true,p_next_workout_exercise_id:EX_A});
const forged=await b.client.auth.updateUser({data:{athlete_id:ATH_A}});
assert.equal(forged.error,null);
assert.equal((await list(b.client)).some(v=>v.id===SESSION_A),false);
console.log("PASS G5F AUTH/RLS: A/B real GoTrue sessions; anon, cross-athlete, forged user_metadata denied");

const event1=uniq(),event2=uniq();
// Two authenticated clients of the same identity race the same REST interval.
// These are separate PostgREST requests with legitimate Auth JWTs.
const second=publicClient();
const sessionA=await a.client.auth.getSession();
if(sessionA.error || !sessionA.data.session) throw Error("A session missing");
await second.auth.setSession({access_token:sessionA.data.session.access_token,
 refresh_token:sessionA.data.session.refresh_token});
const race=await Promise.all([
 a.client.rpc("health_f19_finish_rest",{p_rest_interval_id:REST3,p_client_event_id:event1,
  p_start_next_work:true,p_next_workout_exercise_id:EX_A}),
 second.rpc("health_f19_finish_rest",{p_rest_interval_id:REST3,p_client_event_id:event2,
  p_start_next_work:true,p_next_workout_exercise_id:EX_A})
]);
const success=race.filter(x=>!x.error), denied=race.filter(x=>x.error);
assert.equal(success.length,1);assert.equal(denied.length,1);
const winnerEvent=race[0].error?event2:event1;
const work4=success[0].data?.[0]?.next_work_interval_id;
assert.ok(work4);
const repeat=await rpc(a.client,"health_f19_finish_rest",
 {p_rest_interval_id:REST3,p_client_event_id:winnerEvent,p_start_next_work:true,p_next_workout_exercise_id:EX_A});
assert.equal(repeat[0].next_work_interval_id,work4);
const startNumber=await a.client.from("health_workout_timer_intervals").select("set_number,status").eq("id",work4).single();
assert.equal(startNumber.data?.set_number,4);
assert.equal(startNumber.data?.status,"running");
console.log("PASS G5F REST: explicit 3/3→4/3, replay idempotent, two authenticated clients cannot both advance");
await expectRejected(b.client,"health_f19_finish_work_start_rest",
 {p_work_interval_id:work4,p_client_event_id:uniq(),p_load_value:80,p_reps:8,p_rir:2});
const w4=await rpc(a.client,"health_f19_finish_work_start_rest",
 {p_work_interval_id:work4,p_client_event_id:uniq(),p_load_value:80,p_reps:8,p_rir:2});
const rest4=w4[0]?.rest_interval_id;assert.ok(rest4);
await rpc(a.client,"health_f19_pause_workout",{p_session_id:SESSION_A,p_client_event_id:uniq()});
let status=await a.client.from("health_workout_sessions").select("status").eq("id",SESSION_A).single();
assert.equal(status.data?.status,"paused");
await rpc(a.client,"health_f19_resume_workout",{p_session_id:SESSION_A,p_client_event_id:uniq()});
status=await a.client.from("health_workout_sessions").select("status").eq("id",SESSION_A).single();
assert.equal(status.data?.status,"active");
const next=await rpc(a.client,"health_f19_finish_rest",
 {p_rest_interval_id:rest4,p_client_event_id:uniq(),p_start_next_work:true,p_next_workout_exercise_id:EX_A});
const work5=next[0]?.next_work_interval_id;assert.ok(work5);
let n=await a.client.from("health_workout_timer_intervals").select("set_number").eq("id",work5).single();
assert.equal(n.data?.set_number,5);
const w5=await rpc(a.client,"health_f19_finish_work_start_rest",
 {p_work_interval_id:work5,p_client_event_id:uniq(),p_load_value:80,p_reps:8,p_rir:2});
const rest5=w5[0]?.rest_interval_id;assert.ok(rest5);
const decline=await rpc(a.client,"health_f19_finish_rest",
 {p_rest_interval_id:rest5,p_client_event_id:uniq(),p_start_next_work:false});
assert.equal(decline[0]?.next_work_interval_id,null);
const {data:plan}=await a.client.from("health_workout_exercises").select("planned_sets_max").eq("id",EX_A).single();
assert.equal(plan?.planned_sets_max,3);
const {data:open}=await a.client.from("health_workout_timer_intervals").select("id").eq("session_id",SESSION_A).in("status",["running","paused"]);
assert.equal(open?.length,0);
const {data:series}=await a.client.from("health_workout_sets").select("set_number").eq("workout_exercise_id",EX_A).eq("status","completed");
assert.deepEqual(series.map(x=>x.set_number).sort((x,y)=>x-y),[1,2,3,4,5]);
console.log("PASS G5F F19: authenticated 3/3→4/3→5/3, pause/resume, no automatic sixth, M3 unchanged");
// A separate genuine local Auth session for the React browser, not the completed RPC test.
const UI_SESSION="abababab-abab-4bab-8bab-abababababab";
const UI_EX1="acacacac-acac-4cac-8cac-acacacacacac";
const UI_EX2="adadadad-adad-4dad-8dad-adadadadadad";
const UI_REST3="aeaeaeae-aeae-4eae-8eae-aeaeaeaeaeae";
pgsql(`
 INSERT INTO public.health_workout_sessions(id,athlete_id,status) VALUES ('${UI_SESSION}','${ATH_A}','active');
 INSERT INTO public.health_workout_exercises(id,athlete_id,session_id,status,planned_sets_min,planned_sets_max,planned_rest_seconds,planned_reps_min,planned_reps_max,planned_rir_target)
 VALUES ('${UI_EX1}','${ATH_A}','${UI_SESSION}','active',3,3,90,6,10,2),
 ('${UI_EX2}','${ATH_A}','${UI_SESSION}','pending',3,3,90,8,12,2);
 INSERT INTO public.health_workout_sets(athlete_id,session_id,workout_exercise_id,set_number,status,set_type,load_value,load_unit,reps,rir)
 SELECT '${ATH_A}','${UI_SESSION}','${UI_EX1}',n,'completed','working',80,'kg',8,2
 FROM generate_series(1,3) AS n;
 INSERT INTO public.health_workout_timer_intervals
 (id,athlete_id,session_id,workout_exercise_id,workout_set_id,interval_type,set_number,status,client_event_id,started_at,target_seconds,created_by_auth_user_id)
 SELECT '${UI_REST3}','${ATH_A}','${UI_SESSION}','${UI_EX1}',id,'rest',3,'running',
 '${uniq()}',now()-interval '120 seconds',90,'${a.userId}'
 FROM public.health_workout_sets WHERE workout_exercise_id='${UI_EX1}' AND set_number=3;
`);
if(!process.env.G5F_LOGIN_JSON) throw Error("missing ephemeral browser login path");
fs.writeFileSync(process.env.G5F_LOGIN_JSON,JSON.stringify({email:a.email,password:a.password,athleteId:ATH_A,sessionId:UI_SESSION}),{mode:0o600});
console.log("G5-F browser fixture prepared with genuine local Auth A; credentials not logged");
// Artifact safe metadata: omit real JWTs, passwords, API keys, user IDs and emails.
fs.writeFileSync(process.env.G5F_EVIDENCE,JSON.stringify({
 status:"passed",mode:"LOCAL_SUPABASE_GOTRUE_POSTGREST_POSTGRES",run:process.env.GITHUB_RUN_ID||"local",
 checks:["A/B real Auth sessions","RLS A/B anon and metadata forgery",
 "F19 cross-athlete RPC denied","two authenticated clients and event idempotency",
 "3-to-4-to-5","pause-resume","M3 unchanged and no sixth"],host:"localhost"
},null,2));
