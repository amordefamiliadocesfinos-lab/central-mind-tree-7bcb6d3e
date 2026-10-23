import { pathToFileURL } from 'node:url';
import { createShopeeLiveOrdersReader } from './shopee-live-orders.mjs';
import { CORE_BRIDGE_URL, readLiveShopeeOauthConnection } from './core-bridge.mjs';
import { getOrderList, getOrderDetail, parseShopeeError } from './connectors/shopee-protocol.mjs';

export const ADAO = Object.freeze({
  channel_account_id: 'b4027369-5abf-4ac1-ab24-862334fae892',
  partner_id: 2047685,
  shop_id: 1156446003,
});
const LIST = '/api/v2/order/get_order_list';
const DETAIL = '/api/v2/order/get_order_detail';
const SECRET_NAMES = ['SHOPEE_LIVE_PARTNER_KEY', 'SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY', 'CORE_BRIDGE_HMAC_SECRET'];
const FAILURE_CODES = new Set(['oauth_connection_unavailable', 'partner_id_mismatch', 'shop_id_mismatch',
  'access_token_expired_no_refresh', 'order_list_rejected', 'order_detail_rejected',
  'order_detail_missing_order_sn', 'order_detail_identity_mismatch', 'order_detail_incomplete']);

// Importing this module performs no I/O. Each invocation has its own limits and environment.
export async function readAdaoOrders({ env = process.env, identity = ADAO, now = Date.now,
  fetchImpl = globalThis.fetch } = {}) {
  const report = { identity: { ...ADAO }, window: null, listed_count: 0, detailed_count: 0,
    ok: false, result: 'execution_failed', request_ids: {} };
  try {
    if (!identity || Object.keys(ADAO).some(key => identity[key] !== ADAO[key])) {
      report.result = 'identity_mismatch';
      return report;
    }
    const timeTo = Math.floor(now() / 1000);
    if (!Number.isSafeInteger(timeTo) || timeTo <= 86400) return report;
    const window = { timeFrom: timeTo - 86400, timeTo, timeRangeField: 'create_time',
      pageSize: 5, cursor: null, orderStatus: null, responseOptionalFields: [] };
    report.window = { time_from: window.timeFrom, time_to: timeTo, time_range_field: 'create_time' };
    const values = Object.fromEntries(SECRET_NAMES.map(name => [name, env[name]]));
    if (SECRET_NAMES.some(name => typeof values[name] !== 'string' || !values[name].trim())) {
      report.result = 'configuration_missing';
      return report;
    }
    values.SHOPEE_LIVE_PARTNER_ID = String(ADAO.partner_id);
    values.SHOPEE_LIVE_CHANNEL_ACCOUNT_ID = ADAO.channel_account_id;
    const getEnv = name => values[name];
    const quiet = () => {};
    const forbidden = async () => { throw new Error('forbidden_operation'); };
    const inMemory = async () => ({ ok: true });
    const calls = new Set();
    const transport = async (input, init = {}) => {
      const url = new URL(input);
      const method = init.method ?? 'GET';
      let operation;
      if (url.href === CORE_BRIDGE_URL && method === 'POST') {
        const body = JSON.parse(init.body);
        if (body.action !== 'shopee.oauth_connection.read' || body.channel_account_id !== ADAO.channel_account_id
          || Object.keys(body).some(key => !['action', 'channel_account_id'].includes(key))) throw new Error('forbidden_operation');
        operation = 'connection';
      } else {
        if (url.origin !== 'https://partner.shopeemobile.com' || method !== 'GET'
          || ![LIST, DETAIL].includes(url.pathname)
          || url.searchParams.get('partner_id') !== String(ADAO.partner_id)
          || url.searchParams.get('shop_id') !== String(ADAO.shop_id)) throw new Error('forbidden_operation');
        operation = url.pathname;
      }
      if (calls.has(operation)) throw new Error('request_limit');
      calls.add(operation);
      return fetchImpl(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(15000) });
    };
    const captureId = (operation, payload, accessToken) => {
      const id = payload?.request_id;
      // Official hex/UUID identifiers only; never copy arbitrary upstream messages.
      if (typeof id === 'string' && /^[a-f0-9]{16,64}$|^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)
        && !id.includes(accessToken)
        && !SECRET_NAMES.some(name => id.includes(values[name]))) report.request_ids[operation] = id;
    };
    const reader = createShopeeLiveOrdersReader({
      getEnv, now, allowRefresh: false, expectedShopId: ADAO.shop_id, fetchImpl: transport,
      readConnection: async data => {
        if (data.channel_account_id !== ADAO.channel_account_id) throw new Error('identity_mismatch');
        return readLiveShopeeOauthConnection(data, { url: CORE_BRIDGE_URL,
          secret: values.CORE_BRIDGE_HMAC_SECRET, fetchImpl: transport, logger: quiet });
      },
      refreshAccessToken: forbidden, persistRefreshedConnection: forbidden, encryptToken: forbidden,
      persistOrderListSnapshot: inMemory, persistOrderSnapshot: inMemory, logger: quiet,
      readOrderList: async args => {
        const result = await getOrderList(args);
        captureId('list', result.payload, args.accessToken);
        if (result.response.ok && !parseShopeeError(result.payload)) {
          const orders = result.payload?.response?.order_list;
          if (!Array.isArray(orders) || orders.length > 5 || orders.some(order => typeof order?.order_sn !== 'string'
            || !/^[A-Z0-9]{1,64}$/.test(order.order_sn))
            || new Set(orders.map(order => order.order_sn)).size !== orders.length) throw new Error('invalid_order_list');
          report.listed_count = orders.length;
        }
        return result;
      },
      readOrderDetail: async args => {
        if (args.orderSnList.length > 5) throw new Error('request_limit');
        const result = await getOrderDetail(args);
        captureId('detail', result.payload, args.accessToken);
        return result;
      },
    });
    const result = await reader(window);
    report.ok = result.ok === true;
    report.result = report.ok ? 'completed' : FAILURE_CODES.has(result.code) ? result.code : 'execution_failed';
    if (report.ok) report.detailed_count = result.detailed_count;
  } catch {
    // Exceptions can contain signed URLs or raw response data. Never serialize them.
    report.ok = false;
    report.result = 'execution_failed';
  }
  return report;
}

export async function main(args = process.argv.slice(2)) {
  if (args.length !== 1 || args[0] !== '--live') {
    console.log('Usage: node services/integration-hub/src/read-adao-orders.mjs --live');
    return 2;
  }
  const report = await readAdaoOrders();
  console.log(JSON.stringify(report));
  return report.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
