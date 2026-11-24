#!/usr/bin/env node
"use strict";
// Two independent psql connections; disposable lab ONLY.
const {spawn}=require("node:child_process");
const assert=require("node:assert/strict");
const dec="80000000-0000-4000-8000-0000000000c1";
function statement(id, delay, rollback) {
 return [
 "BEGIN;",
 "SET LOCAL ROLE f12_grant_executor;",
 "SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000097',true);",
 "SET LOCAL statement_timeout='5000ms';",
 "INSERT INTO f12_lab.read_grants (id,assignment_id,auth_uid,permission,scope_kind,granted_at,valid_from,valid_until,decision_ref,granting_actor_ref)",
 "VALUES ('"+id+"','40000000-0000-4000-8000-0000000000c1','30000000-0000-4000-8000-000000000001','read_context','module',now(),now()-interval '1 minute',now()+interval '30 minutes','"+dec+"','30000000-0000-4000-8000-000000000097');",
 "SELECT pg_sleep("+delay+");",
 rollback?"ROLLBACK;":"COMMIT;"
 ].join("\n");
}
function run(sql) {
 return new Promise((resolve,reject)=>{
  const p=spawn("psql",["-X","-qAt","-v","ON_ERROR_STOP=1","-c",sql],{env:process.env});
  let out="",err="";
  p.stdout.on("data",d=>out+=d);p.stderr.on("data",d=>err+=d);
  p.on("error",reject);p.on("close",code=>resolve({code,out,err}));
 });
}
async function query(sql) {
 const r=await run(sql);if(r.code!==0)throw Error(r.err);return r.out.trim();
}
(async()=>{
 const rolled=await run(statement("50000000-0000-4000-8000-0000000000c0",0,true));
 assert.equal(rolled.code,0,"preflight rollback failed "+rolled.err);
 assert.equal(await query("SELECT count(*) FROM f12_lab.read_grants WHERE decision_ref='"+dec+"'"),"0");
 assert.equal(await query("SELECT count(*) FROM f12_lab.grant_history WHERE grant_id='50000000-0000-4000-8000-0000000000c0'"),"0");
 console.log("PASS G2 rollback: no durable grant or audit");
 const attempts=await Promise.all([
  run(statement("50000000-0000-4000-8000-0000000000c1",0.8,false)),
  run(statement("50000000-0000-4000-8000-0000000000c2",0.8,false))
 ]);
 assert.equal(attempts.filter(x=>x.code===0).length,1,"one winner "+JSON.stringify(attempts));
 assert.equal(attempts.filter(x=>x.code!==0&&/duplicate key value violates unique constraint|23505/.test(x.err)).length,1,"one unique rejection "+JSON.stringify(attempts));
 assert.equal(await query("SELECT count(*) FROM f12_lab.read_grants WHERE decision_ref='"+dec+"'"),"1");
 assert.equal(await query("SELECT count(*) FROM f12_lab.grant_history h JOIN f12_lab.read_grants g ON h.grant_id=g.id WHERE g.decision_ref='"+dec+"' AND h.event_kind='granted'"),"1");
 console.log("PASS G2 race: two sessions, one grant, one audit, one rejected");
 const saved=await query("SELECT id::text FROM f12_lab.read_grants WHERE decision_ref='"+dec+"'");
 const repeat=await run(statement("50000000-0000-4000-8000-0000000000c3",0,false));
 assert.notEqual(repeat.code,0,"retry must not grant");
 assert.match(repeat.err,/duplicate key value violates unique constraint|23505/);
 assert.equal(await query("SELECT id::text FROM f12_lab.read_grants WHERE decision_ref='"+dec+"'"),saved);
 console.log("PASS G2 retry after lost response: durable result stable; HTTP response NOT tested");
})().catch(e=>{console.error("G2_RACE_FAIL",e.message);process.exitCode=1});
