import {F12_3_SCOPE} from './shopee-adao-resumable-discovery.mjs';

// F12.3: strictly inert selection from an ALREADY obtained Shopee LIVE page.
// Does not fetch Shopee, refresh OAuth, write raw snapshots, acquire a lease,
// invoke Core Bridge, create orders or publish an order number. No default
// preview client: callers must inject the existing canonical scoped intake
// with mode='preview' and an exact expectedOrderSn.
const ORDER_RE=/^[A-Za-z0-9]{8,100}$/;
const allowedStatuses=new Set(['PROCESSED','READY_TO_SHIP']);
const maxAgeMs=120000;

export function createAdaoF12OneOrderPreviewGate({previewOrder,now=Date.now}={}) {
  if(typeof previewOrder!=='function'||typeof now!=='function')
    throw new TypeError('preview_order_and_clock_required');
  return async function assessOneCandidate({livePage,observedAt,allowPreview=false}={}) {
    if(allowPreview!==true)return {ok:false,code:'f12_preview_disabled'};
    const current=now();
    if(!Number.isSafeInteger(current)||!Number.isSafeInteger(observedAt)
      ||observedAt>current||current-observedAt>maxAgeMs)
      return {ok:false,code:'f12_live_evidence_stale'};
    if(!livePage ||livePage.ok!==true
      ||livePage.shop_id!==F12_3_SCOPE.shop
      ||livePage.channel_account_id!==F12_3_SCOPE.account
      ||livePage.timeRangeField!=='update_time'
      ||livePage.onlyIntakeEligibleOrders!==true
      ||!Array.isArray(livePage.order_sns)
      ||livePage.order_sns.length>F12_3_SCOPE.pageSize
      ||livePage.more===true
      ||livePage.order_sns.some(sn=>typeof sn!=='string'||!ORDER_RE.test(sn))
      ||new Set(livePage.order_sns).size!==livePage.order_sns.length)
      return {ok:false,code:'f12_live_page_unverified'};
    // Exactly one candidate. A 10-item page cannot be silently interpreted
    // as permission to select one and ignore nine other eligible orders.
    if(livePage.order_sns.length!==1)
      return {ok:false,code:livePage.order_sns.length===0
        ?'f12_no_live_candidate':'f12_multiple_candidates_requires_review'};
    if(!Array.isArray(livePage.eligible_orders)
      ||livePage.eligible_orders.length!==1
      ||livePage.eligible_orders[0]?.order_sn!==livePage.order_sns[0]
      ||!allowedStatuses.has(livePage.eligible_orders[0]?.order_status))
      return {ok:false,code:'f12_live_status_unverified'};
    const sn=livePage.order_sns[0];
    let preview;
    try{
      preview=await previewOrder({
        channelAccountId:F12_3_SCOPE.account,expectedOrderSn:sn,
        limit:1,mode:'preview',verifyExisting:false,
      });
    }catch{return {ok:false,code:'f12_canonical_preview_unavailable'};}
    const entry=preview?.results?.[0];
    if(preview?.ok!==true||preview.mode!=='preview'
      ||preview.selected!==1||preview.ready!==1||preview.blocked!==0
      ||preview.written!==0||preview.results?.length!==1
      ||entry?.orderSn!==sn||entry.status!=='ready'
      ||entry.write!==null)
      return {ok:false,code:'f12_canonical_preview_blocked'};
    // This result is deliberately a low-cardinality assessment, not a
    // permission token. The candidate identity never leaves the function;
    // a future supervised pilot must repeat live+Core checks before commit.
    return {ok:true,code:'f12_one_live_candidate_previewed',
      candidates:1,productionAuthorized:false,commitAuthorized:false};
  };
}
