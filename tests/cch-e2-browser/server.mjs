/** TEST-ONLY HTTP bridge to an ephemeral PostgreSQL database.
 * Refuses nonlocal DB hosts, nonfixture DB names and missing opt-in.
 * No production keys, Supabase URL, OAuth or athlete accounts are used.
 */
import http from "node:http";
import {randomBytes} from "node:crypto";
import postgres from "postgres";
const REQUIRED="postgres://postgres:e2-local-only@127.0.0.1:5432/e2_disposable";
if(process.env.CCH_E2_ISOLATED!=="YES"||process.env.DATABASE_URL!==REQUIRED)
 throw Error("E2 test server refuses production and unapproved databases");
const sql=postgres(REQUIRED,{max:3,prepare:false});
const sessions=new Map();
const people={
 a:{user:"11111111-1111-4111-8111-111111111111",athlete:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"},
 b:{user:"22222222-2222-4222-8222-222222222222",athlete:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}
};
function respond(res,status,data,headers={}){
 res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers});
 res.end(JSON.stringify(data));
}
function cookie(req){
 const cookie=(req.headers.cookie??"").split(";").map(x=>x.trim()).find(x=>x.startsWith("cch_e2_lab="));
 return cookie?sessions.get(cookie.slice("cch_e2_lab=".length)):null;
}
async function readBody(req){
 let content="";for await(const chunk of req){
  content+=chunk;if(content.length>12000)throw Error("payload too large");
 }
 return content?JSON.parse(content):{};
}
async function asAthlete(person,fn){
 return await sql.begin(async tx=>{
  await tx.unsafe("SET LOCAL ROLE authenticated");
  await tx.unsafe("SELECT set_config('request.jwt.claim.sub',$1,true)",[person.user]);
  return await fn(tx,person);
 });
}
async function state(tx,person){
 const athlete=await tx.unsafe("SELECT id FROM public.health_athletes WHERE id=$1",[person.athlete]);
 if(!athlete.length)throw Error("athlete access denied");
 const programs=await tx.unsafe("SELECT * FROM public.health_programs WHERE athlete_id=$1 ORDER BY id LIMIT 1",[person.athlete]);
 if(!programs.length)return {program:null,version:null,templates:[],templateExercises:[],priorities:[],queue:[]};
 const program={...programs[0],name:"CCH — Atleta sintético"};
 const drafts=await tx.unsafe("SELECT * FROM public.health_program_versions WHERE program_id=$1 AND athlete_id=$2 AND status='draft' LIMIT 1",[program.id,person.athlete]);
 const versions=drafts.length?drafts:await tx.unsafe("SELECT * FROM public.health_program_versions WHERE id=$1 AND athlete_id=$2",[program.current_version_id,person.athlete]);
 const version=versions[0]??null;
 const templates=version?await tx.unsafe("SELECT * FROM public.health_session_templates WHERE program_version_id=$1 AND athlete_id=$2 ORDER BY sequence_order",[version.id,person.athlete]):[];
 const templateExercises=version?await tx.unsafe(
  "SELECT e.* FROM public.health_session_template_exercises e JOIN public.health_session_templates t ON t.id=e.session_template_id WHERE t.program_version_id=$1 AND e.athlete_id=$2 ORDER BY t.sequence_order,e.sequence_order",[version.id,person.athlete]):[];
 const queue=await tx.unsafe("SELECT * FROM public.health_cch_queue_entries WHERE athlete_id=$1 ORDER BY queue_position",[person.athlete]);
 return {program,version,templates,templateExercises,queue,priorities:[]};
}
const httpServer=http.createServer(async(req,res)=>{
 const pathname=new URL(req.url??"/","http://127.0.0.1:4174").pathname;
 try{
  if(req.method==="POST"&&pathname==="/api/login"){
   const input=await readBody(req);if(!["a","b"].includes(input.who))return respond(res,400,{error:"unknown fixture account"});
   const session=randomBytes(32).toString("hex");sessions.set(session,people[input.who]);
   return respond(res,200,{ok:true},{"set-cookie":`cch_e2_lab=${session}; HttpOnly; SameSite=Strict; Path=/`});
  }
  if(req.method==="POST"&&pathname==="/api/logout"){
   const id=(req.headers.cookie??"").split(";").map(x=>x.trim()).find(x=>x.startsWith("cch_e2_lab="))?.split("=")[1];
   if(id)sessions.delete(id);
   return respond(res,200,{ok:true},{"set-cookie":"cch_e2_lab=; Max-Age=0; Path=/; HttpOnly"});
  }
  const user=cookie(req);
  if(pathname==="/api/session")return respond(res,200,{athlete:user?{id:user.athlete}:null});
  if(!user)return respond(res,401,{error:"synthetic authentication required"});
  if(req.method==="GET"&&pathname==="/api/state")
   return respond(res,200,await asAthlete(user,state));
  if(req.method==="GET"&&pathname==="/api/audit"){
   const data=await asAthlete(user,async(tx,person)=>{
    const versions=await tx.unsafe("SELECT status,count(*)::int n FROM public.health_program_versions WHERE athlete_id=$1 GROUP BY status",[person.athlete]);
    const queue=await tx.unsafe("SELECT program_version_id,count(*)::int n FROM public.health_cch_queue_entries WHERE athlete_id=$1 GROUP BY program_version_id",[person.athlete]);
    const rows=await tx.unsafe("SELECT id,exercise_id,sequence_order,reps_max,prescription_notes FROM public.health_session_template_exercises WHERE athlete_id=$1 ORDER BY id",[person.athlete]);
    return {versions,queue,rows};
   });
   return respond(res,200,data);
  }
  if(req.method!=="POST")return respond(res,404,{error:"unknown fixture route"});
  const input=await readBody(req);
  if(pathname==="/api/edit"){
   const value=await asAthlete(user,async tx=>tx.unsafe(
    "SELECT public.health_cch_e2_update_draft_prescription($1::uuid,$2::uuid,$3::jsonb,$4::jsonb,$5::text) AS result",
    [input.id,input.versionId,JSON.stringify(input.before),JSON.stringify(input.after),input.reason]));
   return respond(res,200,value[0]?.result??{});
  }
  if(pathname==="/api/structure"){
   const value=await asAthlete(user,async tx=>tx.unsafe(
    "SELECT public.health_cch_e2_edit_draft_exercise($1::uuid,$2::text,$3::uuid,$4::uuid,$5::text) AS result",
    [input.id,input.operation,input.other??null,input.replacement??null,input.reason]));
   return respond(res,200,value[0]?.result??{});
  }
  if(pathname==="/api/publish"){
   const value=await asAthlete(user,async tx=>tx.unsafe(
     "SELECT * FROM public.health_m3_publish_program_version($1::uuid)",[input.versionId]));
   return respond(res,200,value[0]??{});
  }
  return respond(res,404,{error:"unknown action"});
 }catch(error){
  return respond(res,400,{error:error instanceof Error?error.message:"unknown isolated error"});
 }
});
httpServer.listen(4174,"127.0.0.1",()=>process.stdout.write("E2 local-only API listening 4174\n"));
process.on("SIGTERM",()=>{httpServer.close();void sql.end();});
