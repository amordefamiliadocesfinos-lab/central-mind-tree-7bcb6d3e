import { resolveD10Profile, d10CandidateInWindow, D10_ORDER_RE } from './shopee-d10-profile.mjs';
import { readLiveShopeeOauthConnection, readShopeeLogisticsTombstones, upsertLiveShopeeOrderSnapshot, sha256Hex, readLiveShopeeOrderIntakeBatch } from './core-bridge.mjs';
import { getOrderList, getOrderDetail, parseShopeeError } from './connectors/shopee-protocol.mjs';
import { decryptShopeeToken } from './shopee-token-crypto.mjs';
import { prepareCelivioRedactedDetail } from './shopee-celivio-c4e-raw-once.mjs';
import { createShopeeControlledAutoIntake } from './shopee-order-auto-intake.mjs';
import { createShopeeShippingPreflight, assessFiscalReadiness } from './shopee-shipping-preflight.mjs';
import { createGuardedShopeeShipOrder } from './shopee-ship-order-guard.mjs';
import { createShopeeLabelSynchronizer } from './shopee-live-label.mjs';

const API = 'https://partner.shopeemobile.com';
const PACKAGE = /^[A-Za-z0-9_-]{1,100}$/;
const safeCode = v => typeof v === 'string' && /^[a-z][a-z0-9_]{0,79}$/.test(v) ? v : 'd10_unavailable';
const failed = code => ({ok:false,code});
const good = r => r?.response?.ok === true && !parseShopeeError(r.payload);
const WRITER_FLAGS = ['SHOPEE_LIVE_COMMIT_ENABLED','SHOPEE_LIVE_AUTO_COMMIT_ENABLED',
  'SHOPEE_LIVE_CYCLE_ENABLED','SHOPEE_LIVE_SHIP_ORDER_ENABLED','SHOPEE_LIVE_SHIP_ORDER_ROUTE_ENABLED',
  'SHOPEE_LIVE_LABEL_SYNC_ENABLED','SHOPEE_LIVE_LABEL_CREATE_ENABLED','SHOPEE_LIVE_OAUTH_REFRESH_ENABLED',
  'SHOPEE_ADAO_AUTO_INTAKE_ENABLED','SHOPEE_ADAO_CYCLE_ENABLED','SHOPEE_ADAO_AUTO_SHIP_ENABLED',
  'SHOPEE_ADAO_LABEL_SYNC_ENABLED','SHOPEE_CELIVIO_C6_RAW_ONCE_ENABLED',
  'SHOPEE_CELIVIO_C7_LABEL_SYNC_ENABLED','SHOPEE_CELIVIO_NEW_PILOT_RAW_ENABLED',
  'SHOPEE_CELIVIO_NEW_PILOT_COMMIT_ENABLED','SHOPEE_CELIVIO_NEW_PILOT_SHIP_ENABLED',
  'SHOPEE_CELIVIO_NEW_PILOT_LABEL_ENABLED'];
// No caller-selected shop, order, package or time window. The private
// revision is intentionally a bounded one-order pilot, not D11 scheduling.
export function createD10Pilot({
  getEnv=k=>process.env[k], now=Date.now,
  readConnection=readLiveShopeeOauthConnection, readTombstones=readShopeeLogisticsTombstones,
  decryptToken=decryptShopeeToken, listOrders=getOrderList, detailOrders=getOrderDetail,
  persistSnapshot=upsertLiveShopeeOrderSnapshot, readBatch=readLiveShopeeOrderIntakeBatch,
  makeIntake=createShopeeControlledAutoIntake, makePreflight=createShopeeShippingPreflight,
  makeShip=createGuardedShopeeShipOrder, makeLabel=createShopeeLabelSynchronizer,
}={}) {
  return async function runD10(mode) {
    if (!['discover','inspect','ship','label'].includes(mode)) return failed('d10_mode_invalid');
    const p=resolveD10Profile(getEnv,now(),{discovery:mode==='discover'});
    if (!p) return failed('d10_profile_invalid_or_disabled');
    if (WRITER_FLAGS.some(k=>String(getEnv(k)??'').trim().toLowerCase()==='true'))
      return failed('d10_competing_writer_enabled');
    if (mode==='ship' && getEnv('SHOPEE_D10_SHIP_ENABLED')!=='true') return failed('d10_ship_disabled');
    if (mode==='label' && getEnv('SHOPEE_D10_LABEL_ENABLED')!=='true') return failed('d10_label_disabled');
    const read = data => data?.channel_account_id===p.account
      ? readConnection(data,{timeoutMs:12000}) : Promise.resolve(failed('d10_identity_mismatch'));
    const connection=await read({channel_account_id:p.account});
    const c=connection?.payload;
    if (!connection?.ok || Number(c?.shop_id)!==p.shop || Number(c?.partner_id)!==p.partner)
      return failed('d10_connection_identity_mismatch');
    if (!(Date.parse(c.access_token_expires_at)>now()+60000)) return failed('access_token_expired_no_refresh');
    const partnerKey=getEnv('SHOPEE_LIVE_PARTNER_KEY'), cryptoKey=getEnv('SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY');
    if (!partnerKey || !cryptoKey) return failed('d10_runtime_not_configured');
    const signed={apiBaseUrl:API,partnerId:p.partner,partnerKey,shopId:p.shop,
      accessToken:await decryptToken(c.access_token_ciphertext,cryptoKey)};
    if (mode==='discover') {
      // Read-only, bounded search. The final writer profile is pinned to
      // the exact candidate and package returned here, not a rolling filter.
      let cursor=null, examined=0;
      const seen=new Set(), cursors=new Set();
      const budget=now()+90_000;
      for(let page=0;page<3;page++) {
        if(now()>=budget) return {...failed('d10_discovery_budget_exhausted'),examined,written:0};
        const list=await listOrders({...signed,orderListPath:'/api/v2/order/get_order_list',
          timeRangeField:'create_time',timeFrom:p.from,timeTo:p.to,pageSize:5,
          orderStatus:'READY_TO_SHIP',cursor});
        const entries=list?.payload?.response?.order_list, more=list?.payload?.response?.more;
        if(!good(list)||!Array.isArray(entries)||entries.length>5||typeof more!=='boolean')
          return {...failed('d10_discovery_list_invalid'),examined,written:0};
        for(const e of entries) {
          if(now()>=budget) return {...failed('d10_discovery_budget_exhausted'),examined,written:0};
          const orderSn=e?.order_sn;
          if(!D10_ORDER_RE.test(orderSn??'')||seen.has(orderSn))
            return {...failed('d10_discovery_identity_invalid'),examined,written:0};
          seen.add(orderSn); examined++;
          const d=await detailOrders({...signed,orderDetailPath:'/api/v2/order/get_order_detail',
            orderSnList:[orderSn],responseOptionalFields:['item_list','package_list','invoice_data','split_up']});
          const rows=d?.payload?.response?.order_list;
          if(!good(d)||!Array.isArray(rows)||rows.length!==1||rows[0]?.order_sn!==orderSn)
            return {...failed('d10_discovery_detail_invalid'),examined,written:0};
          const o=rows[0], createTime=Number(o.create_time), pkg=o.package_list?.[0];
          if(!d10CandidateInWindow(p,{orderSn,createTime})||o.order_status!=='READY_TO_SHIP'
            ||!Array.isArray(o.package_list)||o.package_list.length!==1
            ||!PACKAGE.test(pkg?.package_number??'')||pkg.logistics_status!=='LOGISTICS_READY'
            ||typeof o.split_up!=='boolean'||!assessFiscalReadiness(o,p.fiscalMode).ready
            ||!prepareCelivioRedactedDetail(o,orderSn).ok) continue;
          const t=await readTombstones({channel_account_id:p.account,order_sns:[orderSn]},{timeoutMs:12000});
          if(!t?.ok||!Array.isArray(t.payload?.deleted_order_sns))
            return {...failed('d10_discovery_tombstone_unavailable'),examined,written:0};
          if(t.payload.deleted_order_sns.includes(orderSn)) continue;
          // A one-second margin on either side must contain exactly this
          // order in an UNFILTERED list, so later status changes cannot retarget.
          const from=Math.max(p.from,createTime-1),to=Math.min(p.to,createTime+1);
          if(from>=to) continue;
          const exact=await listOrders({...signed,orderListPath:'/api/v2/order/get_order_list',
            timeRangeField:'create_time',timeFrom:from,timeTo:to,pageSize:5});
          const exactRows=exact?.payload?.response?.order_list;
          if(!good(exact)||!Array.isArray(exactRows)||typeof exact.payload.response.more!=='boolean')
            return {...failed('d10_discovery_exact_list_invalid'),examined,written:0};
          if(exact.payload.response.more||exactRows.length!==1||exactRows[0]?.order_sn!==orderSn) continue;
          const scopedEnv=k=>k==='SHOPEE_LIVE_CHANNEL_ACCOUNT_ID'?p.account:
            k==='SHOPEE_LIVE_SHIPPING_PREFLIGHT_ORDER_SN'?orderSn:
            k==='SHOPEE_LIVE_SHIPPING_FISCAL_MODE'?p.fiscalMode:getEnv(k);
          const proof=await makePreflight({getEnv:scopedEnv,readConnection:read})();
          if(proof?.ok!==true||proof.shop_id!==p.shop||proof.order_sn!==orderSn
            ||proof.package_number!==pkg.package_number||proof.simple_dropoff_confirmed!==true
            ||proof.order_status!=='READY_TO_SHIP'||proof.package_logistics_status!=='LOGISTICS_READY'
            ||!Array.isArray(proof.modes)||proof.modes.length!==1||proof.modes[0]!=='dropoff'
            ||typeof proof.split_up!=='boolean') continue;
          return {ok:true,code:'d10_discovered_candidate_read_only',channel_account_id:p.account,
            shop_id:p.shop,order_sn:orderSn,package_number:pkg.package_number,
            create_time:createTime,window_from:from,window_to:to,examined,written:0,
            physical_handoff_confirmed:false};
        }
        if(!more) return {...failed('d10_no_eligible_candidate_in_window'),examined,written:0};
        const next=list.payload.response.next_cursor;
        if(typeof next!=='string'||!next||cursors.has(next))
          return {...failed('d10_discovery_cursor_invalid'),examined,written:0};
        cursors.add(next);cursor=next;
      }
      return {...failed('d10_discovery_page_limit_reached'),examined,written:0};
    }
    // The closed create_time window is immutable across status changes.
    // Never filter the list by READY_TO_SHIP: after a successful send that
    // could silently switch to a different order on a second invocation.
    const list=await listOrders({...signed,orderListPath:'/api/v2/order/get_order_list',
      timeRangeField:'create_time',timeFrom:p.from,timeTo:p.to,pageSize:5});
    const entries=list?.payload?.response?.order_list;
    if (!good(list) || !Array.isArray(entries) || list.payload.response.more!==false
      || entries.length!==1) return failed('d10_window_not_single_complete_order');
    const orderSn=entries[0]?.order_sn;
    if (!D10_ORDER_RE.test(orderSn??'') || orderSn!==p.expectedOrder) return failed('d10_list_identity_invalid');
    const detail=await detailOrders({...signed,orderDetailPath:'/api/v2/order/get_order_detail',
      orderSnList:[orderSn],responseOptionalFields:['item_list','package_list','invoice_data','split_up']});
    const orders=detail?.payload?.response?.order_list;
    if (!good(detail) || !Array.isArray(orders) || orders.length!==1 || orders[0]?.order_sn!==orderSn)
      return failed('d10_detail_identity_mismatch');
    const o=orders[0], createTime=Number(o.create_time);
    if (!d10CandidateInWindow(p,{orderSn,createTime})) return failed('d10_candidate_outside_window');
    const pkg=o.package_list?.[0], packageNumber=pkg?.package_number;
    if (!Array.isArray(o.package_list)||o.package_list.length!==1||!PACKAGE.test(packageNumber??'')
        ||packageNumber!==p.expectedPackage||typeof o.split_up!=='boolean') return failed('d10_package_or_split_unverified');
    const identity={channel_account_id:p.account,shop_id:p.shop,order_sn:orderSn,package_number:packageNumber};
    const tombstone=async()=> {
      const t=await readTombstones({channel_account_id:p.account,order_sns:[orderSn]},{timeoutMs:12000});
      return t?.ok===true && Array.isArray(t.payload?.deleted_order_sns) && !t.payload.deleted_order_sns.includes(orderSn);
    };
    if (!await tombstone()) return failed('d10_tombstone_or_read_blocked');
    const fiscal=assessFiscalReadiness(o,p.fiscalMode);
    const status=o.order_status, logistics=pkg.logistics_status;
    if (!fiscal.ready) return {...failed(safeCode(fiscal.code)),...identity};
    const scopedEnv=k=>{
      if (k==='SHOPEE_LIVE_CHANNEL_ACCOUNT_ID') return p.account;
      if (k==='SHOPEE_LIVE_SHIPPING_PREFLIGHT_ORDER_SN'||k==='SHOPEE_LIVE_LABEL_ORDER_SN') return orderSn;
      if (k==='SHOPEE_LIVE_SHIPPING_FISCAL_MODE') return p.fiscalMode;
      if (k==='SHOPEE_LIVE_LABEL_SHOP_ID') return String(p.shop);
      if (k==='SHOPEE_LIVE_LABEL_PACKAGE_NUMBER') return packageNumber;
      if (k==='SHOPEE_LIVE_SHIP_ORDER_ENABLED') return mode==='ship'?'true':'false';
      return getEnv(k);
    };
    const preflight=makePreflight({getEnv:scopedEnv,readConnection:read});
    if (mode==='inspect') {
      if (status!=='READY_TO_SHIP'||logistics!=='LOGISTICS_READY')
        return {...failed('d10_not_ready_to_ship'),...identity};
      const proof=await preflight();
      const eligible=proof?.ok===true&&proof.shop_id===p.shop&&proof.order_sn===orderSn
        &&proof.package_number===packageNumber&&proof.simple_dropoff_confirmed===true
        &&proof.package_logistics_status==='LOGISTICS_READY'&&typeof proof.split_up==='boolean';
      return {...identity,ok:eligible,code:eligible?'d10_candidate_eligible_read_only':safeCode(proof?.code),
        written:0,physical_handoff_confirmed:false};
    }
    if (mode==='label') {
      if (status!=='PROCESSED'||logistics!=='LOGISTICS_REQUEST_CREATED')
        return {...failed('d10_label_not_organized'),...identity};
      if (!resolveD10Profile(getEnv,now())) return failed('d10_window_expired');
      const result=await makeLabel({getEnv:scopedEnv,readConnection:read,prepareMissingDocument:true})();
      return {...identity,ok:result?.ok===true,code:safeCode(result?.code),
        document_id:result?.ok?result.document_id??null:null,physical_handoff_confirmed:false};
    }
    if (status!=='READY_TO_SHIP'||logistics!=='LOGISTICS_READY')
      return {...failed('d10_not_ready_to_ship'),...identity};
    const proof=await preflight();
    if (proof?.ok!==true||proof.shop_id!==p.shop||proof.order_sn!==orderSn
      ||proof.package_number!==packageNumber||proof.simple_dropoff_confirmed!==true
      ||proof.package_logistics_status!=='LOGISTICS_READY'||typeof proof.split_up!=='boolean')
      return {...failed('d10_preflight_not_eligible'),...identity};
    const raw=prepareCelivioRedactedDetail(o,orderSn);
    if (!raw.ok) return {...failed(safeCode(raw.code)),...identity};
    if (!resolveD10Profile(getEnv,now())) return failed('d10_window_expired');
    const persisted=await persistSnapshot({channel_account_id:p.account,external_entity_id:orderSn,
      observed_at:new Date(now()).toISOString(),payload:raw.payload,payload_hash:sha256Hex(JSON.stringify(raw.payload))},{timeoutMs:12000});
    if (!persisted?.ok) return {...failed('d10_raw_unconfirmed'),...identity};
    const intake=makeIntake({readBatch:async data=>{
      if (data?.channel_account_id!==p.account||data?.order_sn!==orderSn) return failed('d10_batch_scope_mismatch');
      const b=await readBatch(data,{timeoutMs:12000});
      if (!b?.ok||!Array.isArray(b.payload?.snapshots)||b.payload.snapshots.length!==1
        ||b.payload.snapshots[0]?.channel_account_id!==p.account
        ||b.payload.snapshots[0]?.external_entity_id!==orderSn) return failed('d10_batch_identity_mismatch');
      return b;
    }});
    const imported=await intake({channelAccountId:p.account,expectedOrderSn:orderSn,limit:5,mode:'commit',verifyExisting:true});
    const entry=imported?.results?.[0];
    if (!imported?.ok||imported.roundStopped||imported.selected!==1||entry?.orderSn!==orderSn
      ||!['written','already_registered'].includes(entry?.status))
      return {...failed('d10_intake_blocked'),...identity};
    if (!await tombstone()||!resolveD10Profile(getEnv,now())) return {...failed('d10_before_ship_blocked'),...identity};
    // Guard repeats preflight after commit, then obtains the permanent Core
    // claim before one network POST. No retry or claim reset.
    const ship=makeShip({getEnv:scopedEnv,readConnection:read,now,
      preflight:async()=>{
        const fresh=await preflight();
        return fresh?.package_number===packageNumber?fresh:failed('d10_package_changed');
      },
      automaticScope:{profileMode:'d10',channelAccountId:p.account,shopId:p.shop,
        fiscalMode:p.fiscalMode,orderSn,createTime}});
    const result=await ship();
    return {...identity,ok:result?.ok===true,code:safeCode(result?.code),
      order_id:entry.write?.orderId??null,physical_handoff_confirmed:false};
  };
}
export const runD10Pilot=createD10Pilot();
