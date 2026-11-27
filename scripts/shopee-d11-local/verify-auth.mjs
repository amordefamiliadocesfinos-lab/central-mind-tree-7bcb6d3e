// Real local GoTrue/PostgREST only; no hosted project, real shop or secret output.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const {API_URL:api,ANON_KEY:anon,SERVICE_ROLE_KEY:service,DB_URL:db}=process.env;
assert.equal(api,'http://127.0.0.1:54321');
assert.match(db??'',/^postgresql:\/\/postgres:[^@]+@127\.0\.0\.1:54322\/postgres$/);
assert.ok(anon&&service);
assert.ok(!process.env.SUPABASE_ACCESS_TOKEN&&!process.env.SUPABASE_URL);
const sql=(s)=>{
 const r=spawnSync('psql',[db,'-X','-q','-A','-t','-v','ON_ERROR_STOP=1'],{input:s,encoding:'utf8'});
 if(r.status!==0)throw Error('local SQL fixture failed');
 return r.stdout.trim();
};
async function request(path,key,bearer,body,method='POST'){
 const res=await fetch(api+path,{method,headers:{apikey:key,Authorization:'Bearer '+bearer,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {status:res.status,data:await res.json().catch(()=>null)};
}
async function user(label){
 const email='d11-'+label+'-'+crypto.randomUUID()+'@example.invalid', password=crypto.randomBytes(24).toString('base64url');
 const c=await request('/auth/v1/admin/users',service,service,{email,password,email_confirm:true});
 assert.ok(c.status<300&&c.data?.id,'local user creation failed');
 const s=await request('/auth/v1/token?grant_type=password',anon,anon,{email,password});
 assert.ok(s.status<300&&s.data?.access_token,'local sign-in failed');
 const u=await request('/auth/v1/user',anon,s.data.access_token,undefined,'GET');
 assert.equal(u.data?.id,c.data.id);
 return {id:c.data.id,token:s.data.access_token};
}
const a=await user('author'), b=await user('operator'), c=await user('inactive');
for(const u of [a,b,c])assert.match(u.id,/^[0-9a-f-]{36}$/);
sql(`INSERT INTO public.app_users VALUES ('${a.id}','${a.id}','Administrador',true),('${b.id}','${b.id}','Administrador',true),('${c.id}','${c.id}','Administrador',false);
INSERT INTO public.app_admin_capabilities(auth_user_id,capability) VALUES ('${a.id}','shopee_manage_cycle_policy'),('${b.id}','provision_users'),('${c.id}','shopee_manage_cycle_policy');`);
assert.equal(sql("SELECT has_column_privilege('d11_policy_author','public.shopee_oauth_connections','fixture_ciphertext','SELECT')"),'f');
const account='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const config=JSON.parse(sql('SELECT public.d11_fixture_config()'));
const payload={p_account:account,p_expected_revision:0,p_request:crypto.randomUUID(),p_operation:'configure',p_config:config,p_evidence:'fixture/real-auth'};
const rpc=(token,key=anon,args=payload)=>request('/rest/v1/rpc/append_shopee_cycle_policy_revision',key,token,args);
assert.ok((await rpc(anon)).status>=400);
assert.ok((await rpc(service,service)).status>=400);
for(const u of [b,c]){
 const x=await rpc(u.token);assert.equal(x.status,200);assert.equal(x.data.status,'author_refused');
}
const forged=await request('/auth/v1/user',anon,b.token,{data:{role:'Administrador',shopee_manage_cycle_policy:true}},'PUT');
assert.ok(forged.status<300);
assert.equal((await rpc(b.token)).data.status,'author_refused');
assert.equal((await rpc(a.token,anon,{...payload,p_config:{...config,authorized_by:b.id}})).data.status,'invalid_request');
const x=await rpc(a.token);assert.equal(x.status,200);assert.equal(x.data.status,'recorded');
assert.equal(sql("SELECT authorized_by FROM public.shopee_cycle_policy_revisions"),a.id);
assert.equal((await rpc(a.token)).data.status,'already_recorded');
assert.equal((await rpc(a.token,anon,{...payload,p_evidence:'fixture/collision'})).data.status,'request_collision');
for(const u of [a,b,c]){
 const r=await request('/rest/v1/shopee_cycle_policy_revisions?select=revision',anon,u.token,undefined,'GET');
 assert.ok(r.status>=400 || (Array.isArray(r.data)&&r.data.length===0));
 const w=await request('/rest/v1/shopee_cycle_policy_revisions',anon,u.token,{channel_account_id:account,revision:99});
 assert.ok(w.status>=400);
}
const pause={...payload,p_expected_revision:1,p_request:crypto.randomUUID(),p_operation:'pause',p_config:null,p_evidence:'fixture/pause'};
assert.equal((await rpc(a.token,anon,pause)).data.status,'recorded');
assert.equal(sql("SELECT enabled::text||':'||paused::text FROM public.shopee_cycle_policy_revisions ORDER BY revision DESC LIMIT 1"),'false:true');
sql(`UPDATE public.app_admin_capabilities SET active=false,revoked_at=now() WHERE auth_user_id='${a.id}' AND capability='shopee_manage_cycle_policy';`);
assert.equal((await rpc(a.token,anon,{...payload,p_expected_revision:2,p_request:crypto.randomUUID()})).data.status,'author_refused');
assert.equal(sql('SELECT count(*) FROM public.shopee_cycle_policy_revisions'),'2');
console.log('PASS real local GoTrue/PostgREST: actual JWT author, RLS, spoof denial, dedicated capability, replay, pause, stale JWT after grant revocation; no Shopee calls');
