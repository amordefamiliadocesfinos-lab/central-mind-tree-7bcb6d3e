import test from 'node:test';
import assert from 'node:assert/strict';
import {createD11ShipExecutor} from '../src/shopee-d11-ship-executor.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',L='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',I='cccccccc-cccc-4ccc-8ccc-cccccccccccc',O='dddddddd-dddd-4ddd-8ddd-dddddddddddd',T='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',S='D11SYNTHETIC1';
const N=Date.parse('2026-11-28T12:00:00Z'),iso=t=>new Date(t).toISOString(),scope={accountId:A,leaseId:L,revision:1};
function fixture(){
 const f={calls:[],time:N,flag:'true',base:{ok:true,...scope,partnerId:2047685,shopId:123,orderSn:S,workBudgetMs:48000,expiresAt:iso(N+120000)},
 effect:{status:'effect_scope',effect:'ship',...scope,observationId:I,shopId:123,orderSn:S,packageNumber:'PKG1',splitUp:false,fiscalMode:'cpf_no_invoice_step',workBudgetMs:48000,expiresAt:iso(N+120000)},
 reconciliation:{ok:true,code:'d11_preflight_verified_existing',accountId:A,orderSn:S,orderId:O,observationId:I,ordersWritten:0,effects:0,effectAuthorized:false},
 proof:{ok:true,order_sn:S,shop_id:123,package_number:'PKG1',package_logistics_status:'LOGISTICS_READY',order_status:'READY_TO_SHIP',fiscal:'cpf_flow_fiscal_check_passed',simple_dropoff_confirmed:true,modes:['dropoff'],split_up:false},
 claim:{status:'claimed',fresh:true,attempt_id:T}};
 const env=k=>({SHOPEE_D11_SHIP_EXECUTOR_ENABLED:f.flag,SHOPEE_LIVE_PARTNER_KEY:'synthetic',SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY:'synthetic'})[k];
 f.run=createD11ShipExecutor({enabled:true,now:()=>f.time,getEnv:env,
 adapters:{
  readScope:async()=>f.base,
  readEffectScope:async()=>f.effect,
  claimEffect:async p=>{f.calls.push('claim');assert.equal(p.observationId,I);assert.equal(p.packageNumber,'PKG1');f.hash=p.requestHash;
   if(f.pauseAfterClaim)f.effect=null;if(f.expireAfterClaim)f.time=N+48001;return f.claim;},
  resolveEffect:async p=>{f.calls.push('resolve:'+p.outcome);assert.equal(p.attemptId,T);assert.equal(p.requestHash,f.hash);assert.equal(p.observationId,I);return f.resolveMissing?null:{status:'resolved',state:p.outcome};}
 },
 reconcile:async()=>{f.calls.push('reconcile');return f.reconciliation;},
 makePreflight:()=>async()=>{f.calls.push('preflight');return f.proof;},
 readConnection:async()=>({ok:true,payload:{shop_id:123,partner_id:2047685,access_token_expires_at:iso(N+120000),access_token_ciphertext:'fixture'}}),
 guardOptions:{decryptToken:async()=> 'synthetic',logDiagnostic:()=>{},
 ship:async p=>{assert.equal(p.omitPackageNumber,!f.effect?.splitUp);const response=await p.fetchImpl('https://partner.shopeemobile.com/api/v2/logistics/ship_order',{method:'POST'});return {response,payload:await response.json()};}},
 fetchImpl:async()=>{f.calls.push('post');if(f.transportFailure)throw Error('fixture');return new Response(JSON.stringify({error:'',request_id:'synthetic'}),{status:200});}
 });
 return f;
}
test('D11 uses existing guard and protected bound claim for one acknowledged POST, never physical delivery',async()=>{
 const f=fixture(),r=await f.run(scope);assert.equal(r.ok,true);assert.equal(r.effects,1);assert.equal(r.physicalHandoffConfirmed,false);
 assert.deepEqual(f.calls,['reconcile','preflight','claim','post','resolve:succeeded']);
});
test('D11 default-off and missing canonical reconciliation cannot claim or send',async()=>{
 const f=fixture();f.flag='false';assert.equal((await f.run(scope)).code,'d11_ship_disabled');assert.deepEqual(f.calls,[]);
 const g=fixture();g.reconciliation.ok=false;assert.equal((await g.run(scope)).ok,false);assert.deepEqual(g.calls,['reconcile']);
});
test('D11 changed package, changed split or fiscal refusal never claims',async()=>{
 for(const change of [f=>f.proof.package_number='OTHERPKG',f=>f.proof.split_up=true,f=>f.proof.fiscal='invoice_pending_in_seller_center']){
 const f=fixture();change(f);assert.equal((await f.run(scope)).ok,false);assert.deepEqual(f.calls,['reconcile','preflight']);}
});
test('D11 pause or expiry after claim prevents POST and resolves uncertain once',async()=>{
 for(const k of ['pauseAfterClaim','expireAfterClaim']){
 const f=fixture();f[k]=true;const r=await f.run(scope);assert.equal(r.ok,false);assert.equal(r.effects,1);assert.equal(r.reconciliationRequired,true);
 assert.deepEqual(f.calls,['reconcile','preflight','claim','resolve:uncertain']);}
});
test('D11 lost claim ACK, failed transport or missing resolution never retry',async()=>{
 const f=fixture();f.claim=null;const r=await f.run(scope);assert.equal(r.effects,null);assert.equal(r.reconciliationRequired,true);assert.deepEqual(f.calls,['reconcile','preflight','claim']);
 const g=fixture();g.transportFailure=true;assert.equal((await g.run(scope)).ok,false);assert.deepEqual(g.calls,['reconcile','preflight','claim','post','resolve:uncertain']);
 const h=fixture();h.resolveMissing=true;assert.equal((await h.run(scope)).ok,false);assert.deepEqual(h.calls,['reconcile','preflight','claim','post','resolve:succeeded']);
});
