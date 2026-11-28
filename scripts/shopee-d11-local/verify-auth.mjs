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
assert.equal(sql("SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='d11_policy_private.append_revision(uuid,integer,uuid,text,jsonb,text)'::regprocedure"),'d11_policy_author');
assert.equal(sql("SELECT has_schema_privilege('d11_policy_author','d11_policy_private','CREATE')"),'f');
assert.equal(sql("SELECT rolcanlogin OR rolsuper OR rolbypassrls FROM pg_roles WHERE rolname='d11_policy_author'"),'f');
assert.equal(sql("SELECT pg_has_role(current_user,'d11_policy_author','SET')"),'f');
assert.equal(sql("SELECT pg_has_role(current_user,'d11_policy_author','USAGE')"),'f');
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
// Exercise the consolidated observation and claim RPCs through real local
// PostgREST role checks, with synthetic Raw and no network to Shopee.
const sn='D11SYNTHETIC1', pkg='PKG1', hash='a'.repeat(64);
const detail={response:{order_list:[{order_sn:sn,create_time:Math.floor(Date.now()/1000)-120,
 order_status:'READY_TO_SHIP',split_up:false,total_amount:20,payment_method:'Pix',message_to_seller:'fixture packing note',
 item_list:[{item_id:123,model_id:456,model_quantity_purchased:2,model_discounted_price:10}],package_list:[{package_number:pkg,logistics_status:'LOGISTICS_READY'}]}]}};
sql(`INSERT INTO public.shopee_cycle_orders(channel_account_id,order_sn) VALUES ('${account}','${sn}');
INSERT INTO public.marketplace_raw_snapshots(channel_account_id,source,environment,external_entity_type,endpoint,external_entity_id,payload,payload_hash,observed_at)
 VALUES ('${account}','shopee_open_platform','live','order','/api/v2/order/get_order_detail','${sn}','${JSON.stringify(detail)}','${hash}',clock_timestamp()-interval '1 minute');`);
const effect=(name,args,token=service,key=service)=>request('/rest/v1/rpc/'+name,key,token,args);
const lease=await effect('acquire_shopee_cycle',{p_channel_account_id:account});
assert.equal(lease.status,200);assert.equal(lease.data.status,'acquired');
assert.equal(lease.data.policy_revision,1);
const started=sql('SELECT clock_timestamp()');
const received=sql('SELECT clock_timestamp()');
const record={p_account:account,p_lease:lease.data.lease_id,p_revision:1,p_shop:123,p_order:sn,
 p_hash:hash,p_payload:detail,p_request:'fixture-real-auth-1',p_started:started,p_received:received};
for(const token of [anon,a.token,b.token,c.token])
 assert.ok((await effect('record_shopee_cycle_observation',record,token,anon)).status>=400);
const rec=await effect('record_shopee_cycle_observation',record);
assert.equal(rec.status,200);assert.equal(rec.data.status,'observation_recorded');
// The same consolidated local schema now includes the transactional commercial
// fence. The canonical order must come from the actual writer, not a preseed.
const projection={channel_account_id:account,marketplace_account:'D11 synthetic A',order_number:sn,
 order_date:new Date(detail.response.order_list[0].create_time*1000).toISOString().slice(0,10),
 total_value:20,payment_method:'Pix',external_status:'READY_TO_SHIP',buyer_message:'fixture packing note',
 items:[{product_id:'92088a70-8cc0-40ef-a39d-564603df6866',variant_id:null,quantity:6,commercial_quantity:2,
 physical_multiplier:3,unit_price:10,item_id:'123',model_id:'456',mapping_id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',composition_position:0},
 {product_id:'6f43ad65-74d5-4db9-b931-1ecd6d124987',variant_id:null,quantity:4,commercial_quantity:2,
 physical_multiplier:2,unit_price:0,item_id:'123',model_id:'456',mapping_id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',composition_position:1}]};
const intake={p_account:account,p_lease:lease.data.lease_id,p_revision:1,p_observation:rec.data.observation_id,p_projection:projection};
assert.equal(sql("SELECT md5(pg_get_functiondef('public.create_shopee_api_order(jsonb,jsonb)'::regprocedure))"),'330a7966a1c0143d4b9fc82229bf9013');
assert.equal(sql("SELECT prosecdef FROM pg_proc WHERE oid='public.commit_shopee_d11_intake(uuid,uuid,integer,uuid,jsonb)'::regprocedure"),'f');
for(const token of [anon,a.token,b.token,c.token]){
 assert.ok((await effect('commit_shopee_d11_intake',intake,token,anon)).status>=400);
 assert.ok((await effect('create_shopee_api_order',{p_order:projection,p_items:projection.items},token,anon)).status>=400);
}
const before=()=>sql("SELECT count(*) FROM public.orders WHERE channel_account_id='"+account+"'");
assert.equal(before(),'0');
assert.equal((await effect('commit_shopee_d11_intake',{...intake,p_observation:crypto.randomUUID()})).data.status,'intake_observation_refused');
const invalid={...projection,items:[{...projection.items[0],quantity:7},projection.items[1]]};
assert.equal((await effect('commit_shopee_d11_intake',{...intake,p_projection:invalid})).data.status,'intake_composition_refused');
assert.equal(before(),'0');
const written=await effect('commit_shopee_d11_intake',intake);
assert.equal(written.status,200);assert.equal(written.data?.status,'intake_written');
assert.equal(written.data.observation_id,rec.data.observation_id);
const oid=written.data.order_id;
assert.match(oid,/^[0-9a-f-]{36}$/);assert.match(written.data.separation_id,/^[0-9a-f-]{36}$/);
assert.equal(before(),'1');
assert.equal(sql("SELECT count(*)||':'||sum(quantity)||':'||round(sum(quantity*unit_price),2) FROM public.order_items WHERE order_id='"+oid+"'"),'2:10:20.00');
assert.equal(sql("SELECT marketplace_metadata->>'buyer_message' FROM public.orders WHERE id='"+oid+"'"),'fixture packing note');
assert.equal(sql("SELECT count(*) FROM public.order_separation WHERE order_id='"+oid+"' AND separation_status='todo'"),'1');
assert.equal((await effect('commit_shopee_d11_intake',intake)).data.status,'intake_existing_requires_reconciliation');
assert.equal(before(),'1');
console.log('PASS local consolidated commercial intake RPC: actual JWT refusal, exact receipt, composition, existing writer, one order and separation, replay denial');
const fence={p_channel_account_id:account,p_lease_id:lease.data.lease_id,p_revision:1,p_action:'ship',
 p_shop_id:123,p_order_sn:sn,p_package_number:pkg,p_request_hash:'b'.repeat(64),p_observation_id:rec.data.observation_id};
assert.ok((await effect('claim_shopee_cycle_effect',fence,a.token,anon)).status>=400);
assert.equal((await effect('claim_shopee_cycle_effect',{...fence,p_observation_id:crypto.randomUUID()})).data.status,'policy_observation_refused');
const claim=await effect('claim_shopee_cycle_effect',fence);
assert.equal(claim.status,200);assert.equal(claim.data.status,'claimed');assert.equal(claim.data.fresh,true);
assert.equal((await effect('claim_shopee_cycle_effect',fence)).data.status,'already_claimed');
assert.equal(sql('SELECT count(*) FROM public.shopee_shipping_arrangement_attempts'),'1');
const pause={...payload,p_expected_revision:1,p_request:crypto.randomUUID(),p_operation:'pause',p_config:null,p_evidence:'fixture/pause'};
assert.equal((await rpc(a.token,anon,pause)).data.status,'recorded');
assert.equal(sql("SELECT enabled::text||':'||paused::text FROM public.shopee_cycle_policy_revisions ORDER BY revision DESC LIMIT 1"),'false:true');
assert.equal((await effect('claim_shopee_cycle_effect',fence)).data.status,'policy_admission_refused');
assert.equal((await effect('commit_shopee_d11_intake',intake)).data.status,'intake_scope_refused');
assert.equal(before(),'1');
assert.equal(sql('SELECT count(*) FROM public.shopee_shipping_arrangement_attempts'),'1');
console.log('PASS local consolidated observation/claim RPC: service-only, exact receipt, duplicate and pause denial');
sql(`UPDATE public.app_admin_capabilities SET active=false,revoked_at=now() WHERE auth_user_id='${a.id}' AND capability='shopee_manage_cycle_policy';`);
assert.equal((await rpc(a.token,anon,{...payload,p_expected_revision:2,p_request:crypto.randomUUID()})).data.status,'author_refused');
assert.equal(sql('SELECT count(*) FROM public.shopee_cycle_policy_revisions'),'2');
console.log('PASS real local GoTrue/PostgREST: actual JWT author, RLS, spoof denial, dedicated capability, replay, pause, stale JWT after grant revocation; no Shopee calls');
