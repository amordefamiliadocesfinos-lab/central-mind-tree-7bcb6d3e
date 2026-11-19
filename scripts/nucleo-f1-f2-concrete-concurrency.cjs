#!/usr/bin/env node
"use strict";
const {spawn}=require("node:child_process");
function run(sql){
 return new Promise(resolve=>{
  const child=spawn("psql",["-X","-v","ON_ERROR_STOP=1","-c",sql],{env:process.env});
  let out="",err="";
  child.stdout.on("data",d=>out+=d);
  child.stderr.on("data",d=>err+=d);
  child.on("close",code=>resolve({code,out,err}));
 });
}
const assignment="'40000000-0000-4000-8000-000000000003'";
function sql(id){
 return `BEGIN; INSERT INTO f12_lab.assignments
  SELECT '${id}'::uuid,specialty_id,instance_id,auth_uid,module_id,front_id,'primary',
   local_method_ref,'synthetic://prov/race','active',now(),NULL,NULL
  FROM f12_lab.assignments WHERE id=${assignment};
  SELECT pg_sleep(0.5); COMMIT;`;
}
(async()=>{
 const [a,b]=await Promise.all([
  run(sql("70000000-0000-4000-8000-000000000001")),
  run(sql("70000000-0000-4000-8000-000000000002")),
 ]);
 const successes=[a,b].filter(x=>x.code===0).length;
 const conflicts=[a,b].filter(x=>x.code!==0&&/duplicate key value violates unique constraint|23505/i.test(x.err)).length;
 if(successes!==1||conflicts!==1){
  console.error("Concurrency test failed (counts only)",{successes,conflicts,exits:[a.code,b.code]});
  process.exit(1);
 }
 const check=await run("SELECT count(*) AS c FROM f12_lab.assignments WHERE provenance_ref='synthetic://prov/race';");
 if(check.code!==0||!/\b1\b/.test(check.out)){
  console.error("Concurrent insert was not unique");process.exit(1);
 }
 console.log("PASS F2 concurrent insert: exactly one winner, one unique rejection; no double assignment");
})().catch(e=>{console.error(e.message);process.exit(1)});
