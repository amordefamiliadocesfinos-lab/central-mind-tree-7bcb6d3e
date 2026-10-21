import {
  readLiveShopeeOauthConnection,
  refreshLiveShopeeOauthConnection,
  sha256Hex,
  upsertLiveShopeeOrderListSnapshot,
  upsertLiveShopeeOrderSnapshot,
} from './core-bridge.mjs';
import {
  getOrderDetail,
  getOrderList,
  parseShopeeError,
  refreshToken,
} from './connectors/shopee-protocol.mjs';
import { decryptShopeeToken, encryptShopeeToken } from './shopee-token-crypto.mjs';

const API_BASE_URL = 'https://partner.shopeemobile.com';
const ORDER_LIST_PATH = '/api/v2/order/get_order_list';
const ORDER_DETAIL_PATH = '/api/v2/order/get_order_detail';
const REFRESH_PATH = '/api/v2/auth/access_token/get';
const ACCESS_TOKEN_FALLBACK_TTL_MS = 4 * 60 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function requiredEnv(getEnv, name) {
  const value = getEnv(name);
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`Missing required environment variable: ${name}`);
  return value.trim();
}

function positiveInteger(value, field) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new TypeError(`${field} must be a positive safe integer`);
  return parsed;
}

function sanitizeShopeeRequestId(payload) {
  return typeof payload?.request_id === 'string' && payload.request_id.trim() !== ''
    ? payload.request_id.trim()
    : null;
}

function payloadHash(payload) {
  return sha256Hex(JSON.stringify(payload));
}

function orderListFrom(payload) {
  return Array.isArray(payload?.response?.order_list) ? payload.response.order_list : [];
}

function buildSingleOrderPayload(sourcePayload, order) {
  const payload = {};
  for (const key of ['error', 'message', 'warning', 'request_id']) {
    if (Object.prototype.hasOwnProperty.call(sourcePayload ?? {}, key)) payload[key] = sourcePayload[key];
  }
  payload.response = { order_list: [order] };
  return payload;
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

export function createShopeeLiveOrdersReader({
  allowRefresh = true, expectedShopId = null, fetchImpl = globalThis.fetch,
  getEnv = (name) => process.env[name],
  now = Date.now,
  readConnection = readLiveShopeeOauthConnection,
  persistRefreshedConnection = refreshLiveShopeeOauthConnection,
  decryptToken = decryptShopeeToken,
  encryptToken = encryptShopeeToken,
  refreshAccessToken = refreshToken,
  readOrderList = getOrderList,
  readOrderDetail = getOrderDetail,
  persistOrderListSnapshot = upsertLiveShopeeOrderListSnapshot,
  persistOrderSnapshot = upsertLiveShopeeOrderSnapshot,
  logger = (entry) => console.info(JSON.stringify(entry)),
} = {}) {
  return async function readShopeeLiveOrdersWindow({
    timeFrom,
    timeTo,
    pageSize = 5,
    cursor = null,
    orderStatus = null,
    timeRangeField = 'create_time',
    responseOptionalFields = [
      'item_list',
      'package_list',
      'shipping_carrier',
      'payment_method',
      'total_amount',
      'pay_time',
      'recipient_address',
    ],
  } = {}) {
    const started = now();
    const partnerId = positiveInteger(requiredEnv(getEnv, 'SHOPEE_LIVE_PARTNER_ID'), 'SHOPEE_LIVE_PARTNER_ID');
    const partnerKey = requiredEnv(getEnv, 'SHOPEE_LIVE_PARTNER_KEY');
    const channelAccountId = requiredEnv(getEnv, 'SHOPEE_LIVE_CHANNEL_ACCOUNT_ID');
    const tokenEncryptionKey = requiredEnv(getEnv, 'SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY');

    const connection = await readConnection({ channel_account_id: channelAccountId });
    if (!connection?.ok) return { ok: false, code: 'oauth_connection_unavailable' };

    const storedPartnerId = positiveInteger(connection.payload?.partner_id, 'stored partner_id');
    const shopId = positiveInteger(connection.payload?.shop_id, 'stored shop_id');
    if (storedPartnerId !== partnerId) return { ok: false, code: 'partner_id_mismatch' };

    if (expectedShopId !== null && shopId !== expectedShopId) return { ok: false, code: 'shop_id_mismatch' };
    let accessToken;
    if (tokenIsExpired(connection.payload?.access_token_expires_at, now())) {
      if (!allowRefresh) return { ok: false, code: 'access_token_expired_no_refresh' };
      if (tokenIsExpired(connection.payload?.refresh_token_expires_at, now(), 0)) {
        return {
          ok: false,
          code: 'refresh_token_expired',
          shop_id: shopId,
        };
      }

      const storedRefreshToken = await decryptToken(
        connection.payload?.refresh_token_ciphertext,
        tokenEncryptionKey,
      );
      const refreshResult = await refreshAccessToken({
        fetchImpl, apiBaseUrl: API_BASE_URL,
        refreshPath: REFRESH_PATH,
        partnerId,
        partnerKey,
        refreshToken: storedRefreshToken,
        shopId,
      });
      if (!refreshResult.response.ok || parseShopeeError(refreshResult.payload)) {
        logger({
          event: 'shopee_live_token_refresh_rejected',
          shop_id: shopId,
          status: refreshResult.response.status,
          error: typeof refreshResult.payload?.error === 'string' ? refreshResult.payload.error : null,
          request_id: sanitizeShopeeRequestId(refreshResult.payload),
        });
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
      accessToken = await decryptToken(
        connection.payload?.access_token_ciphertext,
        tokenEncryptionKey,
      );
    }

    const listResult = await readOrderList({
      fetchImpl, apiBaseUrl: API_BASE_URL,
      orderListPath: ORDER_LIST_PATH,
      partnerId,
      partnerKey,
      accessToken,
      shopId,
      timeRangeField,
      timeFrom,
      timeTo,
      pageSize,
      cursor,
      orderStatus,
    });

    if (!listResult.response.ok || parseShopeeError(listResult.payload)) {
      logger({
        event: 'shopee_live_order_list_rejected',
        shop_id: shopId,
        status: listResult.response.status,
        error: typeof listResult.payload?.error === 'string' ? listResult.payload.error : null,
        request_id: sanitizeShopeeRequestId(listResult.payload),
      });
      return { ok: false, code: 'order_list_rejected', shop_id: shopId };
    }

    const listPayload = listResult.payload;
    const observedAt = new Date(now()).toISOString();
    const windowId = `${timeRangeField}:${positiveInteger(timeFrom, 'timeFrom')}-${positiveInteger(timeTo, 'timeTo')}:cursor:${cursor ?? 'root'}`;
    const listSnapshot = await persistOrderListSnapshot({
      channel_account_id: channelAccountId,
      external_entity_id: windowId,
      request_id: sanitizeShopeeRequestId(listPayload),
      observed_at: observedAt,
      payload: listPayload,
      payload_hash: payloadHash(listPayload),
    });
    if (!listSnapshot?.ok) return { ok: false, code: 'order_list_snapshot_failed', shop_id: shopId };

    const listedOrders = orderListFrom(listPayload);
    const orderSns = listedOrders
      .map((order) => typeof order?.order_sn === 'string' ? order.order_sn.trim() : '')
      .filter(Boolean);

    if (orderSns.length === 0) {
      return {
        ok: true,
        shop_id: shopId,
        listed_count: 0,
        detailed_count: 0,
        order_sns: [],
        more: listPayload?.response?.more === true,
        next_cursor: typeof listPayload?.response?.next_cursor === 'string' ? listPayload.response.next_cursor : null,
        duration_ms: now() - started,
      };
    }

    const detailResult = await readOrderDetail({
      fetchImpl, apiBaseUrl: API_BASE_URL,
      orderDetailPath: ORDER_DETAIL_PATH,
      partnerId,
      partnerKey,
      accessToken,
      shopId,
      orderSnList: orderSns,
      responseOptionalFields,
    });

    if (!detailResult.response.ok || parseShopeeError(detailResult.payload)) {
      logger({
        event: 'shopee_live_order_detail_rejected',
        shop_id: shopId,
        status: detailResult.response.status,
        error: typeof detailResult.payload?.error === 'string' ? detailResult.payload.error : null,
        request_id: sanitizeShopeeRequestId(detailResult.payload),
      });
      return { ok: false, code: 'order_detail_rejected', shop_id: shopId, listed_count: orderSns.length };
    }

    const detailedOrders = orderListFrom(detailResult.payload);
    const listedOrderSns = new Set(orderSns);
    const detailedOrderSns = new Set();
    for (const order of detailedOrders) {
      const orderSn = typeof order?.order_sn === 'string' ? order.order_sn.trim() : '';
      if (!orderSn) return { ok: false, code: 'order_detail_missing_order_sn', shop_id: shopId };
      if (!listedOrderSns.has(orderSn) || detailedOrderSns.has(orderSn)) {
        return { ok: false, code: 'order_detail_identity_mismatch', shop_id: shopId };
      }
      detailedOrderSns.add(orderSn);
    }
    if (detailedOrders.length !== orderSns.length) return { ok: false, code: 'order_detail_incomplete', shop_id: shopId };
    for (const order of detailedOrders) {
      const orderSn = typeof order?.order_sn === 'string' ? order.order_sn.trim() : '';
      const singlePayload = buildSingleOrderPayload(detailResult.payload, order);
      const persisted = await persistOrderSnapshot({
        channel_account_id: channelAccountId,
        external_entity_id: orderSn,
        request_id: sanitizeShopeeRequestId(detailResult.payload),
        observed_at: new Date(now()).toISOString(),
        payload: singlePayload,
        payload_hash: payloadHash(singlePayload),
      });
      if (!persisted?.ok) return { ok: false, code: 'order_snapshot_failed', shop_id: shopId };
    }

    return {
      ok: true,
      shop_id: shopId,
      listed_count: orderSns.length,
      detailed_count: detailedOrders.length,
      order_sns: [...detailedOrderSns],
      more: listPayload?.response?.more === true,
      next_cursor: typeof listPayload?.response?.next_cursor === 'string' ? listPayload.response.next_cursor : null,
      duration_ms: now() - started,
    };
  };
}

export const readShopeeLiveOrdersWindow = createShopeeLiveOrdersReader();
