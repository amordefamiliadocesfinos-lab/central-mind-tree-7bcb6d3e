import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createShopeeLabelPreparation } from '../src/shopee-label-preparation.mjs';
import { createShippingDocument } from '../src/connectors/shopee-protocol.mjs';
import { handleRequest } from '../src/app.mjs';
import { claimShopeeShippingDocument, resolveShopeeShippingDocument } from '../src/core-bridge.mjs';
import { buildSignedHeaders, CORE_BRIDGE_URL } from '../src/core-bridge.mjs';
import { createBridgeHandler } from '../../../supabase/functions/integration-core-bridge/handler.mjs';
import { createShopeeLabelSynchronizer } from '../src/shopee-live-label.mjs';

const order='261017T5TF35CH', pkg='OFG245899610150874', account='8a8ad166-0317-4597-8be6-e43fb46b4d1b';
const id='123e4567-e89b-42d3-a456-426614174000';
const baseTime=Date.parse('2026-10-16T22:00:00Z');
const env={ SHOPEE_LIVE_LABEL_CREATE_ENABLED:'true',SHOPEE_LIVE_LABEL_SYNC_ENABLED:'true',
  SHOPEE_LIVE_LABEL_ORDER_SN:order,SHOPEE_LIVE_LABEL_PACKAGE_NUMBER:pkg,SHOPEE_LIVE_LABEL_SHOP_ID:'531736366',
  SHOPEE_LIVE_CHANNEL_ACCOUNT_ID:account,SHOPEE_LIVE_PARTNER_ID:'2047685',SHOPEE_LIVE_PARTNER_KEY:'synthetic-key',
  SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY:'synthetic-encryption',SHOPEE_LIVE_LABEL_CREATE_WINDOW_EXPIRES_AT:'2026-10-16T22:15:00Z' };
const api = response => ({response:{ok:true,status:200},payload:{error:'',response}});
const row = (extra={}) => ({order_sn:order,package_number:pkg,...extra});
const missing = () => ({response:{ok:true},payload:{error:'logistics.shipping_document_should_print_first'}});
function fixture(overrides={}, pilot={order,pkg}) {
  const {order,pkg}=pilot;
  const row=(extra={})=>({order_sn:order,package_number:pkg,...extra});
  const scopedEnv={...env,SHOPEE_LIVE_LABEL_ORDER_SN:order,SHOPEE_LIVE_LABEL_PACKAGE_NUMBER:pkg};
  const calls=[];let clock=baseTime,resultCalls=0;
  const deps={getEnv:k=>scopedEnv[k],now:()=>clock,sleep:async ms=>{calls.push(['sleep',ms]);clock+=ms;},
    readConnection:async()=>{calls.push(['oauth']);return {ok:true,payload:{partner_id:2047685,shop_id:531736366,
      access_token_expires_at:'2026-10-17T02:00:00Z',access_token_ciphertext:'secret-ciphertext'}};},
    decryptToken:async()=> 'secret-token',
    readDetail:async()=>{calls.push(['detail']);return api({order_list:[{order_sn:order,order_status:'PROCESSED',
      invoice_data:{status:'valid'},package_list:[{package_number:pkg,logistics_status:'LOGISTICS_REQUEST_CREATED'}]}]});},
    readParameter:async()=>{calls.push(['parameter']);return api({result_list:[row({selectable_shipping_document_type:['NORMAL_AIR_WAYBILL']})]});},
    readTracking:async()=>{calls.push(['tracking']);return api({tracking_number:pilot.tracking??'BR123456789'});},
    claim:async m=>{calls.push(['claim',m]);return {ok:true,payload:{status:'claimed',fresh:true,attempt_id:id}};},
    createDocument:async()=>{calls.push(['create']);return api({result_list:[row()]});},
    resolve:async m=>{calls.push(['resolve',m]);return {ok:true,payload:{status:'resolved',state:m.outcome}};},
    readResult:async()=>{calls.push(['result']);return resultCalls++===0?missing():api({result_list:[row({status:'READY'})]});},
    syncLabel:async()=>{calls.push(['sync']);return {ok:true,code:'label_attached',document_id:id};},...overrides};
  return {calls,deps,run:createShopeeLabelPreparation(deps),advance:ms=>{clock+=ms;}};
}
const count=(f,name)=>f.calls.filter(c=>c[0]===name).length;

test('previous pilot is refused before any network or durable claim',async()=>{
 const previous={...env,SHOPEE_LIVE_LABEL_ORDER_SN:'261016Q0YF8VVT',SHOPEE_LIVE_LABEL_PACKAGE_NUMBER:'OFG245791336122517'};
 const f=fixture({getEnv:k=>previous[k]});
 assert.equal((await f.run()).code,'label_pilot_scope_mismatch');
 assert.deepEqual(f.calls,[]);
});

test('new pilot gates false refuse preparation before any side effect',async()=>{
 const f=fixture({getEnv:k=>k==='SHOPEE_LIVE_LABEL_CREATE_ENABLED'||k==='SHOPEE_LIVE_LABEL_SYNC_ENABLED'?'false':env[k]});
 assert.equal((await f.run()).code,'label_create_not_enabled');
 assert.deepEqual(f.calls,[]);
});

test('reused synchronizer queries only the new pilot order and package',async()=>{
 const observed=[];
 const sync=createShopeeLabelSynchronizer({getEnv:k=>env[k],now:()=>baseTime,
  readConnection:async data=>{assert.equal(data.channel_account_id,account);return {ok:true,payload:{partner_id:2047685,shop_id:531736366,access_token_expires_at:'2026-10-17T02:00:00Z',access_token_ciphertext:'synthetic'}};},
  decryptToken:async()=> 'synthetic',
  readOrderDetail:async data=>{assert.equal(data.shopId,531736366);assert.equal(data.partnerId,2047685);observed.push(data.orderSnList);return api({order_list:[{order_sn:order,package_list:[{package_number:pkg}]}]});},
  readParameter:async data=>{observed.push(data.orderList);return {response:{ok:false},payload:{error:'synthetic_stop'}};},
  downloadDocument:async()=>{assert.fail('must not download');}});
 assert.equal((await sync()).code,'document_parameter_unavailable');
 assert.deepEqual(observed,[[order],[{order_sn:order,package_number:pkg}]]);
});

test('label preparation performs tracking -> durable claim -> create -> acknowledgement -> READY -> existing sync',async()=>{
 const f=fixture();assert.equal((await f.run()).code,'label_attached');
 assert.deepEqual(f.calls.map(c=>c[0]),['oauth','detail','parameter','tracking','result','claim','create','resolve','result','sync']);
 assert.equal(f.calls.find(c=>c[0]==='resolve')[1].outcome,'succeeded');
});
for(const gate of ['SHOPEE_LIVE_LABEL_CREATE_ENABLED','SHOPEE_LIVE_LABEL_SYNC_ENABLED'])test(`${gate} absent closes before Core`,async()=>{
 const f=fixture({getEnv:k=>k===gate?undefined:env[k]});assert.equal((await f.run()).ok,false);assert.equal(f.calls.length,0);
});
for(const key of ['SHOPEE_LIVE_CHANNEL_ACCOUNT_ID','SHOPEE_LIVE_LABEL_ORDER_SN','SHOPEE_LIVE_LABEL_PACKAGE_NUMBER','SHOPEE_LIVE_LABEL_SHOP_ID','SHOPEE_LIVE_PARTNER_ID'])test(`pilot rejects changed ${key}`,async()=>{
 const f=fixture({getEnv:k=>k===key?'other':env[k]});assert.equal((await f.run()).code,'label_pilot_scope_mismatch');assert.equal(f.calls.length,0);
});
test('expired or overly long authorization window blocks without network',async()=>{
 for(const value of ['2026-10-16T21:59:00Z','2026-10-16T23:00:00Z','invalid','2026-02-30T22:10:00Z']) {
  const f=fixture({getEnv:k=>k==='SHOPEE_LIVE_LABEL_CREATE_WINDOW_EXPIRES_AT'?value:env[k]});assert.equal((await f.run()).code,'label_window_inactive');assert.equal(f.calls.length,0);
 }
});
test('connection identity, expiration and Core failures prohibit creation',async()=>{
 for(const payload of [{shop_id:1,partner_id:2047685},{shop_id:531736366,partner_id:1},{shop_id:531736366,partner_id:2047685,access_token_expires_at:'2020-01-01T00:00:00Z'}]){
  const f=fixture({readConnection:async()=>({ok:true,payload})});assert.equal((await f.run()).ok,false);assert.equal(count(f,'create'),0);
 }
 const f=fixture({readConnection:async()=>{throw Error('secret-token');}});assert.equal((await f.run()).code,'label_preparation_unavailable');
});
test('wrong package, unarranged order, pending NF-e and multiple packages block',async()=>{
 for(const o of [{order_sn:'other'},{order_status:'READY_TO_SHIP'},{invoice_data:{status:'pending'}},{package_list:[]},{package_list:[{package_number:pkg,logistics_status:'LOGISTICS_READY'}]}]){
  const f=fixture({readDetail:async()=>api({order_list:[{order_sn:order,order_status:'PROCESSED',invoice_data:{status:'valid'},package_list:[{package_number:pkg,logistics_status:'LOGISTICS_REQUEST_CREATED'}],...o}]})});
  assert.equal((await f.run()).ok,false);assert.equal(count(f,'claim'),0);
 }
});
test('missing tracking or normal document type never reserves',async()=>{
 for(const overrides of [{readTracking:async()=>api({tracking_number:''})},{readParameter:async()=>api({result_list:[row({selectable_shipping_document_type:['THERMAL_AIR_WAYBILL']})]})}]){
  const f=fixture(overrides);assert.equal((await f.run()).ok,false);assert.equal(count(f,'claim'),0);
 }
});
test('READY already exists: sync only, no task creation or reservation',async()=>{
 const f=fixture({readResult:async()=>api({result_list:[row({status:'READY'})]})});assert.equal((await f.run()).ok,true);assert.equal(count(f,'claim'),0);assert.equal(count(f,'create'),0);
});
test('existing PROCESSING or FAILED never creates a new task',async()=>{
 for(const status of ['PROCESSING','FAILED','UNKNOWN']){const f=fixture({readResult:async()=>api({result_list:[row({status})]})});assert.equal((await f.run()).ok,false);assert.equal(count(f,'create'),0);}
});
test('item-level print-first error is accepted only for exact identity',async()=>{
 let reads=0;const f=fixture({readResult:async()=>reads++===0?api({result_list:[row({fail_error:'logistics.shipping_document_should_print_first'})]}):api({result_list:[row({status:'READY'})]})});assert.equal((await f.run()).ok,true);
 const wrong=fixture({readResult:async()=>api({result_list:[row({order_sn:'other',fail_error:'logistics.shipping_document_should_print_first'})]})});assert.equal((await wrong.run()).code,'document_status_rejected');
});
test('claim failures, pending and uncertain states never POST',async()=>{
 for(const status of ['already_claimed','uncertain_requires_reconciliation','claim_fingerprint_mismatch']){
  const f=fixture({claim:async()=>({ok:true,payload:{status,fresh:false,attempt_id:id}})});assert.equal((await f.run()).code,'document_claim_locked');assert.equal(count(f,'create'),0);
 }
});
test('already attached Core label does not duplicate the task',async()=>{
 const f=fixture({claim:async()=>({ok:false,payload:{code:'existing_document_requires_reconciliation'}})});assert.equal((await f.run()).code,'document_claim_unavailable');assert.equal(count(f,'create'),0);
});

test('creation acknowledgement accepts documented omitted package but never a different package',async()=>{
 const f=fixture({createDocument:async()=>api({result_list:[{order_sn:order}]})});assert.equal((await f.run()).ok,true);
});

test('signed POST transport timeout aborts once and resolves uncertain without retry',async()=>{
 let sends=0;const f=fixture({createDocument:createShippingDocument,fetchImpl:async(_url,opts)=>{
  sends++;assert.equal(opts.method,'POST');assert.equal(opts.redirect,'error');assert.ok(opts.signal instanceof AbortSignal);
  throw new DOMException('synthetic timeout','TimeoutError');
 }});assert.equal((await f.run()).code,'document_creation_uncertain');assert.equal(sends,1);assert.equal(count(f,'sync'),0);
});
test('acknowledged previous claim resumes read polling without POST',async()=>{
 const f=fixture({claim:async()=>({ok:true,payload:{status:'already_succeeded',fresh:false,attempt_id:id}})});assert.equal((await f.run()).ok,true);assert.equal(count(f,'create'),0);
});
test('timeout and rejected or ambiguous creation keep an uncertain permanent claim',async()=>{
 for(const createDocument of [async()=>{throw Error('secret-token');},async()=>({response:{ok:true},payload:{error:''}}),async()=>api({result_list:[row({fail_error:'logistics.error'})]}),async()=>api({result_list:[row({package_number:'other'})]})]){
  const f=fixture({createDocument});assert.equal((await f.run()).code,'document_creation_uncertain');assert.equal(f.calls.find(c=>c[0]==='resolve')[1].outcome,'uncertain');assert.equal(count(f,'sync'),0);
 }
});
test('lost Core confirmation stops before polling and download',async()=>{
 const f=fixture({resolve:async()=>{throw Error('private');}});assert.equal((await f.run()).code,'document_core_confirmation_missing');assert.equal(count(f,'result'),1);assert.equal(count(f,'sync'),0);
});
test('polling PROCESSING is bounded at four reads with 2s intervals',async()=>{
 let reads=0;const f=fixture({readResult:async()=>reads++===0?missing():api({result_list:[row({status:'PROCESSING'})]})});assert.equal((await f.run()).code,'document_processing');assert.equal(reads,5);assert.equal(count(f,'sleep'),3);assert.equal(count(f,'create'),1);assert.equal(count(f,'sync'),0);
});
test('poll errors or identity mismatch never download',async()=>{
 for(const answer of [api({result_list:[row({status:'READY',order_sn:'other'})]}),api({result_list:[row({status:'FAILED'})]}),{response:{ok:false},payload:{error:'error_auth'}}]){
  let reads=0;const f=fixture({readResult:async()=>reads++===0?missing():answer});assert.equal((await f.run()).ok,false);assert.equal(count(f,'sync'),0);
 }
});
test('window expiring during claim prevents POST and locks uncertain',async()=>{
 const f=fixture();f.deps.claim=async()=>{f.advance(50000);return {ok:true,payload:{status:'claimed',fresh:true,attempt_id:id}};};
 assert.equal((await createShopeeLabelPreparation(f.deps)()).code,'document_creation_uncertain');assert.equal(count(f,'create'),0);
});
test('concurrent attempts allow a single new task; retry cannot resend',async()=>{
 let claimed=false,creates=0,state='claimed';const claim=async()=>{if(claimed)return {ok:true,payload:{status:state==='succeeded'?'already_succeeded':'already_claimed',fresh:false,attempt_id:id}};claimed=true;return {ok:true,payload:{status:'claimed',fresh:true,attempt_id:id}};};
 const overrides={claim,createDocument:async()=>{creates++;return api({result_list:[row()]});},resolve:async()=>{state='succeeded';return {ok:true,payload:{status:'resolved',state}};}};
 const a=fixture(overrides),b=fixture(overrides);await Promise.all([a.run(),b.run()]);assert.equal(creates,1);await fixture(overrides).run();assert.equal(creates,1);
});
test('create document uses existing shop HMAC and exact POST body; extra inputs rejected',async()=>{
 let called=0;const args={apiBaseUrl:'https://partner.shopeemobile.com',partnerId:2047685,partnerKey:'synthetic-key',shopId:531736366,accessToken:'synthetic-token',timestamp:1720000000,orderSn:order,packageNumber:pkg,trackingNumber:'BR123',fetchImpl:async(url,opt)=>{
  called++;const u=new URL(url);assert.equal(u.pathname,'/api/v2/logistics/create_shipping_document');assert.equal(opt.method,'POST');assert.equal(u.searchParams.get('sign'),createHmac('sha256','synthetic-key').update('2047685/api/v2/logistics/create_shipping_document1720000000synthetic-token531736366').digest('hex'));assert.deepEqual(JSON.parse(opt.body),{order_list:[row({tracking_number:'BR123',shipping_document_type:'NORMAL_AIR_WAYBILL'})]});return new Response('{"error":"","response":{}}');}};
 await createShippingDocument(args);assert.equal(called,1);
 for(const extra of [{trackingNumber:''},{shippingDocumentType:'THERMAL_AIR_WAYBILL'},{orderSn:'bad'},{pickup:{}},{createShippingDocumentPath:'/wrong'}])assert.throws(()=>createShippingDocument({...args,...extra}));assert.equal(called,1);
});
test('private route closed by default, rejects input and sanitizes runtime errors',async()=>{
 const request={method:'POST',path:'/internal/shopee/live/logistics/label/prepare-once'};let invoked=0;
 const deps={handleShopeeLive:async()=>null,getEnv:()=>undefined,prepareShopeeLabel:async()=>{invoked++;throw Error('secret-token');}};
 assert.equal((await handleRequest(request,deps)).status,503);assert.equal(invoked,0);
 assert.equal((await handleRequest({...request,method:'GET'},deps)).status,405);
 assert.equal((await handleRequest({...request,query:{order_sn:'other'}},deps)).status,400);
 assert.equal((await handleRequest({...request,headers:{'content-length':'4'}},deps)).status,400);
 const response=await handleRequest(request,{...deps,getEnv:k=>env[k]});assert.equal(response.status,503);assert.ok(!response.body.includes('secret-token'));
});
test('document Core helpers preserve action identity and authenticate HMAC',async()=>{
 for(const [fn,action,data] of [[claimShopeeShippingDocument,'shopee.shipping_document.claim',{channel_account_id:account,shop_id:531736366,order_sn:order,package_number:pkg,document_type:'NORMAL_AIR_WAYBILL',request_hash:'a'.repeat(64)}],[resolveShopeeShippingDocument,'shopee.shipping_document.resolve',{attempt_id:id,request_hash:'a'.repeat(64),outcome:'succeeded'}]]){
  const r=await fn(data,{url:'https://xkskyutmtlhivvpfxkjg.supabase.co/functions/v1/integration-core-bridge',secret:'test-secret',fetchImpl:async(_url,opts)=>{assert.equal(JSON.parse(opts.body).action,action);assert.ok(Object.keys(opts.headers).some(k=>k.toLowerCase().includes('signature')));return new Response(JSON.stringify({request_id:opts.headers['X-Integration-Hub-Request-Id'],status:'ok'}),{headers:{'content-type':'application/json'}});},logger:()=>{}});assert.equal(r.ok,true);
 }
});

test('Core HMAC v1 document actions reject missing authentication and forged fields',async()=>{
 let dispatched=0;const bridge=createBridgeHandler({getSecret:()=> 'synthetic-secret',checkCore:async()=>true,
  executeAction:async()=>{dispatched++;return {status:200,body:{status:'ok'}};}});
 const claim={action:'shopee.shipping_document.claim',channel_account_id:account,shop_id:531736366,
  order_sn:order,package_number:pkg,document_type:'NORMAL_AIR_WAYBILL',request_hash:'a'.repeat(64)};
 const send=(payload,signed=true)=>{const body=JSON.stringify(payload);return bridge(new Request(CORE_BRIDGE_URL,{method:'POST',body,
  headers:signed?buildSignedHeaders({secret:'synthetic-secret',body,contentType:'application/vnd.painel.shopee-live-v1+json'}):{'content-type':'application/vnd.painel.shopee-live-v1+json'}}));};
 assert.equal((await send(claim,false)).status,401);assert.equal(dispatched,0);
 for(const change of [{document_type:'THERMAL_AIR_WAYBILL'},{force:true},{shop_id:-1},{package_number:null},{request_hash:'bad'}])assert.equal((await send({...claim,...change})).status,400);
 assert.equal((await send(claim)).status,200);
 assert.equal((await send({action:'shopee.shipping_document.resolve',attempt_id:id,request_hash:'a'.repeat(64),outcome:'uncertain'})).status,200);
 assert.equal(dispatched,2);
});

test('reused synchronizer pins shop/package on fresh re-read before any download or Storage',async()=>{
 for(const bad of ['shop','package']){
  let download=0;
  const sync=createShopeeLabelSynchronizer({getEnv:k=>env[k],now:()=>baseTime,
   readConnection:async()=>({ok:true,payload:{partner_id:2047685,shop_id:bad==='shop'?123:531736366,
    access_token_expires_at:'2026-10-17T02:00:00Z',access_token_ciphertext:'synthetic'}}),
   decryptToken:async()=> 'synthetic',
   readOrderDetail:async()=>api({order_list:[{order_sn:order,package_list:[{package_number:'OTHER_PACKAGE'}]}]}),
   downloadDocument:async()=>{download++;throw Error('must not download');}});
  assert.equal((await sync()).code,bad==='shop'?'label_shop_identity_mismatch':'label_package_identity_mismatch');assert.equal(download,0);
 }
});

const glucodry={order:'2610203UYY7N0T',pkg:'OFG246133145190444',tracking:'BR262168766782H'};

const faramb4={order:'2610204FARAMB4',pkg:'OFG246153907178767'};
const faramb4Row=extra=>({order_sn:faramb4.order,package_number:faramb4.pkg,...extra});
const faramb4Env={...env,SHOPEE_LIVE_LABEL_ORDER_SN:faramb4.order,SHOPEE_LIVE_LABEL_PACKAGE_NUMBER:faramb4.pkg};

test('PED-00281 exact pilot sends one signed document POST after claim, never ship_order',async()=>{
 let sends=0;
 const f=fixture({createDocument:createShippingDocument,fetchImpl:async(url,options)=>{
  sends++;
  const u=new URL(url);
  assert.equal(u.origin,'https://partner.shopeemobile.com');
  assert.equal(u.pathname,'/api/v2/logistics/create_shipping_document');
  assert.equal(u.searchParams.get('shop_id'),'531736366');
  assert.equal(options.method,'POST');assert.equal(options.redirect,'error');
  assert.ok(options.signal instanceof AbortSignal);
  assert.equal(count(f,'claim'),1);
  assert.deepEqual(JSON.parse(options.body),{order_list:[faramb4Row({
   tracking_number:'BR123456789',shipping_document_type:'NORMAL_AIR_WAYBILL'})]});
  return new Response(JSON.stringify({error:'',response:{result_list:[faramb4Row()]}}));
 }},faramb4);
 assert.equal((await f.run()).code,'label_attached');assert.equal(sends,1);
 const metadata=f.calls.find(c=>c[0]==='claim')[1];
 assert.equal(metadata.channel_account_id,account);assert.equal(metadata.shop_id,531736366);
 assert.equal(metadata.order_sn,faramb4.order);assert.equal(metadata.package_number,faramb4.pkg);
 assert.equal(metadata.document_type,'NORMAL_AIR_WAYBILL');
 assert.equal(f.calls.find(c=>c[0]==='resolve')[1].outcome,'succeeded');
 assert.equal(count(f,'sync'),1);
});

for(const gate of ['SHOPEE_LIVE_LABEL_CREATE_ENABLED','SHOPEE_LIVE_LABEL_SYNC_ENABLED'])
 for(const value of [undefined,'false'])test(`PED-00281 ${gate}=${value} blocks before network`,async()=>{
  const f=fixture({getEnv:k=>k===gate?value:faramb4Env[k]},faramb4);
  assert.equal((await f.run()).ok,false);assert.deepEqual(f.calls,[]);
 });

for(const [key,value] of Object.entries({
 SHOPEE_LIVE_CHANNEL_ACCOUNT_ID:'other',SHOPEE_LIVE_LABEL_ORDER_SN:glucodry.order,
 SHOPEE_LIVE_LABEL_PACKAGE_NUMBER:glucodry.pkg,SHOPEE_LIVE_LABEL_SHOP_ID:'1',SHOPEE_LIVE_PARTNER_ID:'1',
}))test('PED-00281 rejects mixed identity '+key,async()=>{
 const f=fixture({getEnv:k=>k===key?value:faramb4Env[k]},faramb4);
 assert.equal((await f.run()).code,'label_pilot_scope_mismatch');assert.deepEqual(f.calls,[]);
});

for(const status of ['READY','PROCESSING','FAILED'])test('PED-00281 existing '+status+' never claims or creates',async()=>{
 const f=fixture({readResult:async()=>api({result_list:[faramb4Row({status})]})},faramb4);
 assert.equal((await f.run()).code,{READY:'label_attached',PROCESSING:'document_processing',FAILED:'document_failed'}[status]);
 assert.equal(count(f,'claim'),0);assert.equal(count(f,'create'),0);
 assert.equal(count(f,'sync'),status==='READY'?1:0);
});

test('PED-00281 document timeout resolves uncertain once and locked retry never resends',async()=>{
 let sends=0;
 const f=fixture({createDocument:createShippingDocument,fetchImpl:async()=>{
  sends++;throw new DOMException('synthetic','TimeoutError');
 }},faramb4);
 assert.equal((await f.run()).code,'document_creation_uncertain');assert.equal(sends,1);
 assert.equal(count(f,'sync'),0);
 assert.equal(f.calls.find(c=>c[0]==='resolve')[1].outcome,'uncertain');
 const retry=fixture({claim:async()=>({ok:true,payload:{status:'uncertain_requires_reconciliation',fresh:false,attempt_id:id}})},faramb4);
 assert.equal((await retry.run()).code,'document_claim_locked');assert.equal(count(retry,'create'),0);
});

test('PED-00281 invalid tracking or inactive window stops before document claim',async()=>{
 for(const overrides of [
  {readTracking:async()=>api({tracking_number:''})},
  {getEnv:k=>k==='SHOPEE_LIVE_LABEL_CREATE_WINDOW_EXPIRES_AT'?'2020-01-01T00:00:00Z':faramb4Env[k]},
 ]){
  const f=fixture(overrides,faramb4);assert.equal((await f.run()).ok,false);
  assert.equal(count(f,'claim'),0);assert.equal(count(f,'create'),0);assert.equal(count(f,'sync'),0);
 }
});
test('Glucodry exact pilot creates once after durable claim and attaches READY PDF',async()=>{
 const f=fixture({},glucodry);
 assert.equal((await f.run()).code,'label_attached');
 assert.deepEqual(f.calls.map(c=>c[0]),['oauth','detail','parameter','tracking','result','claim','create','resolve','result','sync']);
 const m=f.calls.find(c=>c[0]==='claim')[1];
 assert.equal(m.order_sn,glucodry.order);assert.equal(m.package_number,glucodry.pkg);
 assert.equal(m.channel_account_id,account);assert.equal(m.shop_id,531736366);
 assert.equal(count(f,'create'),1);
});
for(const status of ['READY','PROCESSING','FAILED'])test('Glucodry existing '+status+' never creates',async()=>{
 const f=fixture({readResult:async()=>api({result_list:[{order_sn:glucodry.order,package_number:glucodry.pkg,status}]})},glucodry);
 assert.equal((await f.run()).code,{READY:'label_attached',PROCESSING:'document_processing',FAILED:'document_failed'}[status]);
 assert.equal(count(f,'claim'),0);assert.equal(count(f,'create'),0);
 assert.equal(count(f,'sync'),status==='READY'?1:0);
});
test('Glucodry uncertain creation locks claim and never syncs or repeats POST',async()=>{
 const f=fixture({createDocument:async()=>{f.calls.push(['create']);throw Error('timeout');}},glucodry);
 assert.equal((await f.run()).code,'document_creation_uncertain');
 assert.equal(count(f,'create'),1);assert.equal(count(f,'sync'),0);
 assert.equal(f.calls.find(c=>c[0]==='resolve')[1].outcome,'uncertain');
});
test('Glucodry wrong tracking blocks before result, claim and create',async()=>{
 const f=fixture({readTracking:async()=>api({tracking_number:'BR_OTHER'})},glucodry);
 assert.equal((await f.run()).code,'tracking_number_required');
 for(const step of ['result','claim','create','sync'])assert.equal(count(f,step),0);
});
for(const [key,value] of Object.entries({
 SHOPEE_LIVE_CHANNEL_ACCOUNT_ID:'other',SHOPEE_LIVE_LABEL_ORDER_SN:'ARBITRARY123',
 SHOPEE_LIVE_LABEL_PACKAGE_NUMBER:pkg,SHOPEE_LIVE_LABEL_SHOP_ID:'1',SHOPEE_LIVE_PARTNER_ID:'1'
}))test('Glucodry rejects mixed or arbitrary scope '+key,async()=>{
 const scoped={...env,SHOPEE_LIVE_LABEL_ORDER_SN:glucodry.order,SHOPEE_LIVE_LABEL_PACKAGE_NUMBER:glucodry.pkg,[key]:value};
 const f=fixture({getEnv:k=>scoped[k]},glucodry);
 assert.equal((await f.run()).code,'label_pilot_scope_mismatch');assert.deepEqual(f.calls,[]);
});
