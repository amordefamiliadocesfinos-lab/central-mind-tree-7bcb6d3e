#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const ts=require("typescript");
const compile=(source,options={})=>{
 const output=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,...options
 },reportDiagnostics:true});
 assert.equal((output.diagnostics??[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 return output.outputText;
};
const contractPath="supabase/functions/_shared/nucleo/ac01-agent-pilot-contract.ts";
const contractSource=fs.readFileSync(contractPath,"utf8");
const exportsObject={};
vm.runInNewContext(compile(contractSource),{exports:exportsObject,Object},{timeout:1000});
const c=exportsObject;
const validUuid="11111111-1111-4111-8111-111111111111";
const otherUuid="22222222-2222-4222-8222-222222222222";
const valid={module_id:c.NUC_MODULE_ID,request_id:validUuid};
assert.equal(c.parsePilotRequest(null),null);
assert.equal(c.parsePilotRequest([]),null);
assert.equal(c.parsePilotRequest({...valid,service_role:"x"}),null);
assert.equal(c.parsePilotRequest({...valid,module_id:otherUuid}),null);
assert.equal(c.parsePilotRequest({...valid,request_id:"bad"}),null);
assert.equal(c.parsePilotRequest(valid).request_id,validUuid);
const original={id:"record-1",...valid,workstream_id:null,specialist_role:c.PILOT_ROLE,
 contribution_kind:"mapa",title:c.PILOT_TITLE,source_kind:"github",source_locator:c.PILOT_SOURCE,
 source_checksum_sha256:null,note:"",parent_revision_id:null,version_no:1,
 authority_state:"proposta",recorded_by_auth_uid:"uid"};
assert.equal(c.matchesPilotRecord(original,valid,"uid"),true);
assert.equal(c.matchesPilotRecord({...original,authority_state:"vigente"},valid,"uid"),false);
assert.equal(c.matchesPilotRecord(original,valid,"other"),false);

let handler;
const rows=[];
let signedIn=true,granted=true,failReadback=false;
let writes=0;
const uid="33333333-3333-4333-8333-333333333333";
function makeDb(){
 const makeQuery=(name)=>{
  let filters={};
  const query={
   select(){return query;},
   eq(key,value){filters[key]=value;return query;},
   is(key,value){filters[key]=value;return query;},
   limit(){return query;},
   then(resolve,reject){
    let data=[];
    if(name==="app_admin_capabilities"){data=granted?[{auth_user_id:uid}]:[];}
    else if(name==="nucleo_development_workstreams"){data=[{id:c.NUC_MODULE_ID,kind:"modulo"}];}
    else if(name==="nucleo_specialist_contributions"){
      data=failReadback?null:rows.filter(r=>Object.entries(filters).every(([k,v])=>r[k]===v));
    }
    return Promise.resolve(data===null?{error:new Error("read failure"),data:null}:{error:null,data}).then(resolve,reject);
   },
   insert(fields){writes++;const record={id:"rec"+writes,...fields,version_no:1,authority_state:"proposta"};rows.push(record);
     return {select(){return {maybeSingle:async()=>({error:null,data:record})}}};
   },
  };
  return query;
 };
 return {
  auth:{getUser:async()=>signedIn?{error:null,data:{user:{id:uid}}}:{error:"bad",data:{user:null}}},
  from:makeQuery,
 };
}
const code=fs.readFileSync("supabase/functions/nucleo-ac01-agent-proposal/index.ts","utf8");
assert.doesNotMatch(code,/SERVICE_ROLE_KEY|service_role|\.rpc\(|\.update\(|\.delete\(/);
assert.match(code,/auth\.getUser\(token\)/);
assert.match(code,/\.eq\("capability","nucleo_manage"\)/);
assert.match(code,/\.eq\("request_id",intent\.request_id\)/);
assert.match(code,/matchesPilotRecord\(record,intent,uid\)/);
const sandbox={
 exports:{},
 require(name){
  if(name==="npm:@supabase/supabase-js@2")return {createClient:makeDb};
  if(name==="../_shared/cors.ts")return {corsHeaders:{}};
  if(name==="../_shared/nucleo/ac01-agent-pilot-contract.ts")return c;
  throw Error("unexpected dependency "+name);
 },
 Deno:{env:{get(key){return key==="SUPABASE_URL"?"https://mock.supabase.co":"anon-key"}},serve(fn){handler=fn}},
 Response,Request,console,
};
vm.runInNewContext(compile(code),sandbox,{timeout:1000});
assert.equal(typeof handler,"function");
const url="https://mock.supabase.co/functions/v1/nucleo-ac01-agent-proposal";
async function call(body,auth=true){
 const headers={"Content-Type":"application/json"};
 if(auth)headers.Authorization="Bearer mock-token";
 const req=new Request(url,{method:"POST",headers,body:JSON.stringify(body)});
 const res=await handler(req);
 return {code:res.status,body:await res.json()};
}
(async()=>{
 let res=await call(valid,false);
 assert.equal(res.code,401);
 assert.equal(writes,0);
 res=await call({...valid,hack:"yes"});
 assert.equal(res.code,400);
 assert.equal(writes,0);
 signedIn=false;
 res=await call(valid);
 assert.equal(res.code,401);
 assert.equal(writes,0);
 signedIn=true;granted=false;
 res=await call(valid);
 assert.equal(res.code,403);
 assert.equal(writes,0);
 granted=true;
 res=await call(valid);
 assert.equal(res.code,201);
 assert.equal(res.body.status,"confirmado_por_readback");
 assert.equal(res.body.homologado,false);
 assert.equal(res.body.record.authority_state,"proposta");
 assert.equal(writes,1);
 res=await call(valid);
 assert.equal(res.code,200);
 assert.equal(res.body.status,"confirmado_existente");
 assert.equal(writes,1);
 res=await call({...valid,request_id:otherUuid});
 assert.equal(res.code,409);
 assert.equal(writes,1);
 rows[0].title="changed";
 res=await call(valid);
 assert.equal(res.code,409);
 assert.equal(writes,1);
 rows[0].title=c.PILOT_TITLE;failReadback=true;
 res=await call(valid);
 assert.equal(res.code,503);
 assert.equal(writes,1);
 const config=fs.readFileSync("supabase/config.toml","utf8");
 assert.match(config,/\[functions\.nucleo-ac01-agent-proposal\]\s*verify_jwt = true/);
 console.log("PASS AC01 pilot: strict body, identity, grant, readback, replay, duplicate, fail-closed and JWT");
})().catch(err=>{console.error(err);process.exitCode=1});
