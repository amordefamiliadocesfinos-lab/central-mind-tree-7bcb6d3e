import { createShopeeLabelSynchronizer } from './shopee-live-label.mjs';
import { readLiveShopeeOauthConnection, readShopeeLogisticsTombstones } from './core-bridge.mjs';
import { createShopeeLiveLogisticsInspector } from './shopee-live-logistics.mjs';

// C7 first real-order label proof: only after Shopee itself reports an already
// organized single package. Same Adão synchronizer and durable Core document claim.
export const CELIVIO_C7_ORDER_SN='2611258Y00VM5U';
export const CELIVIO_C7_ACCOUNT_ID='d26c7a30-aa4a-4441-8012-600d70453689';
export const CELIVIO_C7_SHOP_ID=1357031949;
const PARTNER_ID=2047685;
const AIRWAYBILL='NORMAL_AIR_WAYBILL';
const safeCode=v=>typeof v==='string' && /^[a-z][a-z0-9_]{0,79}$/.test(v)?v:'label_unavailable';

export function createCelivioC7LabelSync({
  getEnv=k=>process.env[k],
  readTombstones=readShopeeLogisticsTombstones,
  readConnection=readLiveShopeeOauthConnection,
  makeInspector=createShopeeLiveLogisticsInspector,
  makeSync=createShopeeLabelSynchronizer,
}={}){
  return async function syncCelivioC7Label(){
    if(getEnv('SHOPEE_CELIVIO_C7_LABEL_SYNC_ENABLED')!=='true')
      return {ok:false,code:'celivio_c7_label_disabled'};
    if(getEnv('SHOPEE_LIVE_CHANNEL_ACCOUNT_ID')!==CELIVIO_C7_ACCOUNT_ID
      || Number(getEnv('SHOPEE_LIVE_PARTNER_ID'))!==PARTNER_ID)
      return {ok:false,code:'celivio_c7_identity_mismatch'};
    const tombstones=await readTombstones({
      channel_account_id:CELIVIO_C7_ACCOUNT_ID,order_sns:[CELIVIO_C7_ORDER_SN],
    },{timeoutMs:12_000});
    if(!tombstones?.ok || !Array.isArray(tombstones.payload?.deleted_order_sns))
      return {ok:false,code:'tombstone_unavailable'};
    if(tombstones.payload.deleted_order_sns.includes(CELIVIO_C7_ORDER_SN))
      return {ok:false,code:'order_deleted'};

    // Live identity before any document writer. No OAuth refresh or ship_order.
    const inspect=makeInspector({getEnv});
    const live=await inspect({orderSn:CELIVIO_C7_ORDER_SN});
    if(!live?.ok || Number(live.shop_id)!==CELIVIO_C7_SHOP_ID)
      return {ok:false,code:'live_inspection_unavailable'};
    const order=live.order??{};
    const results=live.shipping_document_parameter?.results;
    const packageNumber=order.package_number;
    if(order.order_sn!==CELIVIO_C7_ORDER_SN
      || order.order_status!=='PROCESSED'
      || order.package_count!==1
      || !/^[A-Za-z0-9_-]{1,100}$/.test(String(packageNumber??''))
      || order.package_logistics_status!=='LOGISTICS_REQUEST_CREATED'
      || order.invoice_status==='pending'
      || live.shipping_document_parameter?.ok!==true
      || !Array.isArray(results) || results.length!==1
      || results[0]?.order_sn!==CELIVIO_C7_ORDER_SN
      || results[0]?.package_number!==packageNumber
      || !results[0]?.selectable_shipping_document_type?.includes(AIRWAYBILL))
      return {ok:false,code:'celivio_c7_label_not_ready'};
    const scopedEnv=k=>{
      if(k==='SHOPEE_LIVE_CHANNEL_ACCOUNT_ID')return CELIVIO_C7_ACCOUNT_ID;
      if(k==='SHOPEE_LIVE_LABEL_ORDER_SN')return CELIVIO_C7_ORDER_SN;
      if(k==='SHOPEE_LIVE_LABEL_SHOP_ID')return String(CELIVIO_C7_SHOP_ID);
      if(k==='SHOPEE_LIVE_LABEL_PACKAGE_NUMBER')return packageNumber;
      return getEnv(k);
    };
    const sync=makeSync({
      getEnv:scopedEnv,
      readConnection:data=>readConnection(data,{timeoutMs:12_000}),
      prepareMissingDocument:true,
    });
    const result=await sync();
    if(!result?.ok)return {ok:false,code:safeCode(result?.code)};
    if(!['label_attached','already_available'].includes(result.code))
      return {ok:false,code:'unexpected_label_result'};
    return {ok:true,code:result.code,
      document_id:typeof result.document_id==='string'?result.document_id:null};
  };
}
export const syncCelivioC7LabelOnce=createCelivioC7LabelSync();
