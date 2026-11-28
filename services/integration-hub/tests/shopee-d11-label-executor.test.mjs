import test from 'node:test';
import assert from 'node:assert/strict';
import {createD11LabelExecutor} from '../src/shopee-d11-label-executor.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',L='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',I='cccccccc-cccc-4ccc-8ccc-cccccccccccc',O='dddddddd-dddd-4ddd-8ddd-dddddddddddd',T='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',S='D11SYNTHETIC1',N=Date.parse('2026-11-28T12:00:00Z');
const scope={accountId:A,leaseId:L,revision:1},iso=n=>new Date(n).toISOString();
const pdf=Buffer.from('%PDF-1.4\n1 0 obj\nendobj\n%%EOF\n');
const success=payload=>({response:{ok:true},payload:{error:'',response:payload}});
function fixture(){
 const f={calls:[],flag:'true',status:'READY',orderStatus:'PROCESSED',packageNumber:'PKG1',logistics:'LOGISTICS_REQUEST_CREATED',effect:{status:'effect_scope',effect:'label',...scope,observationId:I,shopId:123,orderSn:S,packageNumber:'PKG1',splitUp:false,fiscalMode:'cpf_no_invoice_step',expiresAt:iso(N+120000),workBudgetMs:48000}};
 f.run=createD11LabelExecutor({enabled:true,now:()=>N,getEnv:k=>({SHOPEE_D11_LABEL_EXECUTOR_ENABLED:f.flag,SHOPEE_LIVE_PARTNER_KEY:'fixture',SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY:'fixture'})[k],
 adapters:{
  readScope:async()=>({ok:true,...scope,partnerId:2047685,shopId:123,orderSn:S,workBudgetMs:48000,expiresAt:iso(N+120000)}),
  readEffectScope:async()=>f.effect,
  claimEffect:async p=>{f.calls.push('claim');assert.equal(p.effect,'label');assert.equal(p.observationId,I);f.hash=p.requestHash;if(f.pause)f.effect=null;return f.denyClaim?null:{status:'claimed',fresh:true,attempt_id:T};},
  resolveEffect:async p=>{f.calls.push('resolve:'+p.outcome);assert.equal(p.attemptId,T);assert.equal(p.requestHash,f.hash);return {status:'resolved',state:p.outcome};}
 },
 reconcile:async()=>({ok:true,code:'d11_preflight_verified_existing',accountId:A,orderSn:S,orderId:O,observationId:I,ordersWritten:0,effects:0,effectAuthorized:false}),
 readConnection:async()=>({ok:true,payload:{shop_id:123,partner_id:2047685,access_token_expires_at:iso(N+120000),access_token_ciphertext:'fixture'}}),
 readDetail:async()=>success({order_list:[{order_sn:S,order_status:f.orderStatus,split_up:false,package_list:[{package_number:f.packageNumber,logistics_status:f.logistics}]}]}),
 call:async({action,data})=>{f.calls.push(action);assert.equal(data.channel_account_id,A);assert.equal(data.package_number,'PKG1');assert.equal(data.file_size,pdf.length);
  return action.endsWith('.prepare')?{ok:true,payload:{status:'ok',upload_url:'https://xkskyutmtlhivvpfxkjg.supabase.co/storage/v1/object/upload/sign/shopee-labels/a.pdf?token=fixture'}}:
   f.loseCommit?null:{ok:true,payload:{status:'ok',document_id:O}};
 },
 uploadFetch:async()=>{f.calls.push('upload');return {ok:true};},
 fetchImpl:async()=>{f.calls.push('create');return new Response(JSON.stringify({error:'',response:{result_list:[{order_sn:S,package_number:'PKG1'}]}}),{status:200});},
 labelOptions:{decryptToken:async()=> 'fixture',
  readParameter:async()=>success({result_list:[{order_sn:S,package_number:'PKG1',selectable_shipping_document_type:['NORMAL_AIR_WAYBILL']}]}),
  readDocumentResult:async()=>f.status==='MISSING'?{response:{ok:true},payload:{error:'logistics.shipping_document_should_print_first'}}:success({result_list:[{order_sn:S,package_number:'PKG1',status:f.status}]}),
  readTracking:async()=>success({tracking_number:'TRACK1'}),
  createDocument:async d=>{const r=await d.fetchImpl('https://partner.shopeemobile.com/api/v2/logistics/create_shipping_document',{method:'POST'});return {response:r,payload:await r.json()};},
  downloadDocument:async()=>{f.calls.push('download');return {response:new Response(pdf,{headers:{'content-type':'application/pdf'}})};}
 }});
 return f;
}
test('D11 existing synchronizer creates one protected task, then waits without another create',async()=>{
 const f=fixture();f.status='MISSING';const r=await f.run(scope);
 assert.equal(r.code,'document_task_created_check_later');assert.equal(r.effects,1);assert.equal(r.reconciliationRequired,false);
 assert.deepEqual(f.calls,['claim','create','resolve:succeeded']);
 f.calls=[];f.status='PROCESSING';assert.equal((await f.run(scope)).code,'document_processing');assert.deepEqual(f.calls,[]);
});
test('D11 READY PDF uses exact existing private storage prepare/upload/commit, no new claim',async()=>{
 const f=fixture(),r=await f.run(scope);assert.equal(r.ok,true);assert.equal(r.documentId,O);assert.equal(r.effects,0);
 assert.deepEqual(f.calls,['download','shopee.shipping_label.prepare','upload','shopee.shipping_label.commit']);
});
test('D11 default off, unorganized or changed package cannot create or attach',async()=>{
 for(const change of [f=>f.flag='false',f=>f.orderStatus='READY_TO_SHIP',f=>f.packageNumber='OTHER',f=>f.logistics='LOGISTICS_READY']){
 const f=fixture();change(f);assert.equal((await f.run(scope)).ok,false);assert.deepEqual(f.calls,[]);}
});
test('D11 lost claim or pause after claim cannot repeat document creation',async()=>{
 const f=fixture();f.status='MISSING';f.denyClaim=true;const r=await f.run(scope);assert.equal(r.reconciliationRequired,true);assert.equal(r.effects,null);assert.deepEqual(f.calls,['claim']);
 const g=fixture();g.status='MISSING';g.pause=true;const t=await g.run(scope);assert.equal(t.reconciliationRequired,true);assert.deepEqual(g.calls,['claim','resolve:uncertain']);
});
test('D11 uncertain attachment retains reconciliation obligation',async()=>{
 const f=fixture();f.loseCommit=true;const r=await f.run(scope);assert.equal(r.ok,false);assert.equal(r.reconciliationRequired,true);
 assert.deepEqual(f.calls,['download','shopee.shipping_label.prepare','upload','shopee.shipping_label.commit']);
});
