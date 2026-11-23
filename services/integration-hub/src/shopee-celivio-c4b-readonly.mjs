import { readLiveShopeeOauthConnection } from './core-bridge.mjs';
import { decryptShopeeToken } from './shopee-token-crypto.mjs';
import { getOrderList, getOrderDetail, parseShopeeError } from './connectors/shopee-protocol.mjs';

// C4-B: isolated, no-refresh, no-Raw, no-order-writer consultation.
// Never derive the seller identity from caller-supplied input or shared
// SHOPEE_LIVE_CHANNEL_ACCOUNT_ID.
export const CELIVIO_C4B_ACCOUNT_ID = 'd26c7a30-aa4a-4441-8012-600d70453689';
export const CELIVIO_C4B_SHOP_ID = 1357031949;
const PARTNER_ID = 2047685;
const API_BASE_URL = 'https://partner.shopeemobile.com';

export function createCelivioC4BReadOnly({
  getEnv = (name) => process.env[name],
  readConnection = readLiveShopeeOauthConnection,
  decryptToken = decryptShopeeToken,
  listOrders = getOrderList,
  detailOrders = getOrderDetail,
  now = Date.now,
} = {}) {
  return async function readCelivioC4B() {
    const connection = await readConnection({ channel_account_id: CELIVIO_C4B_ACCOUNT_ID });
    const c = connection?.payload;
    if (!connection?.ok || !c) return { ok: false, code: 'connection_unavailable' };
    // Core Bridge already scopes its successful read to the fixed account ID,
    // requires an active account and filters environment='live'. Its payload
    // intentionally omits channel_account_id and environment.
    if (Number(c.shop_id) !== CELIVIO_C4B_SHOP_ID
      || Number(c.partner_id) !== PARTNER_ID) {
      return { ok: false, code: 'identity_mismatch' };
    }

    // No silent refresh; a new authorization is needed after expiry.
    const current = now();
    const expiresAt = Date.parse(String(c.access_token_expires_at ?? ''));
    if (!Number.isFinite(expiresAt) || expiresAt <= current + 60_000) {
      return { ok: false, code: 'access_token_expired_no_refresh' };
    }
    const partnerKey = getEnv('SHOPEE_LIVE_PARTNER_KEY');
    const encryptionKey = getEnv('SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY');
    if (!partnerKey || !encryptionKey) return { ok: false, code: 'runtime_not_configured' };

    const accessToken = await decryptToken(c.access_token_ciphertext, encryptionKey);
    const common = {
      apiBaseUrl: API_BASE_URL, partnerId: PARTNER_ID,
      partnerKey, accessToken, shopId: CELIVIO_C4B_SHOP_ID,
    };
    // A single list page, with a fixed 14-day historical window, no cursor loop.
    const timeTo = Math.floor(current / 1000);
    const timeFrom = timeTo - 14 * 24 * 3600;
    const list = await listOrders({
      ...common, orderListPath: '/api/v2/order/get_order_list',
      timeRangeField: 'create_time', timeFrom, timeTo, pageSize: 5,
    });
    if (!list?.response?.ok || parseShopeeError(list.payload)) {
      return { ok: false, code: 'order_list_unavailable' };
    }
    const entries = list.payload?.response?.order_list;
    if (!Array.isArray(entries)) return { ok: false, code: 'order_list_invalid' };
    const orderSn = entries.map((entry) => entry?.order_sn)
      .find((value) => typeof value === 'string' && /^[a-zA-Z0-9]{8,40}$/.test(value));
    if (!orderSn) return {
      ok: true, account: 'celivio', shop_id: CELIVIO_C4B_SHOP_ID,
      found: false, written: 0, raw_written: 0,
      inspected_window_days: 14, more_available: list.payload?.response?.more === true,
    };

    const detail = await detailOrders({
      ...common, orderDetailPath: '/api/v2/order/get_order_detail',
      orderSnList: [orderSn], responseOptionalFields: ['item_list'],
    });
    if (!detail?.response?.ok || parseShopeeError(detail.payload)) {
      return { ok: false, code: 'order_detail_unavailable' };
    }
    const orders = detail.payload?.response?.order_list;
    if (!Array.isArray(orders) || orders.length !== 1 || orders[0]?.order_sn !== orderSn) {
      return { ok: false, code: 'order_detail_identity_mismatch' };
    }
    const items = orders[0]?.item_list;
    if (!Array.isArray(items) || items.length === 0) {
      return { ok: false, code: 'order_items_missing' };
    }
    // No buyer name, address, telephone, shipping info, tokens or complete raw payload.
    return {
      ok: true, account: 'celivio', shop_id: CELIVIO_C4B_SHOP_ID,
      found: true, written: 0, raw_written: 0,
      inspected_window_days: 14,
      more_available: list.payload?.response?.more === true,
      order: {
        order_sn: orderSn,
        status: typeof orders[0].order_status === 'string' ? orders[0].order_status : null,
        items: items.map((item) => ({
          item_id: item.item_id == null ? null : String(item.item_id),
          model_id: item.model_id == null ? null : String(item.model_id),
          quantity: Number(item.model_quantity_purchased),
        })),
      },
    };
  };
}

export const readCelivioC4BReadOnly = createCelivioC4BReadOnly();
