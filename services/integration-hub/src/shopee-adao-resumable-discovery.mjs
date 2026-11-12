// F12.3 — pure, read-only, resumable page planner for the isolated Adão pilot.
// This module is NOT wired to production routes, writers, Cloud Run or Scheduler.
// A future adapter must provide durable, fenced state and keep the writer's
// LIVE preflight and Core claims unchanged. Never log cursor or order IDs.
export const F12_3_SCOPE = Object.freeze({
  account: 'b4027369-5abf-4ac1-ab24-862334fae892',
  shop: 1156446003,
  pageSize: 10,
  maxPages: 10,
  maxOrders: 100,
  lookbackSeconds: 48 * 60 * 60,
  maxPagesPerSlice: 2,
  version: 1,
});
const ORDER_RE = /^[A-Za-z0-9]{8,100}$/;
const CURSOR_RE = /^[\x21-\x7e]{1,2048}$/;
const validCount = value => Number.isSafeInteger(value) && value >= 0;
const validTime = value => Number.isSafeInteger(value) && value > 0;
const validCursor = value => value === null
  || (typeof value === 'string' && CURSOR_RE.test(value));
const stopped = (code, checkpoint = null) => ({
  ok: false, code, completed: false, checkpoint: null,
  page_orders: [], pages_in_slice: 0,
  total_pages: validCount(checkpoint?.pages) ? checkpoint.pages : 0,
  total_orders: validCount(checkpoint?.orders) ? checkpoint.orders : 0,
});

export function createAdaoResumableDiscovery({ readOrders, now = Date.now } = {}) {
  if (typeof readOrders !== 'function') throw new TypeError('readOrders required');
  return async function readSlice(checkpoint = null, { maxPagesPerSlice = 2 } = {}) {
    if (!Number.isSafeInteger(maxPagesPerSlice)
      || maxPagesPerSlice < 1 || maxPagesPerSlice > F12_3_SCOPE.maxPagesPerSlice) {
      return stopped('invalid_slice_size');
    }
    const current = now();
    if (!Number.isFinite(current) || current <= 0) return stopped('invalid_clock');
    let state;
    if (checkpoint === null) {
      const timeTo = Math.floor(current / 1000) - 30;
      if (!validTime(timeTo) || timeTo <= F12_3_SCOPE.lookbackSeconds)
        return stopped('invalid_clock');
      state = {
        version: F12_3_SCOPE.version,
        account: F12_3_SCOPE.account,
        shop: F12_3_SCOPE.shop,
        timeFrom: timeTo - F12_3_SCOPE.lookbackSeconds,
        timeTo, cursor: null, pages: 0, orders: 0, visited: [],
      };
    } else {
      if (!checkpoint || typeof checkpoint !== 'object'
        || checkpoint.version !== F12_3_SCOPE.version
        || checkpoint.account !== F12_3_SCOPE.account
        || checkpoint.shop !== F12_3_SCOPE.shop
        || !validTime(checkpoint.timeFrom) || !validTime(checkpoint.timeTo)
        || checkpoint.timeTo - checkpoint.timeFrom !== F12_3_SCOPE.lookbackSeconds
        || checkpoint.timeTo > Math.floor(current / 1000)
        || !validCount(checkpoint.pages) || checkpoint.pages >= F12_3_SCOPE.maxPages
        || !validCount(checkpoint.orders) || checkpoint.orders > F12_3_SCOPE.maxOrders
        || !validCursor(checkpoint.cursor)
        || (checkpoint.pages > 0 && checkpoint.cursor === null)
        || !Array.isArray(checkpoint.visited)
        || checkpoint.visited.length !== checkpoint.pages
        || checkpoint.visited.some(v => typeof v !== 'string' || !CURSOR_RE.test(v))
        || new Set(checkpoint.visited).size !== checkpoint.visited.length
        || (checkpoint.cursor !== null && !checkpoint.visited.includes(checkpoint.cursor))
        || Object.keys(checkpoint).some(k => ![
          'version','account','shop','timeFrom','timeTo','cursor','pages','orders','visited',
        ].includes(k))) return stopped('invalid_checkpoint');
      state = { ...checkpoint, visited: [...checkpoint.visited] };
    }
    const pageOrders = [];
    const thisSlice = Math.min(maxPagesPerSlice, F12_3_SCOPE.maxPages - state.pages);
    for (let i = 0; i < thisSlice; i++) {
      let page;
      try {
        page = await readOrders({
          timeFrom: state.timeFrom,
          timeTo: state.timeTo,
          cursor: state.cursor,
          pageSize: F12_3_SCOPE.pageSize,
          timeRangeField: 'update_time',
          onlyIntakeEligibleOrders: true,
          includeReadyToShipCandidates: true,
          responseOptionalFields: ['item_list','total_amount','payment_method','pay_time','buyer_message'],
        });
      } catch {
        return stopped('discovery_exception', state);
      }
      const sn = page?.order_sns;
      if (page?.ok !== true || page.shop_id !== F12_3_SCOPE.shop
        || !Array.isArray(sn) || sn.length > F12_3_SCOPE.pageSize
        || sn.some(id => typeof id !== 'string' || !ORDER_RE.test(id))
        || new Set(sn).size !== sn.length
        || state.orders + sn.length > F12_3_SCOPE.maxOrders) {
        return stopped('invalid_page', state);
      }
      // Page output has no writes; the caller must checkpoint durable state
      // atomically before treating this as progress. No PII in diagnostics.
      pageOrders.push([...sn]);
      state.pages++;
      state.orders += sn.length;
      if (page.more !== true) {
        return { ok: true, code: 'discovery_complete', completed: true,
          checkpoint: null, page_orders: pageOrders, pages_in_slice: pageOrders.length,
          total_pages: state.pages, total_orders: state.orders };
      }
      if (state.pages >= F12_3_SCOPE.maxPages) {
        return stopped('max_pages_exhausted', state);
      }
      const cursor = page.next_cursor;
      if (typeof cursor !== 'string' || !CURSOR_RE.test(cursor)
        || state.visited.includes(cursor) || cursor === state.cursor) {
        return stopped('invalid_cursor', state);
      }
      state.cursor = cursor;
      state.visited.push(cursor);
    }
    return { ok: true, code: 'slice_ready', completed: false,
      checkpoint: state, page_orders: pageOrders, pages_in_slice: pageOrders.length,
      total_pages: state.pages, total_orders: state.orders };
  };
}
