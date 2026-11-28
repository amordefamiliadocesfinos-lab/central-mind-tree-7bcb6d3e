// Reuse the D10-proven synchronizer; only the protected D11 scope changes.
// Internal factory, default off. No route, scheduler or direct DB writes.
import {createD11BridgeAdapters} from './shopee-d11-bridge-adapter.mjs';
import {createD11RecurringPreflight} from './shopee-d11-recurring-preflight.mjs';
import {createShopeeLabelSynchronizer} from './shopee-live-label.mjs';
import {callCoreBridgeAction,readLiveShopeeOauthConnection} from './core-bridge.mjs';
import {assessFiscalReadiness} from './shopee-shipping-preflight.mjs';
import {getOrderDetail} from './connectors/shopee-protocol.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id=v=>typeof v==='string'&&UUID.test(v);
const legacy=new Set(['8a8ad166-0317-4597-8be6-e43fb46b4d1b','b4027369-5abf-4ac1-ab24-862334fae892']);
const fail=(code,extra={})=>({ok:false,code,ordersWritten:0,effects:0,reconciliationRequired:false,physicalHandoffConfirmed:false,...extra});
const validHash=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
export function createD11LabelExecutor({enabled=false,now=Date.now,call=callCoreBridgeAction,getEnv=k=>process.env[k],
 adapters=createD11BridgeAdapters({enabled,call}),reconcile=createD11RecurringPreflight({enabled,now,call,adapters}),
 makeLabel=createShopeeLabelSynchronizer,readConnection=readLiveShopeeOauthConnection,
 readDetail=getOrderDetail,fetchImpl=globalThis.fetch,uploadFetch=globalThis.fetch,labelOptions={}}={}){
 return async function run({accountId,leaseId,revision,deadline:outerDeadline=Infinity}={}){
  if(enabled!==true||getEnv('SHOPEE_D11_LABEL_EXECUTOR_ENABLED')!=='true')return fail('d11_label_disabled');
  if(!id(accountId)||legacy.has(accountId.toLowerCase())||!id(leaseId)||!Number.isSafeInteger(revision)||revision<1)return fail('d11_label_scope_refused');
  const scope={accountId,leaseId,revision},started=now();
  let attempted=false,attemptId=null,resolved=null,commitAttempted=false,documentId=null;
  const result=(code,extra={})=>fail(code,{effects:attemptId?1:attempted?null:0,
   reconciliationRequired:(attempted&&resolved!=='succeeded')||(commitAttempted&&!documentId),...extra});
  try{
   const base=await adapters.readScope(scope);
   if(base?.ok!==true||base.accountId!==accountId||base.leaseId!==leaseId||base.revision!==revision
    ||base.partnerId!==2047685||!Number.isSafeInteger(base.workBudgetMs)||base.workBudgetMs<1||base.workBudgetMs>48000)
    return result('d11_label_scope_refused');
   const deadline=Math.min(outerDeadline,started+base.workBudgetMs,Date.parse(base.expiresAt)-1000);
   const within=()=>Number.isFinite(deadline)&&now()>=started&&now()<deadline;
   if(!within())return result('d11_label_budget_exhausted');
   const proof=await reconcile({...scope,deadline,expectedOrderSn:base.orderSn});
   if(!within()||proof?.ok!==true||proof.code!=='d11_preflight_verified_existing'||proof.accountId!==accountId
    ||proof.orderSn!==base.orderSn||!id(proof.orderId)||!id(proof.observationId)||proof.ordersWritten!==0
    ||proof.effects!==0||proof.effectAuthorized!==false)return result('d11_label_reconciliation_refused');
   const pin={...scope,observationId:proof.observationId,effect:'label'};
   const s=await adapters.readEffectScope(pin);
   if(!within()||s?.status!=='effect_scope'||s.effect!=='label'||s.accountId!==accountId||s.leaseId!==leaseId
    ||s.revision!==revision||s.observationId!==proof.observationId||s.shopId!==base.shopId||s.orderSn!==base.orderSn
    ||typeof s.packageNumber!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(s.packageNumber)
    ||typeof s.splitUp!=='boolean'||!['cpf_no_invoice_step','pj_shopee_issuer'].includes(s.fiscalMode)
    ||Date.parse(s.expiresAt)<deadline||s.workBudgetMs!==base.workBudgetMs)return result('d11_label_scope_refused');
   const same=async()=>{
    if(!within())return false;
    const v=await adapters.readEffectScope(pin);
    return within()&&v?.status==='effect_scope'&&['effect','accountId','leaseId','revision','observationId','shopId','orderSn','packageNumber','splitUp','fiscalMode','expiresAt','workBudgetMs'].every(k=>v[k]===s[k]);
   };
   const timeout=()=>Math.max(1,Math.min(5000,deadline-now()));
   const env=k=>({
    SHOPEE_LIVE_CHANNEL_ACCOUNT_ID:accountId,SHOPEE_LIVE_PARTNER_ID:'2047685',
    SHOPEE_LIVE_LABEL_ORDER_SN:s.orderSn,SHOPEE_LIVE_LABEL_SHOP_ID:String(s.shopId),
    SHOPEE_LIVE_LABEL_PACKAGE_NUMBER:s.packageNumber
   })[k]??getEnv(k);
   const exact=m=>m?.channel_account_id===accountId&&m.shop_id===s.shopId&&m.order_sn===s.orderSn&&m.package_number===s.packageNumber;
   let hash=null,staged=null;
   const scopedCore=async({action,data:m})=>{
    if(action==='shopee.shipping_document.resolve'){
     if(!attemptId||resolved!==null||m?.attempt_id!==attemptId||m.request_hash!==hash||!['succeeded','uncertain'].includes(m.outcome))return {ok:false};
     const r=await adapters.resolveEffect({...pin,attemptId,requestHash:hash,outcome:m.outcome});
     if(!['resolved','already_resolved'].includes(r?.status)||r.state!==m.outcome)return {ok:false};
     resolved=r.state;return {ok:true,payload:r};
    }
    if(!exact(m)||!await same())return {ok:false};
    if(action==='shopee.shipping_document.claim'){
     if(attempted||m.document_type!=='NORMAL_AIR_WAYBILL'||!validHash(m.request_hash))return {ok:false};
     attempted=true;hash=m.request_hash;
     const r=await adapters.claimEffect({...pin,shopId:s.shopId,orderSn:s.orderSn,packageNumber:s.packageNumber,requestHash:hash});
     if(r?.status!=='claimed'||r.fresh!==true||!id(r.attempt_id))return {ok:false};
     attemptId=r.attempt_id;return {ok:true,payload:r};
    }
    if(!['shopee.shipping_label.prepare','shopee.shipping_label.commit'].includes(action)
     ||!validHash(m.sha256)||!Number.isSafeInteger(m.file_size)||m.file_size<16||m.file_size>4194304)return {ok:false};
    if(action==='shopee.shipping_label.prepare'){
     if(staged)return {ok:false};
     const r=await call({action,data:m,timeoutMs:timeout()});
     if(r?.ok!==true||r.payload?.status!=='ok')return {ok:false};
     if(r.payload.already_exists===true){
      if(!id(r.payload.document_id))return {ok:false};
      documentId=r.payload.document_id;
     }else staged={sha256:m.sha256,file_size:m.file_size};
     return r;
    }
    if(commitAttempted||!staged||staged.sha256!==m.sha256||staged.file_size!==m.file_size)return {ok:false};
    commitAttempted=true;
    const r=await call({action,data:m,timeoutMs:timeout()});
    if(r?.ok!==true||r.payload?.status!=='ok'||!id(r.payload.document_id))return {ok:false};
    documentId=r.payload.document_id;return r;
   };
   const guardedFetch=async(url,opts)=>{
    if(!await same())throw Error('d11_label_scope_changed');
    const u=new URL(url);
    if(u.origin!=='https://partner.shopeemobile.com')throw Error('d11_label_origin');
    if(u.pathname==='/api/v2/logistics/create_shipping_document'&&!attemptId)throw Error('d11_label_claim_required');
    return fetchImpl(url,{...opts,redirect:'error',signal:AbortSignal.timeout(timeout())});
   };
   const sync=makeLabel({...labelOptions,getEnv:env,now,prepareMissingDocument:true,callCore:scopedCore,
    readConnection:async d=>{
     if(d?.channel_account_id!==accountId||!within())return {ok:false};
     const r=await readConnection(d,{timeoutMs:timeout()});
     return within()&&r?.ok&&Number(r.payload?.shop_id)===s.shopId&&Number(r.payload?.partner_id)===2047685?r:{ok:false};
    },
    readOrderDetail:async d=>{
     const r=await readDetail({...d,responseOptionalFields:[...new Set([...d.responseOptionalFields,'split_up'])]});
     const list=r?.payload?.response?.order_list,o=list?.[0],pkg=o?.package_list?.[0];
     if(!within()||list?.length!==1||o?.order_sn!==s.orderSn||o?.order_status!=='PROCESSED'||o.split_up!==s.splitUp
      ||o.package_list?.length!==1||pkg?.package_number!==s.packageNumber||pkg.logistics_status!=='LOGISTICS_REQUEST_CREATED'
      ||!assessFiscalReadiness(o,s.fiscalMode).ready)return {response:{ok:false},payload:{error:'d11_label_external_state_refused'}};
     return r;
    },
    fetchImpl:guardedFetch,
    uploadFetch:async(url,opts)=>{
     if(!staged||!await same())throw Error('d11_label_upload_scope_changed');
     return uploadFetch(url,{...opts,redirect:'error',signal:AbortSignal.timeout(timeout())});
    }});
   const r=await sync();
   if(r?.ok===true&&['already_available','label_attached'].includes(r.code)&&id(documentId)&&r.document_id===documentId)
    return {ok:true,code:r.code,documentId,ordersWritten:0,effects:attemptId?1:0,physicalHandoffConfirmed:false};
   return result(r?.code??'d11_label_unconfirmed',{attemptId});
  }catch{return result('d11_label_unavailable',{attemptId});}
 };
}
