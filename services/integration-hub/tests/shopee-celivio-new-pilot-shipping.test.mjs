import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuardedShopeeShipOrder} from '../src/shopee-ship-order-guard.mjs';
const NOW=Date.parse('2026-11-26T16:00:00Z');
const A='d26c7a30-aa4a-4441-8012-600d70453689', O='261126AB2EH6V0', P='OFG249355491866091';
const AD='b4027369-5abf-4ac1-ab24-862334fae892';
function fixture({split,enabled=true,duplicate=false,adao=false,wrongPackage=false}={}){
 const account=adao?AD:A, shop=adao?1156446003:1357031949;
 const env={
 SHOPEE_LIVE_SHIP_ORDER_ENABLED:'true',
 SHOPEE_CELIVIO_NEW_PILOT_SHIP_ENABLED:String(enabled),
 SHOPEE_LIVE_SHIPPING_PREFLIGHT_ORDER_SN:O,
 SHOPEE_LIVE_CHANNEL_ACCOUNT_ID:account,
 SHOPEE_LIVE_SHIP_ORDER_PILOT_PACKAGE_NUMBER:P,
 SHOPEE_LIVE_SHIP_ORDER_PILOT_SHOP_ID:String(shop),
 SHOPEE_LIVE_SHIPPING_FISCAL_MODE:'cpf_no_invoice_step',
 SHOPEE_LIVE_SHIP_ORDER_PILOT_ORDER_SN:O,
 SHOPEE_LIVE_SHIP_ORDER_PILOT_ACCOUNT_ID:account,
 SHOPEE_LIVE_SHIP_ORDER_PILOT_FISCAL_MODE:'cpf_no_invoice_step',
 SHOPEE_LIVE_SHIP_ORDER_WINDOW_EXPIRES_AT:new Date(NOW+600000).toISOString(),
 SHOPEE_LIVE_PARTNER_ID:'2047685',
 SHOPEE_LIVE_PARTNER_KEY:'mock',
 SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY:'mock'};
 const calls=[], bodies=[], claims=[];
 const run=createGuardedShopeeShipOrder({
 getEnv:k=>env[k],now:()=>NOW,logDiagnostic:()=>{},
 automaticScope:adao?{channelAccountId:account,shopId:shop,orderSn:O,fiscalMode:'cpf_no_invoice_step'}:null,
 preflight:async()=>({ok:true,order_sn:O,package_number:wrongPackage?'OTHER':P,shop_id:shop,package_logistics_status:'LOGISTICS_READY',order_status:'READY_TO_SHIP',fiscal:'cpf_flow_fiscal_check_passed',simple_dropoff_confirmed:true,modes:['dropoff'],split_up:split}),
 readConnection:async x=>{calls.push('oauth');assert.equal(x.channel_account_id,account);return {ok:true,payload:{shop_id:shop,partner_id:2047685,access_token_expires_at:new Date(NOW+3600000).toISOString(),access_token_ciphertext:'mock'}}},
 decryptToken:async()=> 'mock',
 claim:async x=>{calls.push('claim');claims.push(x);return duplicate?{ok:false,payload:{code:'uncertain_requires_reconciliation'}}:{ok:true,payload:{status:'claimed',fresh:true,attempt_id:'test-attempt'}}},
 resolve:async x=>{calls.push('resolve');assert.equal(x.outcome,'succeeded');return {ok:true,payload:{status:'resolved',state:'succeeded'}}},
 fetchImpl:async(url,opt)=>{calls.push('post');bodies.push(JSON.parse(opt.body));return new Response(JSON.stringify({error:'',message:'',request_id:'test'}),{status:200,headers:{'content-type':'application/json'}})}
 });
 return {run,calls,bodies,claims};
}
for(const split of [false,true]){
 test('new Celivio split='+split+' preserves Core package and exact POST semantics',async()=>{
 const f=fixture({split});assert.equal((await f.run()).ok,true);
 assert.deepEqual(f.calls,['oauth','claim','post','resolve']);
 assert.equal(f.claims[0].package_number,P);
 assert.equal(f.bodies[0].order_sn,O);
 assert.equal(Object.hasOwn(f.bodies[0],'package_number'),split);
 if(split)assert.equal(f.bodies[0].package_number,P);
 });
}
test('new Celivio unknown split, disabled gate or mismatched package blocks before claim',async()=>{
 for(const opts of [{},{split:false,enabled:false},{split:false,wrongPackage:true}]){
 const f=fixture(opts);assert.equal((await f.run()).ok,false);assert.deepEqual(f.calls,[]);
 }
});
test('new Celivio uncertain prior claim forbids new POST',async()=>{
 const f=fixture({split:false,duplicate:true});assert.equal((await f.run()).ok,false);assert.deepEqual(f.calls,['oauth','claim']);assert.equal(f.bodies.length,0);
});
test('Adão automatic path remains independent of new Celivio gate',async()=>{
 const f=fixture({split:false,enabled:false,adao:true});assert.equal((await f.run()).ok,true);assert.equal(Object.hasOwn(f.bodies[0],'package_number'),false);assert.equal(f.claims[0].channel_account_id,AD);
});
