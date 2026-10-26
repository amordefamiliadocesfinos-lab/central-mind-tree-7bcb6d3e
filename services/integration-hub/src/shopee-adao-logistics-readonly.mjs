import { readLiveShopeeOauthConnection } from './core-bridge.mjs';
import { getOrderDetail, parseShopeeError } from './connectors/shopee-protocol.mjs';
import { decryptShopeeToken } from './shopee-token-crypto.mjs';
import { selectAdaoLiveWithCore } from './shopee-adao-logistics-live-selection.mjs';
import { ADAO_LOGISTICS_ACCOUNT } from './shopee-adao-logistics-selection.mjs';

const SHOP = ADAO_LOGISTICS_ACCOUNT.shop_id;
const PARTNER = 2047685;
const ORDER_RE = /^[A-Za-z0-9]{8,100}$/;
const BASE = 'https://partner.shopeemobile.com';

export function createAdaoLogisticsReadOnly({
  getEnv = name => process.env[name],
  now = Date.now,
  readConnection = readLiveShopeeOauthConnection,
  decrypt = decryptShopeeToken,
  readOrderDetail = getOrderDetail,
  selectLive = selectAdaoLiveWithCore,
} = {}) {
  return async function readAdaoLogistics(orderSns) {
    if (!Array.isArray(orderSns) || orderSns.length < 1 || orderSns.length > 20
      || orderSns.some(sn => typeof sn !== 'string' || !ORDER_RE.test(sn))
      || new Set(orderSns).size !== orderSns.length) {
      return { ok: false, code: 'invalid_order_scope', selected: [] };
    }
    try {
      // Core tombstones are checked by selectLive BEFORE invoking readDetails.
      return await selectLive({
        orderSns,
        readDetails: async ({ channel_account_id, shop_id, order_sns }) => {
          if (channel_account_id !== ADAO_LOGISTICS_ACCOUNT.channel_account_id || shop_id !== SHOP) {
            return { ok: false, code: 'identity_mismatch' };
          }
          const partnerKey = getEnv('SHOPEE_LIVE_PARTNER_KEY');
          const tokenKey = getEnv('SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY');
          if (typeof partnerKey !== 'string' || !partnerKey || typeof tokenKey !== 'string' || !tokenKey) {
            return { ok: false, code: 'configuration_missing' };
          }
          const oauth = await readConnection({ channel_account_id });
          const payload = oauth?.payload;
          if (!oauth?.ok || Number(payload?.shop_id) !== SHOP || Number(payload?.partner_id) !== PARTNER) {
            return { ok: false, code: 'oauth_identity_mismatch' };
          }
          if (!Number.isFinite(Date.parse(String(payload.access_token_expires_at)))
            || Date.parse(String(payload.access_token_expires_at)) <= now() + 60000) {
            return { ok: false, code: 'access_token_expired_no_refresh' };
          }
          const accessToken = await decrypt(payload.access_token_ciphertext, tokenKey);
          const detail = await readOrderDetail({
            apiBaseUrl: BASE, orderDetailPath: '/api/v2/order/get_order_detail',
            partnerId: PARTNER, partnerKey, accessToken, shopId: SHOP,
            orderSnList: order_sns,
            responseOptionalFields: ['package_list', 'shipping_carrier', 'invoice_data'],
          });
          if (!detail?.response?.ok || parseShopeeError(detail.payload)) return { ok: false, code: 'detail_rejected' };
          const orders = detail.payload?.response?.order_list;
          if (!Array.isArray(orders)) return { ok: false, code: 'detail_missing' };
          return { ok: true, orders };
        },
      });
    } catch {
      return { ok: false, code: 'read_only_failed', selected: [] };
    }
  };
}

export const readAdaoLogisticsReadOnly = createAdaoLogisticsReadOnly();
