import {
  readLiveShopeeOauthConnection,
  refreshLiveShopeeOauthConnection,
} from './core-bridge.mjs';
import {
  parseShopeeError,
  refreshToken,
} from './connectors/shopee-protocol.mjs';
import {
  decryptShopeeToken,
  encryptShopeeToken,
} from './shopee-token-crypto.mjs';

const API_BASE_URL = 'https://partner.shopeemobile.com';
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

function isExpired(value, nowMs, safetyMs = 0) {
  const parsed = Date.parse(String(value ?? ''));
  return !Number.isFinite(parsed) || parsed <= nowMs + safetyMs;
}

function accessTokenExpiry(expireIn, nowMs) {
  const seconds = Number(expireIn);
  if (Number.isFinite(seconds) && seconds > 0 && seconds <= 7 * 24 * 60 * 60) {
    return new Date(nowMs + seconds * 1000).toISOString();
  }
  return new Date(nowMs + ACCESS_TOKEN_FALLBACK_TTL_MS).toISOString();
}

function safeConnectionSnapshot(payload) {
  return {
    channel_account_id: typeof payload?.channel_account_id === 'string' ? payload.channel_account_id : null,
    partner_id: Number.isSafeInteger(Number(payload?.partner_id)) ? Number(payload.partner_id) : null,
    shop_id: Number.isSafeInteger(Number(payload?.shop_id)) ? Number(payload.shop_id) : null,
    access_token_expires_at:
      typeof payload?.access_token_expires_at === 'string' ? payload.access_token_expires_at : null,
    refresh_token_expires_at:
      typeof payload?.refresh_token_expires_at === 'string' ? payload.refresh_token_expires_at : null,
    last_refreshed_at:
      typeof payload?.last_refreshed_at === 'string' ? payload.last_refreshed_at : null,
  };
}

export function createShopeeOauthRefreshOnce({
  getEnv = (name) => process.env[name],
  now = Date.now,
  readConnection = readLiveShopeeOauthConnection,
  persistRefresh = refreshLiveShopeeOauthConnection,
  decryptToken = decryptShopeeToken,
  encryptToken = encryptShopeeToken,
  refreshAccessToken = refreshToken,
} = {}) {
  return async function refreshShopeeOauthOnce() {
    const partnerId = positiveInteger(requiredEnv(getEnv, 'SHOPEE_LIVE_PARTNER_ID'), 'SHOPEE_LIVE_PARTNER_ID');
    const partnerKey = requiredEnv(getEnv, 'SHOPEE_LIVE_PARTNER_KEY');
    const channelAccountId = requiredEnv(getEnv, 'SHOPEE_LIVE_CHANNEL_ACCOUNT_ID');
    const tokenEncryptionKey = requiredEnv(getEnv, 'SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY');

    const before = await readConnection({ channel_account_id: channelAccountId });
    if (!before?.ok) return { ok: false, code: 'oauth_connection_unavailable' };

    const beforePayload = before.payload ?? {};
    const storedPartnerId = positiveInteger(beforePayload.partner_id, 'stored partner_id');
    const shopId = positiveInteger(beforePayload.shop_id, 'stored shop_id');
    if (storedPartnerId !== partnerId) {
      return { ok: false, code: 'partner_id_mismatch', before: safeConnectionSnapshot(beforePayload) };
    }

    const nowMs = now();
    if (isExpired(beforePayload.refresh_token_expires_at, nowMs)) {
      return {
        ok: false,
        code: 'refresh_token_expired',
        before: safeConnectionSnapshot(beforePayload),
      };
    }

    const refreshTokenValue = await decryptToken(
      beforePayload.refresh_token_ciphertext,
      tokenEncryptionKey,
    );

    const refreshed = await refreshAccessToken({
      apiBaseUrl: API_BASE_URL,
      refreshPath: REFRESH_PATH,
      partnerId,
      partnerKey,
      refreshToken: refreshTokenValue,
      shopId,
    });

    const refreshError = parseShopeeError(refreshed.payload);
    if (!refreshed.response.ok || refreshError) {
      return {
        ok: false,
        code: 'token_refresh_rejected',
        shopee_status: Number(refreshed.response?.status ?? 0),
        shopee_error: refreshError || null,
        before: safeConnectionSnapshot(beforePayload),
      };
    }

    const newAccessToken = String(refreshed.payload?.access_token ?? '').trim();
    const newRefreshToken = String(refreshed.payload?.refresh_token ?? '').trim();
    if (!newAccessToken || !newRefreshToken) {
      return {
        ok: false,
        code: 'token_refresh_incomplete',
        before: safeConnectionSnapshot(beforePayload),
      };
    }

    const refreshedAtMs = now();
    const refreshedAt = new Date(refreshedAtMs).toISOString();
    const persisted = await persistRefresh({
      channel_account_id: channelAccountId,
      access_token_ciphertext: await encryptToken(newAccessToken, tokenEncryptionKey),
      refresh_token_ciphertext: await encryptToken(newRefreshToken, tokenEncryptionKey),
      access_token_expires_at: accessTokenExpiry(refreshed.payload?.expire_in, refreshedAtMs),
      refresh_token_expires_at: new Date(refreshedAtMs + REFRESH_TTL_MS).toISOString(),
      last_refreshed_at: refreshedAt,
    });
    if (!persisted?.ok) {
      return {
        ok: false,
        code: 'token_refresh_persistence_failed',
        before: safeConnectionSnapshot(beforePayload),
      };
    }

    const after = await readConnection({ channel_account_id: channelAccountId });
    if (!after?.ok) {
      return {
        ok: false,
        code: 'post_refresh_read_failed',
        before: safeConnectionSnapshot(beforePayload),
      };
    }

    return {
      ok: true,
      code: 'oauth_refreshed',
      before: safeConnectionSnapshot(beforePayload),
      after: safeConnectionSnapshot(after.payload ?? {}),
    };
  };
}

export const refreshShopeeOauthOnce = createShopeeOauthRefreshOnce();
