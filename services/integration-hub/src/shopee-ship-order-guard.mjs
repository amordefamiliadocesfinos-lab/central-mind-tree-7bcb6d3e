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

/** Shopee's ship_order success contract does not require a response object. */
const SAFE_SHOPEE_ERRORS = new Set([
  'error_auth', 'error_param', 'error_permission', 'error_api_permission',
  'error_sign', 'error_rate_limit', 'error_api_call_restricted',
  'source_ip_undeclared', 'logistics.error_param',
  'logistics.error_order_state', 'logistics.business_process_error',
  'logistics.business_validation_error', 'logistics.feature_not_supported',
  'logistics.ship_order_not_ready_to_ship', 'logistics.ship_order_need_branch_id',
  'logistics.ship_order_need_sender_real_name', 'logistics.ship_order_need_pacakge_number',
  'logistics.ship_order_not_need_pacakge_number', 'logistics.lack_of_invoice_data',
]);
const SAFE_EXCEPTION_NAMES = new Set(['AbortError', 'TimeoutError', 'TypeError', 'SyntaxError']);

function inspectShipOrderAcknowledgement(response) {
  const status = response?.response?.status;
  const httpOk = response?.response?.ok === true
    && Number.isInteger(status) && status >= 200 && status < 300;
  const payload = response?.payload;
  const knownError = SAFE_SHOPEE_ERRORS.has(payload?.error) ? payload.error : null;
  if (!httpOk) return { acknowledged: false, category: 'http_rejected', knownError };
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { acknowledged: false, category: 'unexpected_response', knownError: null };
  }
  if (payload.error === 'invalid_json') {
    return { acknowledged: false, category: 'invalid_json', knownError: null };
  }
  if (typeof payload.error !== 'string') {
    return { acknowledged: false, category: 'unexpected_response', knownError: null };
  }
  if (payload.error !== '') {
    return { acknowledged: false, category: 'shopee_error', knownError };
  }
  // The published v2.logistics.ship_order success example only contains
  // error:"", message:"", request_id:"..."; response is not required.
  if (Object.hasOwn(payload, 'response') &&
      (!payload.response || typeof payload.response !== 'object' ||
       Array.isArray(payload.response))) {
    return { acknowledged: false, category: 'unexpected_response', knownError: null };
  }
  return { acknowledged: true, category: 'api_acknowledged', knownError: null };
}

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
 * Executor for the gated private pilot route; never scheduled automatically.
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
  // Structured, allowlisted Cloud Logging events; never output signed URLs or payloads.
  logDiagnostic = entry => console.log(JSON.stringify(entry)),
} = {}) {
  return async function shipOrderOnce() {
    // Always refuse before touching the Core or Shopee when not explicitly armed.
    if (String(getEnv('SHOPEE_LIVE_SHIP_ORDER_ENABLED') ?? '').trim().toLowerCase() !== 'true') {
      return { ok: false, code: 'ship_order_disabled' };
    }
    let orderSn, channelAccountId, pilotPackageNumber, pilotShopId, fiscalMode, windowExpiresAt;
    try {
      orderSn = envRequired(getEnv, 'SHOPEE_LIVE_SHIPPING_PREFLIGHT_ORDER_SN');
      channelAccountId = envRequired(getEnv, 'SHOPEE_LIVE_CHANNEL_ACCOUNT_ID');
      pilotPackageNumber = envRequired(getEnv, 'SHOPEE_LIVE_SHIP_ORDER_PILOT_PACKAGE_NUMBER');
      pilotShopId = positiveSafeInteger(envRequired(getEnv, 'SHOPEE_LIVE_SHIP_ORDER_PILOT_SHOP_ID'));
      fiscalMode = envRequired(getEnv, 'SHOPEE_LIVE_SHIPPING_FISCAL_MODE');
      if (envRequired(getEnv, 'SHOPEE_LIVE_SHIP_ORDER_PILOT_ORDER_SN') !== orderSn
          || envRequired(getEnv, 'SHOPEE_LIVE_SHIP_ORDER_PILOT_ACCOUNT_ID') !== channelAccountId
          || envRequired(getEnv, 'SHOPEE_LIVE_SHIP_ORDER_PILOT_FISCAL_MODE') !== fiscalMode
          || !pilotShopId
          || !['pj_shopee_issuer','cpf_no_invoice_step'].includes(fiscalMode)
          || !/^[A-Za-z0-9_-]{1,100}$/.test(pilotPackageNumber)) {
        return { ok: false, code: 'ship_order_pilot_scope_mismatch' };
      }
      // A permanent true flag alone cannot authorize a dispatch. The window
      // must be explicit, UTC, unexpired, and at most 30 minutes from now.
      const expiry = envRequired(getEnv, 'SHOPEE_LIVE_SHIP_ORDER_WINDOW_EXPIRES_AT');
      const expiryMs = Date.parse(expiry);
      const left = expiryMs - now();
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(expiry)
          || !Number.isFinite(expiryMs)
          || new Date(expiryMs).toISOString().slice(0, 19) !== expiry.slice(0, 19)
          || left <= 60_000 || left > 30 * 60_000) {
        return { ok: false, code: 'ship_order_window_inactive' };
      }
      windowExpiresAt = expiryMs;
    } catch {
      return { ok: false, code: 'ship_order_pilot_not_configured' };
    }
    const partnerId = positiveSafeInteger(envRequired(getEnv, 'SHOPEE_LIVE_PARTNER_ID'));
    const partnerKey = envRequired(getEnv, 'SHOPEE_LIVE_PARTNER_KEY');
    const key = envRequired(getEnv, 'SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY');
    if (!partnerId) return { ok: false, code: 'partner_not_configured' };

    let proof;
    try { proof = await preflight(); } catch { return { ok: false, code: 'preflight_unavailable' }; }
    if (proof?.ok !== true || proof.order_sn !== orderSn
        || proof.package_number !== pilotPackageNumber
        || proof.shop_id !== pilotShopId
        || proof.package_logistics_status !== 'LOGISTICS_READY'
        || proof.order_status !== 'READY_TO_SHIP'
        || proof.fiscal !== (fiscalMode === 'pj_shopee_issuer'
          ? 'fiscal_valid' : 'cpf_flow_fiscal_check_passed')
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
    // The window is checked again immediately before acquiring an irreversible
    // claim. A claim never authorizes automatic retries after expiry.
    const remaining = windowExpiresAt - now();
    if (!Number.isFinite(remaining) || remaining <= 60_000) {
      return { ok: false, code: 'ship_order_window_inactive' };
    }
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
    let phase = 'preparation';
    let externalHttpStatus = null;
    const diagnosticStart = now();
    const diagnostic = (step, category = null, knownError = null, exceptionName = null) => {
      // Construct a fixed schema. Never log an upstream message/body, URL, token,
      // request hash, address or exception text. Logging is never a dependency.
      try {
        const elapsed = now() - diagnosticStart;
        logDiagnostic({
          event: 'shopee_ship_order_diagnostic',
          attempt_id: attemptId,
          phase: step,
          category,
          external_http_status: externalHttpStatus,
          duration_ms: Number.isFinite(elapsed) ? Math.max(0, Math.round(elapsed)) : null,
          shopee_error_code: SAFE_SHOPEE_ERRORS.has(knownError) ? knownError : null,
          exception_name: SAFE_EXCEPTION_NAMES.has(exceptionName) ? exceptionName : null,
        });
      } catch { /* Logs must not affect dispatch or idempotency. */ }
    };
    diagnostic(phase);
    try {
      // A claim may take time to persist. Refuse transport if the approved
      // window expired after reservation; retain an uncertain locked attempt.
      const remainingAfterClaim = windowExpiresAt - now();
      if (!Number.isFinite(remainingAfterClaim) || remainingAfterClaim <= 0) {
        throw new Error('window_expired_after_claim');
      }
      const response = await ship({
        apiBaseUrl: API_BASE, shipOrderPath: SHIPPING_PATH,
        partnerId, partnerKey, accessToken, shopId,
        orderSn, packageNumber: proof.package_number, infoNeeded: { dropoff: [] },
        fetchImpl: async (url, options) => {
          // Signing/preparation can cross the deadline after the earlier check.
          // Keep the originally approved expiry and check at the network boundary.
          const remainingAtTransport = windowExpiresAt - now();
          if (!Number.isFinite(remainingAtTransport) || remainingAtTransport <= 0) {
            throw new Error('window_expired_before_transport');
          }
          const parsed = new URL(url);
          if (parsed.origin !== API_BASE || parsed.pathname !== SHIPPING_PATH) {
            throw new Error('untrusted_shopee_transport');
          }
          phase = 'fetch_invoked';
          diagnostic(phase);
          const upstream = await fetchImpl(url, {
            ...options, redirect: 'error',
            signal: AbortSignal.timeout(Math.max(1, Math.min(15000, Math.floor(remainingAtTransport)))),
          });
          externalHttpStatus = Number.isInteger(upstream?.status) ? upstream.status : null;
          phase = 'headers_received';
          diagnostic(phase);
          return upstream;
        },
      });
      // The shared signedShopPost has read and parsed the response at this point.
      externalHttpStatus = Number.isInteger(response?.response?.status)
        ? response.response.status : externalHttpStatus;
      phase = 'body_read';
      const assessment = inspectShipOrderAcknowledgement(response);
      diagnostic(phase, assessment.category, assessment.knownError);
      if (assessment.acknowledged) outcome = 'succeeded';
    } catch (error) {
      // Do not confuse a local exception with proof Shopee did or did not receive a POST.
      const category = phase === 'headers_received' ? 'response_read_exception'
        : phase === 'fetch_invoked' ? 'transport_exception' : 'pre_transport_exception';
      diagnostic('exception', category, null, error?.name);
      // Network ambiguity: never call ship_order again.
    }

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
