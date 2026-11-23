#!/usr/bin/env node
// LOCAL STAGING CONTRAPROVA ONLY: HS256 JWT + in-memory session verifier.
// NOT Supabase Auth, NOT a production Edge Function, NOT a deploy.
"use strict";
const crypto=require("node:crypto");
const {execFileSync}=require("node:child_process");
const assert=require("node:assert/strict");
const secret=crypto.randomBytes(32);
const iss="https://synthetic-staging.invalid/auth";
const aud="authenticated";
const now=Math.floor(Date.now()/1000);
const b64=x=>Buffer.from(typeof x==="string"?x:JSON.stringify(x)).toString("base64url");
function sign(payload){
 const parts=[b64({alg:"HS256",typ:"JWT"}),b64(payload)];
 const input=parts.join(".");
 return input+"."+crypto.createHmac("sha256",secret).update(input).digest("base64url");
}
const sessions=new Map();
function token(uid,sid,exp=now+180){return sign({iss,aud,sub:uid,session_id:sid,iat:now-5,exp});}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function identify(header){
 if(!header||!header.startsWith("Bearer "))return null;
 const parts=header.slice(7).split(".");
 if(parts.length!==3)return null;
 try {
  const hdr=JSON.parse(Buffer.from(parts[0],"base64url").toString());
  if(hdr.alg!=="HS256"||hdr.typ!=="JWT")return null;
  const expected=crypto.createHmac("sha256",secret).update(parts.slice(0,2).join(".")).digest();
  const observed=Buffer.from(parts[2],"base64url");
  if(observed.length!==expected.length||!crypto.timingSafeEqual(observed,expected))return null;
  const claims=JSON.parse(Buffer.from(parts[1],"base64url").toString());
  if(claims.iss!==iss||claims.aud!==aud||!uuid.test(claims.sub)||
     !uuid.test(claims.session_id)||claims.iat>now+60||claims.exp<=now)return null;
  const session=sessions.get(claims.session_id);
  return session?.active===true&&session.uid===claims.sub?claims.sub:null;
 }catch{return null;}
}
function queryRls(uid,moduleId,specialtyId,frontId){
 if(![uid,moduleId,specialtyId,frontId].every(x=>uuid.test(x)))throw Error("invalid synthetic UUID");
 const sql=`SET ROLE authenticated;
 SELECT set_config('request.jwt.claim.sub','${uid}',false);
 SELECT count(*)::int FROM f12_lab.context_cards
 WHERE module_id='${moduleId}' AND specialty_id='${specialtyId}';
 `;
 const output=execFileSync("psql",["-X","-qAt","-v","ON_ERROR_STOP=1","-c",sql],{env:process.env,encoding:"utf8"}).trim();
 const n=Number(output.split("\n").at(-1));
 if(!Number.isSafeInteger(n))throw Error("RLS query failed");
 return n;
}
function call(authHeader,moduleId,specialtyId,frontId){
 const uid=identify(authHeader);
 if(!uid)return 401;
 return queryRls(uid,moduleId,specialtyId,frontId)>0?200:403;
}
const NUC="636768e6-e782-4c7d-8132-e7381621be12";
const CRM="00000000-0000-4000-8000-000000000010";
const GOV="10000000-0000-4000-8000-000000000001";
const M4="95833fbd-38b5-4a0a-abea-45f74214d533";
const M5="00000000-0000-4000-8000-000000000020";
const CRMFRONT="00000000-0000-4000-8000-000000000011";
const SEC="10000000-0000-4000-8000-000000000002";
const A="30000000-0000-4000-8000-000000000001";
const B="30000000-0000-4000-8000-000000000002";
const D="30000000-0000-4000-8000-000000000004";
const OTHER="30000000-0000-4000-8000-000000000090";
const OWNER="30000000-0000-4000-8000-000000000099";
for(const [uid,i] of [[A,"1"],[B,"2"],[D,"4"],[OTHER,"9"],[OWNER,"8"]]){
 sessions.set("90000000-0000-4000-8000-00000000000"+i,{uid,active:true});
}
const sid=i=>"90000000-0000-4000-8000-00000000000"+i;
const bearer=(uid,i)=>"Bearer "+token(uid,sid(i));
assert.equal(call(undefined,NUC,GOV,M4),401,"no token");
assert.equal(call("Bearer invalid",NUC,GOV,M4),401,"invalid token");
assert.equal(call("Bearer "+token(B,sid("2"),now-1),NUC,SEC,M4),401,"expired JWT");
const forged=sign({iss,aud,sub:OTHER,session_id:sid("2"),iat:now-5,exp:now+180});
assert.equal(call("Bearer "+forged,NUC,SEC,M4),401,"session-sub mismatch");
assert.equal(call(bearer(OTHER,"9"),NUC,GOV,M4),403,"authenticated but no assignment");
assert.equal(call(bearer(B,"2"),NUC,GOV,M4),403,"cross-specialty");
assert.equal(call(bearer(B,"2"),CRM,SEC,CRMFRONT),403,"cross-module");
assert.equal(call(bearer(B,"2"),NUC,SEC,M4),200,"approved read_context");
assert.equal(call(bearer(D,"4"),NUC,GOV,M4),200,"new grant from approved reissue");
assert.equal(call(bearer(D,"4"),NUC,GOV,M5),403,"same module and specialty but unauthorized front");
assert.equal(call(bearer(OWNER,"8"),NUC,GOV,M5),200,"owner can see extra front");
assert.equal(call(bearer(A,"1"),NUC,GOV,M4),403,"revoked old grant");
assert.equal(call(bearer(A,"1"),CRM,GOV,CRMFRONT),200,"unaffected CRM grant");
assert.equal(call(bearer(OWNER,"8"),NUC,GOV,M4),200,"owner compatibility");
sessions.get(sid("2")).active=false;
assert.equal(call(bearer(B,"2"),NUC,SEC,M4),401,"inactive session fails");
console.log("PASS 15 synthetic staging gateway+RLS checks: 401/403/200, scope, revoke, owner; NOT live Supabase Auth");
