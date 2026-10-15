import { createHash } from 'node:crypto';
import {
  claimShopeeShippingArrangement,
  resolveShopeeShippingArrangement,
  readLiveShopeeOauthConnection,
} from './core-bridge.mjs';
import { decryptShopeeToken } from './shopee-token-crypto.mjs';
import { inspectShopeeShippingPreflight } from './shopee-shipping-preflight.mjs';
import {
  buildSimpleDropoffRequest,
  shipOrderSimpleDropoff,
  parseShopeeError,
} from './connectors/shopee-protocol.mjs';

const API_BASE = 'https://partner.shopeemobile.com';
const SHIPPING_PATH = '/api/v2/logistics/ship_order';

function envRequired(env, key) {
  const value = env(key);
  if (typeof value !== 'string' || !value.trim()) throw new Error('missing_' + key);
  return value.trim();
}

function positiveSafeInteger(value) {
  const result = Number(value);
  return Number.isSafeInteger(result) && result > 0 ? result : null;
}

/**
 * Prepared executor, NOT exposed by any HTTP route/scheduler.
 * The caller can never bypass a fresh Shopee preflight or the durable
 * Core claim. The only supported form is simple dropoff with empty info_needed.
 */
export function createGuardedShopeeShipOrder({
  getEnv = key => process.env[key],
  now = Date.now,
  preflight = inspectShopeeShippingPreflight,
  readConnection = readLiveShopeeOauthConnection,
  decryptToken = decryptShopeeToken,
  claim = claimShopeeShippingArrangement,
  resolve = resolveShopeeShippingArrangement,
  ship = shipOrderSimpleDropoff,
  fetchImpl = globalThis.fetch,
} = {}) {
  return async function shipOrderOnce() {
    // Always refuse before touching the Core or Shopee when not explicitly armed.
    if (String(getEnv('SHOPEE_LIVE_SHIP_ORDER_ENABLED') ?? '').trim().toLowerCase() !== 'true') {
      return { ok: false, code: 'ship_order_disabled' };
    }
    const orderSn = envRequired(getEnv, 'SHOPEE_LIVE_SHIPPING_PREFLIGHT_ORDER_SN');
    const channelAccountId = envRequired(getEnv, 'SHOPEE_LIVE_CHANNEL_ACCOUNT_ID');
    const partnerId = positiveSafeInteger(envRequired(getEnv, 'SHOPEE_LIVE_PARTNER_ID'));
    const partnerKey = envRequired(getEnv, 'SHOPEE_LIVE_PARTNER_KEY');
    const key = envRequired(getEnv, 'SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY');
    if (!partnerId) return { ok: false, code: 'partner_not_configured' };

    let proof;
    try { proof = await preflight(); } catch { return { ok: false, code: 'preflight_unavailable' }; }
    if (proof?.ok !== true || proof.order_sn !== orderSn
        || proof.simple_dropoff_confirmed !== true
        || !Array.isArray(proof.modes) || proof.modes.length !== 1 || proof.modes[0] !== 'dropoff'
        || !/^[A-Za-z0-9_-]{1,100}$/.test(String(proof.package_number ?? ''))) {
      return { ok: false, code: 'preflight_not_eligible' };
    }
    const shopId = positiveSafeInteger(proof.shop_id);
    if (!shopId) return { ok: false, code: 'preflight_shop_missing' };
    const oauth = await readConnection({ channel_account_id: channelAccountId });
    if (!oauth?.ok || !oauth.payload || positiveSafeInteger(oauth.payload.shop_id) !== shopId
        || positiveSafeInteger(oauth.payload.partner_id) !== partnerId) {
      return { ok: false, code: 'connection_identity_mismatch' };
    }
    const expires = Date.parse(String(oauth.payload.access_token_expires_at ?? ''));
    if (!Number.isFinite(expires) || expires <= now() + 60_000) {
      return { ok: false, code: 'access_token_expired_no_refresh' };
    }
    let accessToken;
    try { accessToken = await decryptToken(oauth.payload.access_token_ciphertext, key); }
    catch { return { ok: false, code: 'token_unavailable' }; }

    const body = buildSimpleDropoffRequest({
      orderSn, packageNumber: proof.package_number, infoNeeded: { dropoff: [] },
    });
    const requestHash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    const metadata = {
      channel_account_id: channelAccountId,
      shop_id: shopId,
      order_sn: orderSn,
      package_number: proof.package_number,
      request_hash: requestHash,
    };
    let reserved;
    try { reserved = await claim(metadata); }
    catch { return { ok: false, code: 'shipping_claim_not_acquired' }; }
    if (reserved?.ok !== true || reserved.payload?.status !== 'claimed'
        || reserved.payload?.fresh !== true
        || typeof reserved.payload?.attempt_id !== 'string') {
      return {
        ok: false, code: reserved?.payload?.code ?? 'shipping_claim_not_acquired',
      };
    }

    const attemptId = reserved.payload.attempt_id;
    // After reservation, ANY transport ambiguity must keep the one-shot claim.
    let outcome = 'uncertain';
    try {
      const response = await ship({
        apiBaseUrl: API_BASE, shipOrderPath: SHIPPING_PATH,
        partnerId, partnerKey, accessToken, shopId,
        orderSn, packageNumber: proof.package_number, infoNeeded: { dropoff: [] },
        fetchImpl: (url, options) => {
          const parsed = new URL(url);
          if (parsed.origin !== API_BASE || parsed.pathname !== SHIPPING_PATH) {
            throw new Error('untrusted_shopee_transport');
          }
          return fetchImpl(url, {
            ...options, redirect: 'error', signal: AbortSignal.timeout(15000),
          });
        },
      });
      if (response?.response?.ok === true
          && response.payload?.error === ''
          && response.payload?.response && typeof response.payload.response === 'object'
          && !Array.isArray(response.payload.response)
          && parseShopeeError(response.payload) === '') {
        outcome = 'succeeded';
      }
    } catch { /* Network ambiguity: never call ship_order again. */ }

    // If Core cannot acknowledge a result, the unique claim remains and
    // blocks all future dispatches. Never report automatic success.
    let completion;
    try {
      completion = await resolve({ attempt_id: attemptId, request_hash: requestHash, outcome });
    } catch { completion = null; }
    if (completion?.ok !== true
        || !['resolved', 'already_resolved'].includes(completion?.payload?.status)
        || completion?.payload?.state !== outcome) {
      return { ok: false, code: 'sent_but_core_confirmation_missing' };
    }
    return outcome === 'succeeded'
      ? { ok: true, code: 'ship_order_api_acknowledged_not_collected' }
      : { ok: false, code: 'ship_order_uncertain_requires_reconciliation' };
  };
}

export const guardedShopeeShipOrder = createGuardedShopeeShipOrder();
