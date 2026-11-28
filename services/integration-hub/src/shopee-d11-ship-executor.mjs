// D11 internal executor; no route, scheduler or production activation.
// Reuse the existing fiscal/logistics preflight and single-POST guard.
import {createD11BridgeAdapters} from './shopee-d11-bridge-adapter.mjs';
import {createD11RecurringPreflight} from './shopee-d11-recurring-preflight.mjs';
import {createGuardedShopeeShipOrder} from './shopee-ship-order-guard.mjs';
import {createShopeeShippingPreflight} from './shopee-shipping-preflight.mjs';
import {readLiveShopeeOauthConnection} from './core-bridge.mjs';
import {getOrderDetail,getShippingParameter} from './connectors/shopee-protocol.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id=v=>typeof v==='string'&&UUID.test(v);
const legacy=new Set(['8a8ad166-0317-4597-8be6-e43fb46b4d1b','b4027369-5abf-4ac1-ab24-862334fae892']);
const fail=(code,extra={})=>({ok:false,code,ordersWritten:0,effects:0,reconciliationRequired:false,physicalHandoffConfirmed:false,...extra});
export function createD11ShipExecutor({enabled=false,now=Date.now,call,getEnv=k=>process.env[k],
 adapters=createD11BridgeAdapters({enabled,call}),reconcile=createD11RecurringPreflight({enabled,now,call,adapters}),
 makeGuard=createGuardedShopeeShipOrder,makePreflight=createShopeeShippingPreflight,
 readConnection=readLiveShopeeOauthConnection,fetchImpl=globalThis.fetch,readDetail=getOrderDetail,readParams=getShippingParameter,
 guardOptions={}}={}){
 return async function run({accountId,leaseId,revision,deadline:outerDeadline=Infinity}={}){
  if(enabled!==true||getEnv('SHOPEE_D11_SHIP_EXECUTOR_ENABLED')!=='true')return fail('d11_ship_disabled');
  if(!id(accountId)||legacy.has(accountId.toLowerCase())||!id(leaseId)||!Number.isSafeInteger(revision)||revision<1)return fail('d11_ship_scope_refused');
  const scope={accountId,leaseId,revision},started=now();
  let claimAttempted=false,attemptId=null,resolved=null;
  try{
   const base=await adapters.readScope(scope);
   if(base?.ok!==true||base.accountId!==accountId||base.leaseId!==leaseId||base.revision!==revision
    ||base.partnerId!==2047685||!Number.isSafeInteger(base.workBudgetMs)||base.workBudgetMs<1||base.workBudgetMs>48000)
    return fail('d11_ship_scope_refused');
   const deadline=Math.min(outerDeadline,started+base.workBudgetMs,Date.parse(base.expiresAt)-1000);
   const within=()=>Number.isFinite(deadline)&&now()>=started&&now()<deadline;
   if(!within())return fail('d11_ship_budget_exhausted');
   // Only existing, verified canonical orders. No creation in the ship path.
   const proof=await reconcile({...scope,deadline,expectedOrderSn:base.orderSn});
   if(!within()||proof?.ok!==true||proof.code!=='d11_preflight_verified_existing'||proof.accountId!==accountId
    ||proof.orderSn!==base.orderSn||!id(proof.orderId)||!id(proof.observationId)||proof.ordersWritten!==0
    ||proof.effects!==0||proof.effectAuthorized!==false)return fail('d11_ship_reconciliation_refused');
   const pin={...scope,observationId:proof.observationId,effect:'ship'};
   const s=await adapters.readEffectScope(pin);
   if(!within()||s?.status!=='effect_scope'||s.effect!=='ship'||s.accountId!==accountId||s.leaseId!==leaseId
    ||s.revision!==revision||s.observationId!==proof.observationId||s.shopId!==base.shopId||s.orderSn!==base.orderSn
    ||typeof s.packageNumber!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(s.packageNumber)
    ||typeof s.splitUp!=='boolean'||!['cpf_no_invoice_step','pj_shopee_issuer'].includes(s.fiscalMode)
    ||Date.parse(s.expiresAt)<deadline||s.workBudgetMs!==base.workBudgetMs)return fail('d11_ship_scope_refused');
   const same=async()=>{
    if(!within())return false;
    const v=await adapters.readEffectScope(pin);
    return within()&&v?.status==='effect_scope'&&['effect','accountId','leaseId','revision','observationId','shopId','orderSn','packageNumber','splitUp','fiscalMode','expiresAt','workBudgetMs'].every(k=>v[k]===s[k]);
   };
   const env=k=>({
    SHOPEE_LIVE_CHANNEL_ACCOUNT_ID:accountId,SHOPEE_LIVE_PARTNER_ID:'2047685',
    SHOPEE_LIVE_SHIP_ORDER_ENABLED:'true',SHOPEE_LIVE_SHIPPING_PREFLIGHT_ORDER_SN:s.orderSn,
    SHOPEE_LIVE_SHIPPING_FISCAL_MODE:s.fiscalMode
   })[k]??getEnv(k);
   const scopedRead=async d=>{
    if(d?.channel_account_id!==accountId||!within())return {ok:false};
    const r=await readConnection(d,{timeoutMs:Math.max(1,Math.min(5000,deadline-now()))});
    return within()&&r?.ok&&Number(r.payload?.shop_id)===s.shopId&&Number(r.payload?.partner_id)===2047685?r:{ok:false};
   };
   const boundedFetch=async(url,opts)=>{
    if(!within())throw Error('d11_deadline');
    const u=new URL(url);
    if(u.origin!=='https://partner.shopeemobile.com')throw Error('d11_transport_origin');
    return fetchImpl(url,{...opts,redirect:'error',signal:AbortSignal.timeout(Math.max(1,Math.min(5000,deadline-now())))});
   };
   const preflight=makePreflight({getEnv:env,now,readConnection:scopedRead,
    readOrderDetail:d=>readDetail({...d,fetchImpl:boundedFetch}),
    readShippingParameter:d=>readParams({...d,fetchImpl:boundedFetch})});
   const guard=makeGuard({...guardOptions,getEnv:env,now,readConnection:scopedRead,
    automaticScope:{profileMode:'d11',channelAccountId:accountId,shopId:s.shopId,orderSn:s.orderSn,
     packageNumber:s.packageNumber,splitUp:s.splitUp,fiscalMode:s.fiscalMode,deadline},
    preflight:async()=>await same()?preflight():fail('d11_scope_changed'),
    claim:async m=>{
     if(claimAttempted||m.channel_account_id!==accountId||m.shop_id!==s.shopId||m.order_sn!==s.orderSn
      ||m.package_number!==s.packageNumber||!await same())return {ok:false};
     claimAttempted=true;
     const r=await adapters.claimEffect({...pin,shopId:s.shopId,orderSn:s.orderSn,packageNumber:s.packageNumber,requestHash:m.request_hash});
     if(r?.status!=='claimed'||r.fresh!==true||!id(r.attempt_id))return {ok:false};
     attemptId=r.attempt_id;return {ok:true,payload:r};
    },
    resolve:async m=>{
     if(!attemptId||m.attempt_id!==attemptId||resolved!==null)return {ok:false};
     const r=await adapters.resolveEffect({...pin,attemptId,requestHash:m.request_hash,outcome:m.outcome});
     if(!['resolved','already_resolved'].includes(r?.status)||r.state!==m.outcome)return {ok:false};
     resolved=r.state;return {ok:true,payload:r};
    },
    fetchImpl:async(url,opts)=>{
     // A policy pause or changed receipt after reservation prevents transport.
     if(!attemptId||!await same())throw Error('d11_claim_scope_changed');
     return boundedFetch(url,opts);
    }});
   const result=await guard();
   if(result?.ok===true&&resolved==='succeeded')return {ok:true,code:result.code,attemptId,ordersWritten:0,effects:1,physicalHandoffConfirmed:false};
   return fail(result?.code??'d11_ship_unconfirmed',{attemptId,effects:attemptId?1:claimAttempted?null:0,
    reconciliationRequired:claimAttempted,ordersWritten:0});
  }catch{return fail('d11_ship_unavailable',{attemptId,effects:attemptId?1:claimAttempted?null:0,
   reconciliationRequired:claimAttempted,ordersWritten:0});}
 };
}
