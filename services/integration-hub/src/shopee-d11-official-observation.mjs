// D11 candidate: no route, no production recorder, no order writer.
import {getOrderDetail,parseShopeeError} from './connectors/shopee-protocol.mjs';
import {readLiveShopeeOauthConnection,upsertLiveShopeeOrderSnapshot,sha256Hex} from './core-bridge.mjs';
import {decryptShopeeToken} from './shopee-token-crypto.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SN=/^[A-Za-z0-9]{8,100}$/;
const PKG=/^[A-Za-z0-9_-]{1,100}$/;
const REQUEST=/^[A-Za-z0-9_.:-]{1,160}$/;
const legacy=new Set(['8a8ad166-0317-4597-8be6-e43fb46b4d1b','b4027369-5abf-4ac1-ab24-862334fae892']);
const fail=code=>({ok:false,code});
const fields=['item_id','model_id','item_sku','model_sku','item_name','model_name','model_quantity_purchased',
 'model_original_price','model_discounted_price','weight'];
const orderFields=['order_sn','order_status','create_time','update_time','pay_time','ship_by_date','currency',
 'total_amount','payment_method','shipping_carrier','split_up'];
function pick(o,keys){
 return Object.fromEntries(keys.filter(k=>typeof o?.[k]==='string'||typeof o?.[k]==='boolean'||
   (typeof o?.[k]==='number'&&Number.isFinite(o[k]))).map(k=>[k,o[k]]));
}
export function prepareD11Observation(detail,scope,nowMs){
 const body=detail?.payload,rows=body?.response?.order_list;
 if(detail?.response?.ok!==true||parseShopeeError(body)||!REQUEST.test(body?.request_id??'')
   ||!Array.isArray(rows)||rows.length!==1)return fail('observation_official_response_invalid');
 const o=rows[0],pkg=o?.package_list?.[0];
 if(o?.order_sn!==scope.orderSn||!Number.isSafeInteger(o.create_time)||o.create_time<=scope.historyCutoff
   ||o.create_time>Math.floor(nowMs/1000)||typeof o.split_up!=='boolean'
   ||!Array.isArray(o.package_list)||o.package_list.length!==1||!PKG.test(pkg?.package_number??'')
   ||!((o.order_status==='READY_TO_SHIP'&&pkg.logistics_status==='LOGISTICS_READY')
   ||(o.order_status==='PROCESSED'&&pkg.logistics_status==='LOGISTICS_REQUEST_CREATED')))
   return fail('observation_official_order_refused');
 if(!Array.isArray(o.item_list)||!o.item_list.length||o.item_list.length>30
   ||!o.item_list.every(i=>/^[0-9]{1,19}$/.test(String(i?.item_id??''))&&
     /^[0-9]{1,19}$/.test(String(i?.model_id??''))&&Number.isSafeInteger(Number(i?.model_quantity_purchased))
     &&Number(i.model_quantity_purchased)>0))return fail('observation_official_items_refused');
 // Keep the business projection fields already used by the normalizer.
 // No buyer/address/invoice payload, token or raw HTTP response. The official
 // request ID is deliberately outside the content hash, in the receipt.
 const order={...pick(o,orderFields),item_list:o.item_list.map(i=>pick(i,fields)),
  package_list:[pick(pkg,['package_number','logistics_status'])]};
 if(typeof o.message_to_seller==='string')order.message_to_seller=o.message_to_seller.slice(0,4000);
 const payload={response:{order_list:[order]}};
 return {ok:true,payload,requestId:body.request_id,hash:sha256Hex(JSON.stringify(payload))};
}
export function createD11OfficialObservation({
 readScope=null,recordObservation=null,now=Date.now,getEnv=k=>process.env[k],
 readConnection=readLiveShopeeOauthConnection,decryptToken=decryptShopeeToken,
 detailOrders=getOrderDetail,persistSnapshot=upsertLiveShopeeOrderSnapshot,fetchImpl=globalThis.fetch
}={}){
 return async function observe({accountId,leaseId,revision}={}){
  if(typeof readScope!=='function'||typeof recordObservation!=='function'
   ||!UUID.test(accountId??'')||!UUID.test(leaseId??'')||!Number.isSafeInteger(revision)||revision<1||legacy.has(accountId))
   return fail('observation_scope_unavailable');
  const args={accountId,leaseId,revision};
  const valid=s=>s?.ok===true&&s.accountId===accountId&&s.leaseId===leaseId&&s.revision===revision
   &&s.partnerId===2047685&&Number.isSafeInteger(s.shopId)&&s.shopId>0&&SN.test(s.orderSn??'')
   &&Number.isSafeInteger(s.historyCutoff)&&s.historyCutoff>0&&Number.isFinite(Date.parse(s.leaseStartedAt))
   &&Date.parse(s.leaseStartedAt)<=now()&&Date.parse(s.expiresAt)>now()+1000;
  try{
   const s=await readScope(args);
   if(!valid(s))return fail('observation_scope_refused');
   const same=async()=>{
    const p=await readScope(args);
    return valid(p)&&p.shopId===s.shopId&&p.orderSn===s.orderSn&&p.historyCutoff===s.historyCutoff
      &&p.leaseStartedAt===s.leaseStartedAt&&p.expiresAt===s.expiresAt;
   };
   const c=await readConnection({channel_account_id:accountId},{timeoutMs:12000});
   if(c?.ok!==true||Number(c.payload?.shop_id)!==s.shopId||Number(c.payload?.partner_id)!==s.partnerId
      ||!(Date.parse(c.payload?.access_token_expires_at)>now()+60000))return fail('observation_connection_refused');
   const partnerKey=getEnv('SHOPEE_LIVE_PARTNER_KEY'),cryptoKey=getEnv('SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY');
   if(!partnerKey||!cryptoKey)return fail('observation_runtime_unavailable');
   const accessToken=await decryptToken(c.payload.access_token_ciphertext,cryptoKey);
   if(!accessToken||!await same())return fail('observation_scope_changed');
   const started=now(), budget=Math.min(12000,Date.parse(s.expiresAt)-started-1000);
   if(budget<=0||started<Date.parse(s.leaseStartedAt))return fail('observation_budget_exhausted');
   const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),budget);
   let detail;
   try{
    detail=await detailOrders({apiBaseUrl:'https://partner.shopeemobile.com',
     orderDetailPath:'/api/v2/order/get_order_detail',partnerId:s.partnerId,partnerKey,accessToken,shopId:s.shopId,
     orderSnList:[s.orderSn],responseOptionalFields:['item_list','package_list','split_up','total_amount',
      'pay_time','ship_by_date','payment_method','shipping_carrier','message_to_seller'],
     fetchImpl:(url,init)=>fetchImpl(url,{...init,signal:controller.signal})});
   }finally{clearTimeout(timer);}
   const received=now();
   if(controller.signal.aborted||received<started||received-started>budget)return fail('observation_budget_exhausted');
   const prepared=prepareD11Observation(detail,s,received);
   if(!prepared.ok)return prepared;
   if(!await same())return fail('observation_scope_changed');
   const raw=await persistSnapshot({channel_account_id:accountId,external_entity_id:s.orderSn,
    observed_at:new Date(received).toISOString(),payload:prepared.payload,payload_hash:prepared.hash},{timeoutMs:12000});
   if(raw?.ok!==true)return fail('observation_raw_unconfirmed');
   if(now()-received>30000||!await same())return fail('observation_scope_changed');
   // Recorder must enforce the same scope atomically in the Core. No retry
   // on missing acknowledgement; an identical Raw alone is not a receipt.
   const receipt=await recordObservation({p_account:accountId,p_lease:leaseId,p_revision:revision,
    p_shop:s.shopId,p_order:s.orderSn,p_hash:prepared.hash,p_payload:prepared.payload,
    p_request:prepared.requestId,p_started:new Date(started).toISOString(),p_received:new Date(received).toISOString()});
   if(receipt?.status!=='observation_recorded'||!UUID.test(receipt.observation_id??'')||!UUID.test(receipt.raw_id??''))
    return fail('observation_receipt_unconfirmed');
   return {ok:true,code:'observation_recorded',observationId:receipt.observation_id,rawId:receipt.raw_id,
    orderSn:s.orderSn,shopId:s.shopId,ordersWritten:0};
  }catch{return fail('observation_transport_unavailable');}
 };
}
