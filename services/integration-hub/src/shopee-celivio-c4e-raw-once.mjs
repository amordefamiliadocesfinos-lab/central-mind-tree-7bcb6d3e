import { readLiveShopeeOauthConnection, upsertLiveShopeeOrderSnapshot, sha256Hex } from './core-bridge.mjs';
import { decryptShopeeToken } from './shopee-token-crypto.mjs';
import { getOrderList, getOrderDetail, parseShopeeError } from './connectors/shopee-protocol.mjs';

// C4-E: an isolated, explicitly enabled one-order Raw evidence acquisition.
// NO order writer, mapping mutation, inventory, OAuth refresh, or scheduler.
export const CELIVIO_C4E_ACCOUNT = 'd26c7a30-aa4a-4441-8012-600d70453689';
export const CELIVIO_C4E_SHOP = 1357031949;
// Pilot selected by owner from authenticated Shopee seller screenshot.
// Never accept caller-provided Order SN or silently switch to another order.
export const CELIVIO_C4E_TARGET_ORDER_SN = '261121TBS6BHE6';
const PARTNER = 2047685;
const API = 'https://partner.shopeemobile.com';
const ELIGIBLE = new Set(['PROCESSED', 'READY_TO_SHIP']);
const validSn = (v) => typeof v === 'string' && /^[A-Za-z0-9]{8,40}$/.test(v);
const validId = (v) => /^(?:0|[1-9][0-9]{0,18})$/.test(String(v ?? ''));
const validQ = (v) => Number.isSafeInteger(Number(v)) && Number(v) > 0;

export function selectCelivioEligibleOrder(listPayload) {
  const entries = listPayload?.response?.order_list;
  if (!Array.isArray(entries) || entries.length > 5) return { ok:false, code:'order_list_invalid' };
  const match = entries.find(o => ELIGIBLE.has(o?.order_status) && validSn(o?.order_sn));
  return match ? { ok:true, orderSn:match.order_sn } : { ok:false, code:'no_eligible_order_in_first_page' };
}

// Strict allowlist for Raw evidence: business fields needed for normalization,
// no buyer, address, document, phone, package, payment or shipping payloads.
// This is a redacted order-detail Raw snapshot, not an unmodified Shopee payload.
export function prepareCelivioRedactedDetail(order, orderSn) {
  if (!order || order.order_sn !== orderSn || !validSn(orderSn)
    || !ELIGIBLE.has(order.order_status)
    || !Number.isSafeInteger(Number(order.create_time)) || Number(order.create_time) < 1) {
    return {ok:false,code:'order_detail_not_eligible'};
  }
  if (!Array.isArray(order.item_list) || order.item_list.length < 1
    || order.item_list.length > 30
    || !order.item_list.every(i => validId(i?.item_id) && validId(i?.model_id)
      && validQ(i?.model_quantity_purchased))) {
    return {ok:false,code:'order_items_invalid'};
  }
  const itemList = order.item_list.map(i => ({
    item_id:String(i.item_id), model_id:String(i.model_id),
    model_quantity_purchased:Number(i.model_quantity_purchased),
    ...(typeof i.item_name === 'string' ? {item_name:i.item_name.slice(0,300)} : {}),
    ...(typeof i.model_name === 'string' ? {model_name:i.model_name.slice(0,300)} : {}),
  }));
  return {ok:true,payload:{response:{order_list:[{
    order_sn:orderSn, order_status:order.order_status,
    create_time:Number(order.create_time),
    item_list:itemList,
  }]}}};
}

export function createCelivioC4ERawOnce({
  getEnv=(name)=>process.env[name], now=Date.now,
  readConnection=readLiveShopeeOauthConnection,
  decryptToken=decryptShopeeToken,
  listOrders=getOrderList, detailOrders=getOrderDetail,
  persistSnapshot=upsertLiveShopeeOrderSnapshot,
  targetOrderSn=CELIVIO_C4E_TARGET_ORDER_SN,
}={}) {
  return async function captureOneCelivioRaw() {
    const connection=await readConnection({channel_account_id:CELIVIO_C4E_ACCOUNT});
    const c=connection?.payload;
    if (!connection?.ok || !c) return {ok:false,code:'connection_unavailable'};
    if(Number(c.shop_id)!==CELIVIO_C4E_SHOP || Number(c.partner_id)!==PARTNER)
      return {ok:false,code:'identity_mismatch'};
    const nowMs=now();
    if (!(Date.parse(String(c.access_token_expires_at ?? '')) > nowMs+60_000))
      return {ok:false,code:'access_token_expired_no_refresh'};
    const partnerKey=getEnv('SHOPEE_LIVE_PARTNER_KEY');
    const cryptoKey=getEnv('SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY');
    if(!partnerKey || !cryptoKey) return {ok:false,code:'runtime_not_configured'};
    const accessToken=await decryptToken(c.access_token_ciphertext,cryptoKey);
    const common={apiBaseUrl:API,partnerId:PARTNER,partnerKey,accessToken,shopId:CELIVIO_C4E_SHOP};
    // Exact pilot only; skip order-list discovery. Any failure blocks closed.
    if (![CELIVIO_C4E_TARGET_ORDER_SN, CELIVIO_C6_TARGET_ORDER_SN, CELIVIO_NEW_PILOT_ORDER_SN].includes(targetOrderSn))
      return {ok:false,code:'target_not_allowlisted'};
    const selected={ok:true,orderSn:targetOrderSn};
    const detail=await detailOrders({...common,
      orderDetailPath:'/api/v2/order/get_order_detail',
      orderSnList:[selected.orderSn],responseOptionalFields:['item_list'],
    });
    if(!detail?.response?.ok || parseShopeeError(detail.payload))
      return {ok:false,code:'order_detail_unavailable'};
    const orders=detail.payload?.response?.order_list;
    if(!Array.isArray(orders) || orders.length!==1)
      return {ok:false,code:'order_detail_identity_mismatch'};
    const sanitized=prepareCelivioRedactedDetail(orders[0],selected.orderSn);
    if(!sanitized.ok) return sanitized;
    // Capture at most one redacted Raw; the Core's existing ON CONFLICT
    // (account,entity,endpoint,payload_hash) ignores exact duplicates.
    const result=await persistSnapshot({
      channel_account_id:CELIVIO_C4E_ACCOUNT,
      external_entity_id:selected.orderSn,
      observed_at:new Date(now()).toISOString(),
      payload:sanitized.payload,
      payload_hash:sha256Hex(JSON.stringify(sanitized.payload)),
    });
    if(!result?.ok) return {ok:false,code:'raw_persistence_unconfirmed'};
    return {ok:true,code:'redacted_raw_persisted_or_already_present',
      account:'celivio',shop_id:CELIVIO_C4E_SHOP,
      order_sn:selected.orderSn,external_status:orders[0].order_status,
      item_count:orders[0].item_list.length,
      raw_persist_attempted:1,raw_insert_count_unverified:true,
      orders_written:0,items_written:0,separation_written:0,stock_written:0,
      pii_suppressed:true,raw_kind:'redacted_order_detail'};
  };
}
export const captureCelivioC4ERawOnce=createCelivioC4ERawOnce();

// C6: one known, unmapped-to-Raw order, selected only by reviewed code.
// Reuse the C4-E redaction, OAuth no-refresh and Core snapshot idempotency.
export const CELIVIO_C6_TARGET_ORDER_SN='2611258Y00VM5U';
export const captureCelivioC6RawOnce=createCelivioC4ERawOnce({targetOrderSn:CELIVIO_C6_TARGET_ORDER_SN});

// Owner-approved new pilot; isolated from historical routes and disabled by default.
export const CELIVIO_NEW_PILOT_ORDER_SN = '261126AB2EH6V0';
export function createCelivioNewPilotRawOnce(options = {}) {
  const getEnv = options.getEnv ?? (k => process.env[k]);
  const capture = createCelivioC4ERawOnce({...options, getEnv, targetOrderSn: CELIVIO_NEW_PILOT_ORDER_SN});
  return async () => {
    if (getEnv('SHOPEE_CELIVIO_NEW_PILOT_RAW_ENABLED') !== 'true' || getEnv('SHOPEE_LIVE_CHANNEL_ACCOUNT_ID') !== CELIVIO_C4E_ACCOUNT || getEnv('SHOPEE_LIVE_LOGISTICS_PROBE_ORDER_SN') !== CELIVIO_NEW_PILOT_ORDER_SN) return {ok:false,code:'celivio_new_pilot_scope_invalid'};
    return capture();
  };
}
export const captureCelivioNewPilotRawOnce = createCelivioNewPilotRawOnce();
