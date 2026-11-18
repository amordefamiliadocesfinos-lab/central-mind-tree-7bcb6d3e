// F3-D: internal, per-account Shopee OAuth refresh. No HTTP route or scheduler.
// Caller must be a trusted internal workflow; Core Bridge independently verifies
// that the account is active canonical Shopee with an enabled approved shop.
import {
  readLiveShopeeOauthRefreshContext,
  refreshLiveShopeeOauthIfCurrent,
} from './core-bridge.mjs';
import { parseShopeeError, refreshToken } from './connectors/shopee-protocol.mjs';
import { decryptShopeeToken, encryptShopeeToken } from './shopee-token-crypto.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PARTNER_ID = 2047685;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ACCESS_FALLBACK_MS = 4 * 60 * 60 * 1000;

function expiry(seconds, ms) {
  const n = Number(seconds);
  return new Date(ms + (Number.isFinite(n) && n > 0 && n <= 604800 ? n * 1000 : ACCESS_FALLBACK_MS)).toISOString();
}
function confirmedShop(payload, shopId) {
  const scalar = payload?.shop_id;
  const list = payload?.shop_id_list;
  // A response with no shop ID is not sufficient for this universal operation.
  if (scalar == null && list == null) return false;
  if (scalar != null && Number(scalar) !== shopId) return false;
  if (list != null && (!Array.isArray(list) || list.length !== 1 || Number(list[0]) !== shopId)) return false;
  return true;
}
function snapshot(payload, accountId) {
  return {
    channel_account_id: accountId,
    partner_id: Number(payload?.partner_id) || null,
    shop_id: Number(payload?.shop_id) || null,
    access_token_expires_at: payload?.access_token_expires_at ?? null,
    refresh_token_expires_at: payload?.refresh_token_expires_at ?? null,
    last_refreshed_at: payload?.last_refreshed_at ?? null,
  };
}

export function createShopeeOauthRefreshForAccount({
  getEnv = name => process.env[name],
  now = Date.now,
  readContext = readLiveShopeeOauthRefreshContext,
  persistIfCurrent = refreshLiveShopeeOauthIfCurrent,
  decrypt = decryptShopeeToken,
  encrypt = encryptShopeeToken,
  refresh = refreshToken,
} = {}) {
  // No route is added by this library. Never pass browser-supplied account IDs here.
  return async function refreshForAccount(accountId) {
    if (typeof accountId !== 'string' || !UUID.test(accountId)) {
      return { ok: false, code: 'invalid_internal_account' };
    }
    const ctx = await readContext({ channel_account_id: accountId });
    if (!ctx?.ok) return { ok: false, code: 'oauth_refresh_context_unavailable' };
    const stored = ctx.payload ?? {};
    const shopId = Number(stored.shop_id);
    if (stored.channel_account_id !== accountId || Number(stored.partner_id) !== PARTNER_ID
      || !Number.isSafeInteger(shopId) || shopId <= 0
      || typeof stored.refresh_token_ciphertext !== 'string' || !stored.refresh_token_ciphertext) {
      return { ok: false, code: 'oauth_refresh_identity_mismatch' };
    }
    const nowMs = now();
    if (!Number.isFinite(Date.parse(String(stored.refresh_token_expires_at)))
      || Date.parse(String(stored.refresh_token_expires_at)) <= nowMs) {
      return { ok: false, code: 'refresh_token_expired', before: snapshot(stored, accountId) };
    }
    const partnerKey = getEnv('SHOPEE_LIVE_PARTNER_KEY');
    const encryptionKey = getEnv('SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY');
    if (typeof partnerKey !== 'string' || !partnerKey
      || typeof encryptionKey !== 'string' || !encryptionKey) {
      return { ok: false, code: 'oauth_refresh_configuration_unavailable' };
    }
    try {
      const refreshTokenValue = await decrypt(stored.refresh_token_ciphertext, encryptionKey);
      const response = await refresh({
        apiBaseUrl: 'https://partner.shopeemobile.com',
        refreshPath: '/api/v2/auth/access_token/get',
        partnerId: PARTNER_ID,
        partnerKey,
        refreshToken: refreshTokenValue,
        shopId,
      });
      if (!response?.response?.ok || parseShopeeError(response.payload)) {
        return { ok: false, code: 'token_refresh_rejected', before: snapshot(stored, accountId) };
      }
      if (!confirmedShop(response.payload, shopId)) {
        return { ok: false, code: 'refreshed_shop_mismatch', before: snapshot(stored, accountId) };
      }
      const nextAccess = String(response.payload?.access_token ?? '');
      const nextRefresh = String(response.payload?.refresh_token ?? '');
      if (!nextAccess || !nextRefresh) return { ok: false, code: 'token_refresh_incomplete' };
      const refreshedAtMs = now();
      const persisted = await persistIfCurrent({
        channel_account_id: accountId, partner_id: PARTNER_ID, shop_id: shopId,
        expected_refresh_token_ciphertext: stored.refresh_token_ciphertext,
        access_token_ciphertext: await encrypt(nextAccess, encryptionKey),
        refresh_token_ciphertext: await encrypt(nextRefresh, encryptionKey),
        access_token_expires_at: expiry(response.payload?.expire_in, refreshedAtMs),
        refresh_token_expires_at: new Date(refreshedAtMs + REFRESH_TTL_MS).toISOString(),
        last_refreshed_at: new Date(refreshedAtMs).toISOString(),
      });
      if (!persisted?.ok) {
        return { ok: false, code: persisted?.status === 409 ? 'oauth_refresh_stale_or_revoked' : 'oauth_refresh_persistence_failed' };
      }
      const after = await readContext({ channel_account_id: accountId });
      if (!after?.ok || after.payload?.channel_account_id !== accountId
        || Number(after.payload?.shop_id) !== shopId) {
        return { ok: false, code: 'post_refresh_identity_unavailable' };
      }
      return { ok: true, code: 'oauth_refreshed_for_account',
        before: snapshot(stored, accountId), after: snapshot(after.payload, accountId) };
    } catch {
      return { ok: false, code: 'oauth_refresh_execution_unavailable' };
    }
  };
}

export const refreshShopeeOauthForAccount = createShopeeOauthRefreshForAccount();
