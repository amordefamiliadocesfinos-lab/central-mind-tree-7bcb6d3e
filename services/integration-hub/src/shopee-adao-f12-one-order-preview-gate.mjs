import {F12_3_SCOPE} from './shopee-adao-resumable-discovery.mjs';

// F12.3: strictly inert selection from an ALREADY obtained Shopee LIVE page.
// Does not fetch Shopee, refresh OAuth, write raw snapshots, acquire a lease,
// invoke Core Bridge, create orders or publish an order number. No default
// preview client: callers must inject the existing canonical scoped intake
// with mode='preview' and an exact expectedOrderSn.
const ORDER_RE=/^[A-Za-z0-9]{8,100}$/;
const maxAgeMs=120000;

export function createAdaoF12OneOrderPreviewGate({previewOrder,now=Date.now}={}) {
  if(typeof previewOrder!=='function'||typeof now!=='function')
    throw new TypeError('preview_order_and_clock_required');
  return async function assessOneCandidate({livePage,readRequest,account,observedAt,allowPreview=false}={}) {
    if(allowPreview!==true)return {ok:false,code:'f12_preview_disabled'};
    const current=now();
    if(!Number.isSafeInteger(current)||!Number.isSafeInteger(observedAt)
      ||observedAt>current||current-observedAt>maxAgeMs)
      return {ok:false,code:'f12_live_evidence_stale'};
    if(!livePage ||livePage.ok!==true
      ||livePage.shop_id!==F12_3_SCOPE.shop
      ||account!==F12_3_SCOPE.account
      ||readRequest?.timeRangeField!=='update_time'
      ||readRequest?.onlyIntakeEligibleOrders!==true
      ||readRequest?.pageSize!==F12_3_SCOPE.pageSize
      ||!Array.isArray(livePage.order_sns)
      ||livePage.order_sns.length>F12_3_SCOPE.pageSize
      ||livePage.more===true
      ||livePage.order_sns.some(sn=>typeof sn!=='string'||!ORDER_RE.test(sn))
      ||new Set(livePage.order_sns).size!==livePage.order_sns.length)
      return {ok:false,code:'f12_live_page_unverified'};
    // A LIVE page can contain up to ten eligible-status order IDs. Do not
    // reject a legitimate single READY candidate merely because other IDs
    // on the same page are explicitly BLOCKED by the canonical preview.
    // Scan all IDs sequentially, without choosing an arbitrary first one.
    // Every preview must be unambiguously classified; unknown filtered
    // status (including expected_order_unavailable) fails closed.
    if(livePage.order_sns.length===0)
      return {ok:false,code:'f12_no_live_candidate'};
    let readyCount=0;
    for(const sn of livePage.order_sns) {
      let preview;
      try {
        preview=await previewOrder({
          channelAccountId:F12_3_SCOPE.account,expectedOrderSn:sn,
          limit:1,mode:'preview',verifyExisting:false,
        });
      }catch{return {ok:false,code:'f12_canonical_preview_unavailable'};}
      const entry=preview?.results?.[0];
      if(preview?.ok!==true||preview.mode!=='preview'
        ||preview.selected!==1||preview.results?.length!==1
        ||preview.written!==0||entry?.orderSn!==sn||entry.write!==null)
        return {ok:false,code:'f12_canonical_preview_blocked'};
      const isReady=preview.ready===1&&preview.blocked===0&&entry.status==='ready';
      const isBlocked=preview.ready===0&&preview.blocked===1&&entry.status==='blocked'
        &&Array.isArray(entry.blockers)&&entry.blockers.length>0;
      if(!isReady&&!isBlocked)
        return {ok:false,code:'f12_canonical_preview_blocked'};
      if(isReady)readyCount++;
      if(readyCount>1)
        return {ok:false,code:'f12_multiple_candidates_requires_review'};
    }
    if(readyCount===0)return {ok:false,code:'f12_no_canonical_ready_candidate'};
    // This result is deliberately a low-cardinality assessment, not a
    // permission token. The candidate identity never leaves the function;
    // a future supervised pilot must repeat live+Core checks before commit.
    return {ok:true,code:'f12_one_live_candidate_previewed',
      candidates:1,productionAuthorized:false,commitAuthorized:false};
  };
}
