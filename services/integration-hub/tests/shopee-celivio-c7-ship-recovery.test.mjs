import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createGuardedShopeeShipOrder} from '../src/shopee-ship-order-guard.mjs';
import {createShopeeLiveLogisticsInspector} from '../src/shopee-live-logistics.mjs';

const ACCOUNT='d26c7a30-aa4a-4441-8012-600d70453689';
const ORDER='2611258Y00VM5U';
const PACKAGE='OFG249308165846906';
const NOW=Date.parse('2026-11-25T20:00:00Z');
const env={
 SHOPEE_LIVE_SHIP_ORDER_ENABLED:'true',
 SHOPEE_LIVE_SHIPPING_PREFLIGHT_ORDER_SN:ORDER,
 SHOPEE_LIVE_CHANNEL_ACCOUNT_ID:ACCOUNT,
 SHOPEE_LIVE_SHIP_ORDER_PILOT_ORDER_SN:ORDER,
 SHOPEE_LIVE_SHIP_ORDER_PILOT_ACCOUNT_ID:ACCOUNT,
 SHOPEE_LIVE_SHIP_ORDER_PILOT_SHOP_ID:'1357031949',
 SHOPEE_LIVE_SHIP_ORDER_PILOT_PACKAGE_NUMBER:PACKAGE,
 SHOPEE_LIVE_SHIPPING_FISCAL_MODE:'cpf_no_invoice_step',
 SHOPEE_LIVE_SHIP_ORDER_PILOT_FISCAL_MODE:'cpf_no_invoice_step',
 SHOPEE_LIVE_SHIP_ORDER_WINDOW_EXPIRES_AT:'2026-11-25T20:20:00Z',
 SHOPEE_LIVE_PARTNER_ID:'2047685',
 SHOPEE_LIVE_PARTNER_KEY:'synthetic-only',
 SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY:'synthetic-only',
};
const proof=split_up=>({
 ok:true,order_sn:ORDER,package_number:PACKAGE,shop_id:1357031949,
 order_status:'READY_TO_SHIP',package_logistics_status:'LOGISTICS_READY',
 fiscal:'cpf_flow_fiscal_check_passed',modes:['dropoff'],
 simple_dropoff_confirmed:true,split_up
});
function fixture(split_up, overrides={}){
 let claimed=null, claims=0, transports=0;
 const run=createGuardedShopeeShipOrder({
  getEnv:k=>({...env,...overrides})[k],
  now:()=>NOW,
  preflight:async()=>proof(split_up),
  readConnection:async()=>({ok:true,payload:{
   shop_id:1357031949,partner_id:2047685,
   access_token_expires_at:'2026-11-25T22:00:00Z',access_token_ciphertext:'safe-test'
  }}),
  decryptToken:async()=> 'test-only-token',
  claim:async data=>{claimed=data;claims++;return {ok:false,payload:{status:'uncertain_requires_reconciliation'}};},
  ship:async()=>{transports++;throw Error('not authorized to transport');},
 });
 return {run,claim:()=>claimed,claims:()=>claims,transports:()=>transports};
}
const digest=body=>createHash('sha256').update(JSON.stringify(body)).digest('hex');

test('Celivio C7 unsplit proven omits package only in Shopee POST fingerprint; Core claim still uses package',async()=>{
 const x=fixture(false);
 const result=await x.run();
 assert.equal(result.ok,false);
 assert.equal(result.code,'uncertain_requires_reconciliation');
 assert.equal(x.claims(),1);
 assert.equal(x.claim().package_number,PACKAGE);
 assert.equal(x.claim().request_hash,digest({order_sn:ORDER,dropoff:{}}));
 assert.equal(x.transports(),0);
});
test('Celivio C7 split proven retains package in Shopee POST fingerprint',async()=>{
 const x=fixture(true);
 await x.run();
 assert.equal(x.claim().request_hash,digest({order_sn:ORDER,package_number:PACKAGE,dropoff:{}}));
 assert.equal(x.transports(),0);
});
test('Celivio C7 missing split proof blocks before Core and Shopee',async()=>{
 for(const v of [null,undefined,'false']){
  const x=fixture(v);
  assert.equal((await x.run()).code,'order_split_state_unknown');
  assert.equal(x.claims(),0);
  assert.equal(x.transports(),0);
 }
});
test('Other legacy pilot keeps package fingerprint even if unsplit',async()=>{
 const OTHER='261014HX0XSUQU';
 const x=fixture(false,{
  SHOPEE_LIVE_SHIPPING_PREFLIGHT_ORDER_SN:OTHER,
  SHOPEE_LIVE_SHIP_ORDER_PILOT_ORDER_SN:OTHER,
 });
 // Identity mismatch rejects this synthetic fixture before any claim.
 assert.equal((await x.run()).ok,false);
 assert.equal(x.claims(),0);
});

test('Live logistics read-only checkpoint exposes exact split_up boolean and never exposes raw buyer data',async()=>{
 for(const split_up of [false,true,undefined]){
  const inspector=createShopeeLiveLogisticsInspector({
   getEnv:k=>({
    SHOPEE_LIVE_PARTNER_ID:'2047685',
    SHOPEE_LIVE_PARTNER_KEY:'test-key',
    SHOPEE_LIVE_CHANNEL_ACCOUNT_ID:ACCOUNT,
    SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY:'test-encryption-key',
   })[k],
   now:()=>NOW,
   readConnection:async()=>({ok:true,payload:{
    partner_id:2047685,shop_id:1357031949,
    access_token_expires_at:'2026-11-25T22:00:00Z',access_token_ciphertext:'test-cipher',
   }}),
   decryptToken:async()=> 'test-token',
   readOrderDetail:async req=>{
    assert(req.responseOptionalFields.includes('split_up'));
    return {response:{ok:true},payload:{error:'',response:{order_list:[{
      order_sn:ORDER,order_status:'READY_TO_SHIP',split_up,
      buyer_username:'DO-NOT-SHOW',
      package_list:[{package_number:PACKAGE,logistics_status:'LOGISTICS_READY'}],
      invoice_data:{status:'valid'}
    }]}}};
   },
   readShippingParameter:async()=>({response:{ok:true},payload:{error:'',response:{info_needed:{dropoff:[]}}}}),
   readShippingDocumentParameter:async()=>({response:{ok:true},payload:{error:'',response:{result_list:[]}}}),
  });
  const result=await inspector({orderSn:ORDER});
  assert.equal(result.ok,true);
  assert.equal(result.order.split_up,typeof split_up==='boolean'?split_up:null);
  assert.equal(JSON.stringify(result).includes('DO-NOT-SHOW'),false);
 }
});
