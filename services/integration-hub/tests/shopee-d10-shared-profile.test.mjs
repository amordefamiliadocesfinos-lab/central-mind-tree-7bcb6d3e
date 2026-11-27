import test from 'node:test';
import assert from 'node:assert/strict';
import { createD10Pilot } from '../src/shopee-d10-pilot.mjs';
import { createGuardedShopeeShipOrder } from '../src/shopee-ship-order-guard.mjs';
import { handleRequest } from '../src/app.mjs';

const NOW=Date.parse('2026-11-27T15:00:00Z'), T=Math.floor(NOW/1000);
const A='11111111-1111-4111-8111-111111111111', O='NEWPILOT123', P='PKG123', SHOP=12345;
function fixture(options={}) {
 const env={SHOPEE_D10_ENABLED:'true',SHOPEE_D10_ACCOUNT_ID:A,SHOPEE_LIVE_CHANNEL_ACCOUNT_ID:A,
  SHOPEE_D10_SHOP_ID:String(SHOP),SHOPEE_LIVE_PARTNER_ID:'2047685',
  SHOPEE_D10_FISCAL_MODE:'cpf_no_invoice_step',SHOPEE_D10_WINDOW_FROM:String(T-600),
  SHOPEE_D10_WINDOW_TO:String(T-30),SHOPEE_D10_EXPIRES_AT:new Date(NOW+600000).toISOString(),
  SHOPEE_D10_SHIP_ENABLED:'true',SHOPEE_D10_LABEL_ENABLED:'true',
  SHOPEE_LIVE_PARTNER_KEY:'mock',SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY:'mock',...options.env};
 const calls=[], bodies=[], claims=[];
 const connection=async d=>{assert.equal(d.channel_account_id,A);return {ok:true,payload:{
  shop_id:options.wrongShop?999:SHOP,partner_id:2047685,access_token_expires_at:new Date(NOW+3600000).toISOString(),access_token_ciphertext:'mock'}}};
 const proof={ok:true,shop_id:SHOP,order_sn:O,package_number:P,order_status:'READY_TO_SHIP',
  package_logistics_status:'LOGISTICS_READY',fiscal:'cpf_flow_fiscal_check_passed',modes:['dropoff'],
  simple_dropoff_confirmed:true,split_up:options.split??false};
 const run=createD10Pilot({getEnv:k=>env[k],now:()=>NOW,readConnection:connection,
  decryptToken:async()=> 'mock',
  listOrders:async d=>{calls.push('list');assert.equal(d.shopId,SHOP);assert.equal(d.orderStatus,undefined);
   return {response:{ok:true},payload:{error:'',response:{more:options.more??false,
    order_list:options.multiple?[{order_sn:O},{order_sn:'OTHERORDER1'}]:[{order_sn:O}]}}}},
  detailOrders:async()=>{calls.push('detail');return {response:{ok:true},payload:{error:'',response:{order_list:[{
   order_sn:O,create_time:T-120,order_status:options.processed?'PROCESSED':'READY_TO_SHIP',
   package_list:[{package_number:P,logistics_status:options.processed?'LOGISTICS_REQUEST_CREATED':'LOGISTICS_READY'}],
   split_up:options.unknownSplit?null:(options.split??false),invoice_data:{status:'valid'},
   buyer_username:'must-not-persist',item_list:[{item_id:1,model_id:2,model_quantity_purchased:1}]}]}}}},
  readTombstones:async()=>({ok:true,payload:{deleted_order_sns:options.deleted?[O]:[]}}),
  persistSnapshot:async d=>{calls.push('raw');assert.equal(d.channel_account_id,A);assert.equal(d.external_entity_id,O);
   assert.equal(JSON.stringify(d.payload).includes('must-not-persist'),false);return {ok:true}},
  makeIntake:()=>async d=>{calls.push('commit');assert.equal(d.channelAccountId,A);assert.equal(d.expectedOrderSn,O);
   return {ok:true,selected:1,results:[{orderSn:O,status:options.mappingBlocked?'blocked':'written',write:{orderId:'mock-order'}}]}},
  makePreflight:()=>async()=>{calls.push('preflight');return proof},
  makeShip:d=>createGuardedShopeeShipOrder({...d,logDiagnostic:()=>{},decryptToken:async()=> 'mock',
   claim:async m=>{calls.push('claim');claims.push(m);return options.duplicate?{ok:false,payload:{code:'uncertain_requires_reconciliation'}}:{ok:true,payload:{status:'claimed',fresh:true,attempt_id:'mock-claim'}}},
   resolve:async m=>{calls.push('resolve');return {ok:true,payload:{status:'resolved',state:m.outcome}}},
   fetchImpl:async(_url,opt)=>{calls.push('post');bodies.push(JSON.parse(opt.body));return new Response(JSON.stringify({error:options.businessError?'error_param':'',request_id:'mock'}),{status:200})}}),
  makeLabel:()=>async()=>{calls.push('label');return {ok:true,code:'label_attached',document_id:'mock-doc'}}
 });
 return {run,calls,bodies,claims};
}
test('read-only discovery proves eligibility without writes',async()=>{
 const f=fixture();assert.equal((await f.run('inspect')).code,'d10_candidate_eligible_read_only');
 assert.deepEqual(f.calls,['list','detail','preflight']);
});
for(const split of [false,true]) test('D10 shared profile dispatch split='+split,async()=>{
 const f=fixture({split});assert.equal((await f.run('ship')).code,'ship_order_api_acknowledged_not_collected');
 assert.deepEqual(f.calls,['list','detail','preflight','raw','commit','preflight','claim','post','resolve']);
 assert.equal(f.claims[0].package_number,P);assert.equal(f.claims[0].channel_account_id,A);
 assert.equal(Object.hasOwn(f.bodies[0],'package_number'),split);
});
test('D10 fails closed for incomplete window, wrong shop, unknown split, tombstone, disabled or competing writer',async()=>{
 for(const o of [{multiple:true},{more:true},{wrongShop:true},{unknownSplit:true},{deleted:true},
  {env:{SHOPEE_D10_ENABLED:'false'}},{env:{SHOPEE_ADAO_AUTO_INTAKE_ENABLED:'true'}},
  {env:{SHOPEE_D10_SHIP_ENABLED:'false'}}]){
  const f=fixture(o);assert.equal((await f.run('ship')).ok,false);assert.equal(f.calls.includes('raw'),false);assert.equal(f.calls.includes('post'),false);
 }
});
test('mapping block, existing uncertain claim and HTTP200 business error cannot authorize repeat POST',async()=>{
 for(const o of [{mappingBlocked:true},{duplicate:true}]){
  const f=fixture(o);assert.equal((await f.run('ship')).ok,false);assert.equal(f.calls.includes('post'),false);
 }
 const f=fixture({businessError:true});assert.equal((await f.run('ship')).code,'ship_order_uncertain_requires_reconciliation');assert.equal(f.bodies.length,1);
});
test('processed order is never sent again; label is a separate action',async()=>{
 const f=fixture({processed:true});assert.equal((await f.run('ship')).ok,false);assert.equal(f.calls.includes('post'),false);
 assert.equal((await f.run('label')).code,'label_attached');assert.equal(f.calls.includes('label'),true);
});
test('D10 route rejects body/query and is default off',async()=>{
 let invoked=0;const opts={handleShopeeLive:async()=>null,getEnv:()=>undefined,runD10:async()=>{invoked++;return {ok:true}}};
 const req={path:'/internal/shopee/d10/ship',method:'POST',query:{},headers:{},body:''};
 assert.equal((await handleRequest(req,opts)).status,503);
 assert.equal((await handleRequest({...req,query:{order_sn:O}},opts)).status,400);
 assert.equal((await handleRequest({...req,body:'{}'},opts)).status,400);
 assert.equal(invoked,0);
});
