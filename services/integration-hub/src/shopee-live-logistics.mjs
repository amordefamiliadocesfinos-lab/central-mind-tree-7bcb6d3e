import {
  readLiveShopeeOauthConnection,
  refreshLiveShopeeOauthConnection,
} from './core-bridge.mjs';
import {
  getOrderDetail,
  getShippingDocumentParameter,
  getShippingParameter,
  parseShopeeError,
  refreshToken,
} from './connectors/shopee-protocol.mjs';
import { decryptShopeeToken, encryptShopeeToken } from './shopee-token-crypto.mjs';

const API_BASE_URL = 'https://partner.shopeemobile.com';
const ORDER_DETAIL_PATH = '/api/v2/order/get_order_detail';
const SHIPPING_PARAMETER_PATH = '/api/v2/logistics/get_shipping_parameter';
const SHIPPING_DOCUMENT_PARAMETER_PATH = '/api/v2/logistics/get_shipping_document_parameter';
const REFRESH_PATH = '/api/v2/auth/access_token/get';
const ACCESS_TOKEN_FALLBACK_TTL_MS = 4 * 60 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function requiredEnv(getEnv, name) {
  const value = getEnv(name);
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function positiveInteger(value, field) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new TypeError(`${field} must be a positive safe integer`);
  }
  return parsed;
}

function tokenIsExpired(expiresAt, nowMs, safetyMs = 60_000) {
  const parsed = Date.parse(String(expiresAt ?? ''));
  return !Number.isFinite(parsed) || parsed <= nowMs + safetyMs;
}

function accessTokenExpiry(expireIn, nowMs) {
  const seconds = Number(expireIn);
  if (Number.isFinite(seconds) && seconds > 0 && seconds <= 7 * 24 * 60 * 60) {
    return new Date(nowMs + seconds * 1000).toISOString();
  }
  return new Date(nowMs + ACCESS_TOKEN_FALLBACK_TTL_MS).toISOString();
}

function firstOrder(payload) {
  return Array.isArray(payload?.response?.order_list) ? payload.response.order_list[0] ?? null : null;
}

function inferPackageNumber(order) {
  const packageList = Array.isArray(order?.package_list) ? order.package_list : [];
  const value = packageList[0]?.package_number;
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function compactInfoNeeded(payload) {
  const info = payload?.response?.info_needed;
  if (!info || typeof info !== 'object') return null;
  const out = {};
  for (const key of ['pickup', 'dropoff', 'non_integrated']) {
    if (Array.isArray(info[key])) out[key] = info[key].map((value) => String(value));
  }
  return out;
}

function compactDocumentParameter(payload) {
  const candidates = [
    payload?.response?.result_list,
    payload?.response?.order_list,
    payload?.response?.shipping_document_parameter_list,
  ].find(Array.isArray) ?? [];

  return candidates.map((entry) => ({
    order_sn: typeof entry?.order_sn === 'string' ? entry.order_sn : null,
    package_number: typeof entry?.package_number === 'string' ? entry.package_number : null,
    suggested_shipping_document_type:
      typeof entry?.suggested_shipping_document_type === 'string'
        ? entry.suggested_shipping_document_type
        : null,
    selectable_shipping_document_type:
      Array.isArray(entry?.selectable_shipping_document_type)
        ? entry.selectable_shipping_document_type.map((value) => String(value))
        : [],
  }));
}

export function createShopeeLiveLogisticsInspector({
  getEnv = (name) => process.env[name],
  now = Date.now,
  readConnection = readLiveShopeeOauthConnection,
  persistRefreshedConnection = refreshLiveShopeeOauthConnection,
  decryptToken = decryptShopeeToken,
  encryptToken = encryptShopeeToken,
  refreshAccessToken = refreshToken,
  readOrderDetail = getOrderDetail,
  readShippingParameter = getShippingParameter,
  readShippingDocumentParameter = getShippingDocumentParameter,
} = {}) {
  return async function inspectShopeeLiveLogistics({ orderSn }) {
    const partnerId = positiveInteger(requiredEnv(getEnv, 'SHOPEE_LIVE_PARTNER_ID'), 'SHOPEE_LIVE_PARTNER_ID');
    const partnerKey = requiredEnv(getEnv, 'SHOPEE_LIVE_PARTNER_KEY');
    const channelAccountId = requiredEnv(getEnv, 'SHOPEE_LIVE_CHANNEL_ACCOUNT_ID');
    const tokenEncryptionKey = requiredEnv(getEnv, 'SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY');

    const normalizedOrderSn = String(orderSn ?? '').trim();
    if (!normalizedOrderSn) throw new TypeError('orderSn must be a non-empty string');

    const connection = await readConnection({ channel_account_id: channelAccountId });
    if (!connection?.ok) return { ok: false, code: 'oauth_connection_unavailable' };

    const storedPartnerId = positiveInteger(connection.payload?.partner_id, 'stored partner_id');
    const shopId = positiveInteger(connection.payload?.shop_id, 'stored shop_id');
    if (storedPartnerId !== partnerId) return { ok: false, code: 'partner_id_mismatch' };

    let accessToken;
    if (tokenIsExpired(connection.payload?.access_token_expires_at, now())) {
      if (tokenIsExpired(connection.payload?.refresh_token_expires_at, now(), 0)) {
        return { ok: false, code: 'refresh_token_expired', shop_id: shopId };
      }

      const storedRefreshToken = await decryptToken(
        connection.payload?.refresh_token_ciphertext,
        tokenEncryptionKey,
      );
      const refreshResult = await refreshAccessToken({
        apiBaseUrl: API_BASE_URL,
        refreshPath: REFRESH_PATH,
        partnerId,
        partnerKey,
        refreshToken: storedRefreshToken,
        shopId,
      });

      if (!refreshResult.response.ok || parseShopeeError(refreshResult.payload)) {
        return { ok: false, code: 'token_refresh_rejected', shop_id: shopId };
      }

      const refreshedAccessToken = String(refreshResult.payload?.access_token ?? '');
      const refreshedRefreshToken = String(refreshResult.payload?.refresh_token ?? '');
      if (!refreshedAccessToken || !refreshedRefreshToken) {
        return { ok: false, code: 'token_refresh_incomplete', shop_id: shopId };
      }

      const refreshedAtMs = now();
      const refreshedAt = new Date(refreshedAtMs).toISOString();
      const persistedRefresh = await persistRefreshedConnection({
        channel_account_id: channelAccountId,
        access_token_ciphertext: await encryptToken(refreshedAccessToken, tokenEncryptionKey),
        refresh_token_ciphertext: await encryptToken(refreshedRefreshToken, tokenEncryptionKey),
        access_token_expires_at: accessTokenExpiry(refreshResult.payload?.expire_in, refreshedAtMs),
        refresh_token_expires_at: new Date(refreshedAtMs + REFRESH_TTL_MS).toISOString(),
        last_refreshed_at: refreshedAt,
      });
      if (!persistedRefresh?.ok) {
        return { ok: false, code: 'token_refresh_persistence_failed', shop_id: shopId };
      }
      accessToken = refreshedAccessToken;
    } else {
      accessToken = await decryptToken(connection.payload?.access_token_ciphertext, tokenEncryptionKey);
    }

    const detailResult = await readOrderDetail({
      apiBaseUrl: API_BASE_URL,
      orderDetailPath: ORDER_DETAIL_PATH,
      partnerId,
      partnerKey,
      accessToken,
      shopId,
      orderSnList: [normalizedOrderSn],
      responseOptionalFields: [
        'package_list',
        'shipping_carrier',
        'invoice_data',
      ],
    });

    if (!detailResult.response.ok || parseShopeeError(detailResult.payload)) {
      return { ok: false, code: 'order_detail_rejected', shop_id: shopId };
    }

    const order = firstOrder(detailResult.payload);
    if (!order || order.order_sn !== normalizedOrderSn) {
      return { ok: false, code: 'order_detail_identity_mismatch', shop_id: shopId };
    }

    const packageNumber = inferPackageNumber(order);

    const shippingResult = await readShippingParameter({
      apiBaseUrl: API_BASE_URL,
      shippingParameterPath: SHIPPING_PARAMETER_PATH,
      partnerId,
      partnerKey,
      accessToken,
      shopId,
      orderSn: normalizedOrderSn,
      packageNumber,
    });

    const shippingError = parseShopeeError(shippingResult.payload);
    const shippingOk = shippingResult.response.ok && !shippingError;

    const documentResult = await readShippingDocumentParameter({
      apiBaseUrl: API_BASE_URL,
      shippingDocumentParameterPath: SHIPPING_DOCUMENT_PARAMETER_PATH,
      partnerId,
      partnerKey,
      accessToken,
      shopId,
      orderList: [{
        order_sn: normalizedOrderSn,
        ...(packageNumber ? { package_number: packageNumber } : {}),
      }],
    });

    const documentError = parseShopeeError(documentResult.payload);
    const documentOk = documentResult.response.ok && !documentError;

    return {
      ok: true,
      shop_id: shopId,
      order: {
        order_sn: normalizedOrderSn,
        order_status: typeof order.order_status === 'string' ? order.order_status : null,
        shipping_carrier: typeof order.shipping_carrier === 'string' ? order.shipping_carrier : null,
        package_number: packageNumber,
        invoice_status: typeof order?.invoice_data?.status === 'string' ? order.invoice_data.status : null,
        invoice_pending_reason:
          typeof order?.invoice_data?.pending_reason === 'string'
            ? order.invoice_data.pending_reason
            : null,
      },
      shipping_parameter: {
        ok: shippingOk,
        error: shippingError || null,
        info_needed: shippingOk ? compactInfoNeeded(shippingResult.payload) : null,
      },
      shipping_document_parameter: {
        ok: documentOk,
        error: documentError || null,
        results: documentOk ? compactDocumentParameter(documentResult.payload) : [],
      },
    };
  };
}

export const inspectShopeeLiveLogistics = createShopeeLiveLogisticsInspector();
