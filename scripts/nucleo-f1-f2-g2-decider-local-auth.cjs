#!/usr/bin/env node
"use strict";
// Local GoTrue decider identity proof only. PostgreSQL admin seeds synthetic
// authorization AFTER validating actual local Auth user/session.
// Not a human Camada Mestre approval or hosted writer.
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {execFileSync}=require("node:child_process");
const API=(process.env.API_URL||"http://127.0.0.1:54321").replace(/\/$/,"");
const KEY=process.env.ANON_KEY;
assert(KEY,"ANON_KEY only from disposable local Supabase stack");
function sql(statement) {
 return execFileSync("psql",["-X","-qAt","-v","ON_ERROR_STOP=1","-c",statement],{env:process.env,encoding:"utf8"}).trim();
}
async function req(path,body,token) {
 const r=await fetch(API+path,{method:body?"POST":"GET",headers:{apikey:KEY,"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:body?JSON.stringify(body):undefined});
 const txt=await r.text();let obj;try{obj=JSON.parse(txt)}catch{obj={}};return {status:r.status,obj};
}
(async()=>{
 const suffix=crypto.randomBytes(6).toString("hex");
 const password=crypto.randomBytes(24).toString("base64url")+"A!";
 const email="g2-decider-"+suffix+"@example.com";
 const sign=await req("/auth/v1/signup",{email,password});
 assert([200,201].includes(sign.status),"local decider signup "+sign.status);
 const login=await req("/auth/v1/token?grant_type=password",{email,password});
 assert.equal(login.status,200,"local decider login");
 const token=login.obj.access_token,uid=login.obj.user?.id;
 assert(/^[0-9a-f-]{36}$/i.test(uid)&&token,"local Auth user and JWT required");
 const me=await req("/auth/v1/user",null,token);
 assert.equal(me.status,200);assert.equal(me.obj.id,uid);
 const claims=JSON.parse(Buffer.from(token.split(".")[1],"base64url").toString("utf8"));
 assert.equal(claims.sub,uid);
 const sid=claims.session_id;assert(/^[0-9a-f-]{36}$/i.test(sid),"session id");
 assert.equal(sql("SELECT count(*) FROM auth.sessions WHERE id='"+sid+"' AND user_id='"+uid+"'"),"1");
 // Authenticated identity is established above. Authority itself is NOT in
 // user_metadata; it comes exclusively from an admin-seeded lab registry.
 sql("INSERT INTO f12_lab.g2_competences VALUES "+
 "('90000000-0000-4000-8000-0000000000e1','"+uid+"','module',"+
 "'636768e6-e782-4c7d-8132-e7381621be12',"+
 "'10000000-0000-4000-8000-000000000001','grant_read_context',"+
 "'synthetic://master/local-auth-competence',NULL,now()-interval '1 minute',now()+interval '1 hour',NULL);");
 sql("INSERT INTO f12_lab.approved_decisions "+
 "(id,action,assignment_id,grant_id,approved_actor_auth_uid,scope_kind,authoritative_source,approved_at,expires_at) VALUES "+
 "('80000000-0000-4000-8000-0000000000e1','grant_read_context',"+
 "'40000000-0000-4000-8000-0000000000c1',NULL,"+
 "'30000000-0000-4000-8000-000000000097','module',"+
 "'synthetic://master/local-approved-command',now()-interval '1 minute',now()+interval '1 hour');");
 sql("INSERT INTO f12_lab.g2_decision_attestations "+
 "(decision_id,competence_id,decider_auth_uid,executor_auth_uid,assignment_id,beneficiary_auth_uid,scope_kind,action,request_id,proof_ref) VALUES "+
 "('80000000-0000-4000-8000-0000000000e1','90000000-0000-4000-8000-0000000000e1',"+
 "'"+uid+"','30000000-0000-4000-8000-000000000097',"+
 "'40000000-0000-4000-8000-0000000000c1','30000000-0000-4000-8000-000000000001',"+
 "'module','grant_read_context','90000000-0000-4000-8000-0000000000e2',"+
 "'synthetic://verified-local-auth-decider');");
 assert.equal(sql("SELECT count(*) FROM f12_lab.g2_decision_attestations "+
 "WHERE decision_id='80000000-0000-4000-8000-0000000000e1' AND decider_auth_uid<>executor_auth_uid"),"1");
 console.log("PASS G2 local GoTrue decider: real local Auth JWT/session, distinct executor, server-seeded scope competence; NOT human approval");
})().catch(e=>{console.error("G2_DECIDER_AUTH_FAIL",e.message);process.exitCode=1});
