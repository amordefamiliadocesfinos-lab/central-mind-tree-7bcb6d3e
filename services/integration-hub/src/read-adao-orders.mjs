import { pathToFileURL } from 'node:url';
import { createShopeeLiveOrdersReader } from './shopee-live-orders.mjs';
import { CORE_BRIDGE_URL, readLiveShopeeOauthConnection,
  upsertLiveShopeeOrderListSnapshot, upsertLiveShopeeOrderSnapshot } from './core-bridge.mjs';
import { getOrderList, getOrderDetail, parseShopeeError } from './connectors/shopee-protocol.mjs';

export const ADAO = Object.freeze({
  channel_account_id: 'b4027369-5abf-4ac1-ab24-862334fae892',
  partner_id: 2047685,
  shop_id: 1156446003,
});
const LIST = '/api/v2/order/get_order_list';
const DETAIL = '/api/v2/order/get_order_detail';
const MAX_CORE_BODY_BYTES = 64 * 1024;
const RAW_CONFIRMATION = 'CONFIRM_ADAO_RAW_SNAPSHOTS';
const ITEMS_CONFIRMATION = 'CONFIRM_ADAO_ORDER_ITEMS';
const ITEM_DETAIL_FIELDS = Object.freeze(['item_list', 'total_amount', 'payment_method']);
const ELIGIBLE_STATUSES = new Set(['PROCESSED', 'READY_TO_SHIP']);
const RAW_ACTIONS = Object.freeze({
  list: 'shopee.raw_order_list_snapshot.upsert',
  detail: 'shopee.raw_order_snapshot.upsert',
});
const SECRET_NAMES = ['SHOPEE_LIVE_PARTNER_KEY', 'SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY', 'CORE_BRIDGE_HMAC_SECRET'];
const FAILURE_CODES = new Set(['oauth_connection_unavailable', 'partner_id_mismatch', 'shop_id_mismatch',
  'access_token_expired_no_refresh', 'order_list_rejected', 'order_detail_rejected',
  'order_detail_missing_order_sn', 'order_detail_identity_mismatch', 'order_detail_incomplete']);

// Importing this module performs no I/O. Each invocation has its own limits and environment.
export async function readAdaoOrders({ env = process.env, identity = ADAO, now = Date.now,
  fetchImpl = globalThis.fetch, persistRaw = false, includeItems = false,
  confirmation = null } = {}) {
  const report = { identity: { ...ADAO }, window: null, listed_count: 0, detailed_count: 0,
    ok: false, result: 'execution_failed', request_ids: {} };
  if (persistRaw) report.raw = { confirmed: 0, attempted: 0, expected: 0 };
  if (includeItems) report.items = { eligible_orders: 0, item_lines: 0, missing_or_invalid: 0 };
  try {
    if (!identity || Object.keys(ADAO).some(key => identity[key] !== ADAO[key])) {
      report.result = 'identity_mismatch';
      return report;
    }
    if ((includeItems && persistRaw && confirmation !== ITEMS_CONFIRMATION)
      || (includeItems && !persistRaw && confirmation !== null)
      || (!includeItems && persistRaw && confirmation !== RAW_CONFIRMATION)) {
      report.result = 'raw_confirmation_required';
      return report;
    }
    const timeTo = Math.floor(now() / 1000);
    if (!Number.isSafeInteger(timeTo) || timeTo <= 86400) return report;
    const window = { timeFrom: timeTo - 86400, timeTo, timeRangeField: 'create_time',
      pageSize: 5, cursor: null, orderStatus: null,
      responseOptionalFields: includeItems ? [...ITEM_DETAIL_FIELDS] : [] };
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
    const staged = [];
    let rawWritePhase = false;
    const stage = kind => async data => {
      if (data?.channel_account_id !== ADAO.channel_account_id
        || typeof data.external_entity_id !== 'string'
        || !data.external_entity_id
        || typeof data.payload_hash !== 'string'
        || !/^[a-f0-9]{64}$/.test(data.payload_hash)
        || !data.payload || typeof data.payload !== 'object') throw new Error('invalid_snapshot');
      if (persistRaw) staged.push({ kind, data });
      return { ok: true };
    };
    const calls = new Set();
    let itemValidationRejected = false;
    const transport = async (input, init = {}) => {
      const url = new URL(input);
      const method = init.method ?? 'GET';
      let operation;
      if (url.href === CORE_BRIDGE_URL && method === 'POST') {
        const body = JSON.parse(init.body);
        if (body.channel_account_id !== ADAO.channel_account_id) throw new Error('forbidden_operation');
        if (body.action === 'shopee.oauth_connection.read') {
          if (Object.keys(body).some(key => !['action', 'channel_account_id'].includes(key))) throw new Error('forbidden_operation');
          operation = 'connection';
        } else {
          const kind = body.action === RAW_ACTIONS.list ? 'list'
            : body.action === RAW_ACTIONS.detail ? 'detail' : null;
          if (!persistRaw || !rawWritePhase || !kind
            || !staged.some(entry => entry.kind === kind && entry.data.external_entity_id === body.external_entity_id
              && entry.data.payload_hash === body.payload_hash)
            || Buffer.byteLength(init.body, 'utf8') > MAX_CORE_BODY_BYTES) throw new Error('forbidden_operation');
          operation = `${body.action}:${body.external_entity_id}`;
        }
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
      persistOrderListSnapshot: stage('list'), persistOrderSnapshot: stage('detail'), logger: quiet,
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
        if (includeItems && result.response.ok && !parseShopeeError(result.payload)) {
          const details = result.payload?.response?.order_list;
          // Validate all operationally eligible orders before any staged Core write.
          // Cancelled/non-eligible orders remain historical raw evidence.
          if (!Array.isArray(details)) {
            itemValidationRejected = true;
            report.items.missing_or_invalid++;
          } else {
            for (const order of details) {
              if (typeof order?.order_status !== 'string' || !order.order_status.trim()) {
                report.items.missing_or_invalid++;
                itemValidationRejected = true;
                continue;
              }
              if (!ELIGIBLE_STATUSES.has(order.order_status)) continue;
              report.items.eligible_orders++;
              const items = order?.item_list;
              if (!Array.isArray(items) || items.length === 0
                || items.some(item => !item || typeof item !== 'object'
                  || !/^[1-9][0-9]*$/.test(String(item.item_id ?? ''))
                  || !Number.isSafeInteger(Number(item.model_quantity_purchased))
                  || Number(item.model_quantity_purchased) <= 0)) {
                report.items.missing_or_invalid++;
                itemValidationRejected = true;
                continue;
              }
              report.items.item_lines += items.length;
            }
          }
          if (itemValidationRejected) return {
            response: { ok: false, status: 422 },
            payload: { error: 'order_item_list_invalid' },
          };
        }
        return result;
      },
    });
    const result = await reader(window);
    report.ok = result.ok === true;
    report.result = itemValidationRejected ? 'order_items_missing_or_invalid'
      : report.ok ? 'completed' : FAILURE_CODES.has(result.code) ? result.code : 'execution_failed';
    if (report.ok) report.detailed_count = result.detailed_count;
    if (report.ok && persistRaw) {
      report.raw.expected = 1 + report.detailed_count;
      if (staged.length !== report.raw.expected || staged[0]?.kind !== 'list'
        || staged.slice(1).some(entry => entry.kind !== 'detail')
        || new Set(staged.slice(1).map(entry => entry.data.external_entity_id)).size !== report.detailed_count) {
        report.ok = false;
        report.result = 'raw_staging_incomplete';
        return report;
      }
      // Preflight all Core request sizes before the first network write.
      if (staged.some(entry => Buffer.byteLength(JSON.stringify({
        action: RAW_ACTIONS[entry.kind], ...entry.data }), 'utf8') > MAX_CORE_BODY_BYTES)) {
        report.ok = false;
        report.result = 'raw_snapshot_oversized';
        return report;
      }
      rawWritePhase = true;
      for (const entry of staged) {
        const writer = entry.kind === 'list'
          ? upsertLiveShopeeOrderListSnapshot : upsertLiveShopeeOrderSnapshot;
        report.raw.attempted++;
        // No automatic retry. A timed-out Core reply leaves this write's outcome unknown.
        const persisted = await writer(entry.data, {
          url: CORE_BRIDGE_URL, secret: values.CORE_BRIDGE_HMAC_SECRET,
          fetchImpl: transport, logger: quiet,
        });
        if (!persisted?.ok) {
          report.ok = false;
          report.result = 'raw_persistence_unconfirmed';
          break;
        }
        report.raw.confirmed++;
      }
      rawWritePhase = false;
      if (report.ok) report.result = 'raw_persisted';
    }
  } catch {
    // Exceptions can contain signed URLs or raw response data. Never serialize them.
    report.ok = false;
    report.result = 'execution_failed';
  }
  return report;
}

export async function main(args = process.argv.slice(2)) {
  const readOnly = args.length === 1 && args[0] === '--live';
  const raw = args.length === 2 && args[0] === '--persist-raw'
    && args[1] === `--confirm=${RAW_CONFIRMATION}`;
  const previewItems = args.length === 1 && args[0] === '--preview-items';
  const persistItems = args.length === 2 && args[0] === '--persist-items'
    && args[1] === `--confirm=${ITEMS_CONFIRMATION}`;
  if (!readOnly && !raw && !previewItems && !persistItems) {
    console.log('Usage: --live | --persist-raw --confirm=CONFIRM_ADAO_RAW_SNAPSHOTS | --preview-items | --persist-items --confirm=CONFIRM_ADAO_ORDER_ITEMS');
    return 2;
  }
  const report = await readAdaoOrders(persistItems ? {
    persistRaw: true, includeItems: true, confirmation: ITEMS_CONFIRMATION,
  } : previewItems ? { includeItems: true }
    : raw ? { persistRaw: true, confirmation: RAW_CONFIRMATION } : {});
  console.log(JSON.stringify(report));
  return report.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
