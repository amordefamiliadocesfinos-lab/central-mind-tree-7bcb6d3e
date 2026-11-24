#!/usr/bin/env node
"use strict";
// F1/F2: Real LOCAL GoTrue (Supabase Auth) + PostgREST RLS + local HTTP gateway.
// No hosted project, no real accounts, no production tokens or backend secrets.
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const http=require("node:http");
const {execFileSync}=require("node:child_process");
const API=(process.env.API_URL||"http://127.0.0.1:54321").replace(/\/$/,"");
const KEY=process.env.ANON_KEY;
assert(KEY&&KEY.length>20,"Local-only ANON_KEY required");
const NUC="636768e6-e782-4c7d-8132-e7381621be12",M4="95833fbd-38b5-4a0a-abea-45f74214d533";
const GOV="10000000-0000-4000-8000-000000000001",SEC="10000000-0000-4000-8000-000000000002";
const M5="00000000-0000-4000-8000-000000000020",CRM="00000000-0000-4000-8000-000000000010",CRMFRONT="00000000-0000-4000-8000-000000000011";
const E2E_INSTANCE="20000000-0000-4000-8000-000000000081";
const E2E_ASSIGNMENT="40000000-0000-4000-8000-000000000081";
const E2E_GRANT="50000000-0000-4000-8000-000000000081";
const rx=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function request(path,opts={}){
 const r=await fetch(API+path,{...opts,headers:{apikey:KEY,"Content-Type":"application/json",...(opts.headers||{})}});
 let body;const raw=await r.text();try{body=JSON.parse(raw)}catch{body={detail:raw.slice(0,300)}}
 return {status:r.status,body};
}
function sql(statement){return execFileSync("psql",["-X","-qAt","-v","ON_ERROR_STOP=1","-c",statement],{encoding:"utf8",env:process.env}).trim()}
function seed(uid){
 assert(rx.test(uid),"Real locally-issued uid required");
 sql(`
 INSERT INTO f12_lab.instances(id,auth_uid,identity_source,functional_label)
 VALUES ('${E2E_INSTANCE}','${uid}','synthetic://local-auth/verified-signin','local-test-actor');
 INSERT INTO f12_lab.assignments(id,specialty_id,instance_id,auth_uid,module_id,front_id,responsibility,local_method_ref,provenance_ref,status,valid_from)
 VALUES ('${E2E_ASSIGNMENT}','${GOV}','${E2E_INSTANCE}','${uid}','${NUC}','${M4}','collaborator',NULL,'synthetic://local-auth/fixture','active',now()-interval '1 minute');
 INSERT INTO f12_lab.read_grants(id,assignment_id,auth_uid,permission,granted_at,valid_from,decision_ref,granting_actor_ref)
 VALUES ('${E2E_GRANT}','${E2E_ASSIGNMENT}','${uid}','read_context',now(),now()-interval '1 minute',
 'synthetic://local-auth/test-decision','synthetic://local-auth/test-executor');
 `);
}
function revoke(){
 sql(`UPDATE f12_lab.read_grants SET revoked_at=now(),revoked_by_actor_ref='synthetic://local-auth/revoker',
 revocation_decision_ref='synthetic://local-auth/revoke-decision' WHERE id='${E2E_GRANT}';`);
}
function sessionStillValid(sid,uid){
 if(!rx.test(sid)||!rx.test(uid))return false;
 const n=sql(`SELECT count(*) FROM auth.sessions WHERE id='${sid}' AND user_id='${uid}' AND
 (not_after IS NULL OR now()<not_after)`);
 return n==="1";
}
function decodeJwt(token){
 try{return JSON.parse(Buffer.from(token.split(".")[1],"base64url").toString("utf8"))}catch{return {}}
}
async function checkAccess(auth,params){
 if(!auth?.startsWith("Bearer "))return {status:401};
 const token=auth.slice(7);
 const me=await request("/auth/v1/user",{headers:{Authorization:"Bearer "+token}});
 if(me.status!==200||!rx.test(me.body?.id))return {status:401};
 const jwt=decodeJwt(token);
 if(jwt.sub!==me.body.id||!sessionStillValid(jwt.session_id,me.body.id))return {status:401};
 const q=new URLSearchParams({select:"id,specialty_id,module_id,front_id,card_type,public_label,public_source_ref",module_id:"eq."+params.module_id,
  specialty_id:"eq."+params.specialty_id,front_id:"eq."+params.front_id});
 const found=await request("/rest/v1/f12_read_context?"+q.toString(),{headers:{Authorization:"Bearer "+token}});
 if(found.status!==200||!Array.isArray(found.body))return {status:503};
 if(!found.body.length)return {status:403};
 const allowedTypes=["checkpoint","method_ref","next_action","contribution_ref","learning_ref"];
 const rows=found.body;
 if(rows.some(r=>!rx.test(r.id)||r.specialty_id!==params.specialty_id||r.module_id!==params.module_id||
   r.front_id!==params.front_id||!allowedTypes.includes(r.card_type)||
   typeof r.public_label!=="string"||typeof r.public_source_ref!=="string")||
   new Set(rows.map(r=>r.card_type)).size!==rows.length)return {status:503};
 const slots=Object.fromEntries(allowedTypes.map(type=>[type,null]));
 for(const row of rows)slots[row.card_type]={id:row.id,label:row.public_label,source_ref:row.public_source_ref};
 return {status:200,body:rows,context:{
   specialty_id:params.specialty_id,module_id:params.module_id,front_id:params.front_id,
   mode:"consultive_only",slots,missing:allowedTypes.filter(type=>slots[type]===null),
   authority:"not_inherited",origin:"reviewed_metadata_local_lab",
   knowledge_status:"reference_only_no_publication_or_approval",
   learning_status:"reference_only_no_method_promotion"
 }};
}
async function main(){
 const suffix=crypto.randomBytes(5).toString("hex");
 const password=crypto.randomBytes(22).toString("base64url")+"A!";
 const emails=[`f12-a-${suffix}@example.com`,`f12-b-${suffix}@example.com`];
 const users=[];
 for(const email of emails){
  const signup=await request("/auth/v1/signup",{method:"POST",body:JSON.stringify({email,password})});
  assert([200,201].includes(signup.status),`local Auth signup status ${signup.status}`);
  const login=await request("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email,password})});
  assert.equal(login.status,200,"local Auth password login should succeed");
  assert(rx.test(login.body.user?.id)&&login.body.access_token,"local Auth must issue user UUID and JWT");
  users.push({id:login.body.user.id,token:login.body.access_token});
 }
 seed(users[0].id);
 sql(`
-- F3: reviewed method reference, exact same specialty/module/front; deliberately
-- no next_action card, so the package must preserve the missing slot.
INSERT INTO f12_lab.approved_card_sources
 (source_ref,specialty_id,module_id,front_id,public_label,origin_kind,verified,private_payload_included,authorization_ref)
 VALUES('synthetic://source/nuc-method','10000000-0000-4000-8000-000000000001',
 '636768e6-e782-4c7d-8132-e7381621be12','95833fbd-38b5-4a0a-abea-45f74214d533',
 'synthetic reviewed method reference','github_reference',true,false,'synthetic://approval/nuc-method');
INSERT INTO f12_lab.context_cards VALUES
 ('60000000-0000-4000-8000-000000000098','10000000-0000-4000-8000-000000000001',
 '636768e6-e782-4c7d-8132-e7381621be12','95833fbd-38b5-4a0a-abea-45f74214d533',
 'method_ref','synthetic reviewed method reference','synthetic://source/nuc-method');
INSERT INTO f12_lab.approved_card_sources
 (source_ref,specialty_id,module_id,front_id,public_label,origin_kind,verified,private_payload_included,authorization_ref)
 VALUES('synthetic://source/nuc-contribution-v2','10000000-0000-4000-8000-000000000001',
 '636768e6-e782-4c7d-8132-e7381621be12','95833fbd-38b5-4a0a-abea-45f74214d533',
 'synthetic contribution proposal v2','github_reference',true,false,'synthetic://approval/nuc-contribution-v2');
INSERT INTO f12_lab.context_cards VALUES
 ('60000000-0000-4000-8000-000000000096','10000000-0000-4000-8000-000000000001',
 '636768e6-e782-4c7d-8132-e7381621be12','95833fbd-38b5-4a0a-abea-45f74214d533',
 'contribution_ref','synthetic contribution proposal v2','synthetic://source/nuc-contribution-v2');
INSERT INTO f12_lab.approved_card_sources
 (source_ref,specialty_id,module_id,front_id,public_label,origin_kind,verified,private_payload_included,authorization_ref)
 VALUES('synthetic://source/nuc-learning','10000000-0000-4000-8000-000000000001',
 '636768e6-e782-4c7d-8132-e7381621be12','95833fbd-38b5-4a0a-abea-45f74214d533',
 'synthetic reviewed lesson checkpoint','m3_event_reference',true,false,'synthetic://approval/nuc-learning');
INSERT INTO f12_lab.context_cards VALUES
 ('60000000-0000-4000-8000-000000000097','10000000-0000-4000-8000-000000000001',
 '636768e6-e782-4c7d-8132-e7381621be12','95833fbd-38b5-4a0a-abea-45f74214d533',
 'learning_ref','synthetic reviewed lesson checkpoint','synthetic://source/nuc-learning');
`);
 const server=http.createServer(async (req,res)=>{
  try{
   const url=new URL(req.url,"http://127.0.0.1");
   if(req.method!=="GET"||url.pathname!=="/f12/read"){res.writeHead(404).end();return}
   const keys=["module_id","specialty_id","front_id"];
   const params=Object.fromEntries(keys.map(k=>[k,url.searchParams.get(k)]));
   if(!keys.every(k=>rx.test(params[k]||""))){res.writeHead(400).end();return}
   const found=await checkAccess(req.headers.authorization,params);
   res.writeHead(found.status,{"Content-Type":"application/json","Cache-Control":"no-store"});
   res.end(JSON.stringify({status:found.status,results:found.body?.length??0,...(found.status===200?{context:found.context}:{})}));
  }catch{res.writeHead(503).end(JSON.stringify({status:503}))}
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const port=server.address().port;
 const endpoint=(front=M4,specialty=GOV)=>`http://127.0.0.1:${port}/f12/read?module_id=${NUC}&specialty_id=${specialty}&front_id=${front}`;
 async function code(url,token){
  const r=await fetch(url,{headers:token?{Authorization:"Bearer "+token}:{}});
  return r.status;
 }
 try{
  assert.equal(await code(endpoint()),401,"HTTP 401 no token");
  assert.equal(await code(endpoint(),"invalid"),401,"HTTP 401 invalid credential");
  assert.equal(await code(endpoint(),users[1].token),403,"HTTP 403 authenticated, ungranted");
  assert.equal(await code(endpoint(M4,SEC),users[0].token),403,"HTTP 403 another specialty");
  assert.equal(await code(endpoint(M5,GOV),users[0].token),403,"HTTP 403 different front same module and specialty");
  const crmUrl=`http://127.0.0.1:${port}/f12/read?module_id=${CRM}&specialty_id=${GOV}&front_id=${CRMFRONT}`;
  assert.equal(await code(crmUrl,users[0].token),403,"HTTP 403 another module");
  assert.equal(await code(endpoint(),users[0].token),200,"HTTP 200 approved scoped reader");
  const packageResponse=await fetch(endpoint(),{headers:{Authorization:"Bearer "+users[0].token}});
  const pkg=await packageResponse.json();
  assert.equal(packageResponse.status,200);
  assert.equal(packageResponse.headers.get("cache-control"),"no-store");
  assert.equal(pkg.context.specialty_id,GOV);
  assert.equal(pkg.context.module_id,NUC);
  assert.equal(pkg.context.front_id,M4);
  assert.equal(pkg.context.mode,"consultive_only");
  assert.equal(pkg.context.authority,"not_inherited");
  assert.equal(pkg.context.slots.checkpoint.source_ref,"synthetic://source/nuc");
  assert.equal(pkg.context.slots.method_ref.source_ref,"synthetic://source/nuc-method");
  assert.equal(pkg.context.slots.next_action,null);
  assert.deepEqual(pkg.context.missing,["next_action"]);
  assert.equal(pkg.context.slots.contribution_ref.source_ref,"synthetic://source/nuc-contribution-v2");
  assert.equal(pkg.context.slots.learning_ref.source_ref,"synthetic://source/nuc-learning");
  assert.equal(pkg.context.knowledge_status,"reference_only_no_publication_or_approval");
  assert.equal(pkg.context.learning_status,"reference_only_no_method_promotion");
  assert.equal(pkg.results,4);
  assert(!JSON.stringify(pkg).includes("synthetic different front"));
  for(const forbiddenUrl of [endpoint(M4,SEC),endpoint(M5,GOV),crmUrl]){
   const denied=await fetch(forbiddenUrl,{headers:{Authorization:"Bearer "+users[0].token}});
   assert.equal(denied.status,403);
   assert.equal((await denied.json()).context,undefined);
  }
  const deniedPackage=await fetch(endpoint(),{headers:{Authorization:"Bearer "+users[1].token}});
  assert.equal(deniedPackage.status,403);
  assert.equal((await deniedPackage.json()).context,undefined);
  const direct=await request("/rest/v1/f12_read_context?select=id",{headers:{Authorization:"Bearer "+users[1].token}});
  assert.equal(direct.status,200,"PostgREST selects must honor RLS");
  assert.deepEqual(direct.body,[],"ungranted user sees zero raw rows under RLS");
  revoke();
  assert.equal(await code(endpoint(),users[0].token),403,"HTTP 403 immediately after grant revoke");
  const revokedPackage=await fetch(endpoint(),{headers:{Authorization:"Bearer "+users[0].token}});
  assert.equal(revokedPackage.status,403);
  assert.equal((await revokedPackage.json()).context,undefined);
  console.log("PASS F3/F4/F5 consultive package: scoped method, contribution and lesson references; missing next action explicit; no inherited authority or publication; denied/revoked context withheld");
  const out=await request("/auth/v1/logout",{method:"POST",headers:{Authorization:"Bearer "+users[0].token}});
  assert([200,204].includes(out.status),"local Auth logout");
  assert.equal(await code(endpoint(),users[0].token),401,"HTTP 401 when session revoked");
  console.log("PASS local Supabase Auth + PostgREST + HTTP gateway: 401,403,200, RLS, revoke grant, revoke session (isolated)");
 }finally{
  await new Promise(resolve=>server.close(resolve));
  // Restore the shared baseline card set for the subsequent G1/G2 tests.
  // Only remove the three temporary projection cards created by this local
  // scenario. Reviewed source records remain immutable.
  sql(`DELETE FROM f12_lab.context_cards WHERE id IN
    ('60000000-0000-4000-8000-000000000096',
     '60000000-0000-4000-8000-000000000097',
     '60000000-0000-4000-8000-000000000098')
    AND public_source_ref IN ('synthetic://source/nuc-method',
      'synthetic://source/nuc-contribution-v2','synthetic://source/nuc-learning');
  `);
  assert.equal(sql(`SELECT count(*) FROM f12_lab.context_cards WHERE module_id='${NUC}' AND specialty_id='${GOV}'`),"2","restore baseline G1 card set");
 }
}
main().catch(e=>{console.error("LOCAL_AUTH_GATE_FAIL",e.message);process.exit(1)});
