import { readLiveShopeeOauthConnection } from './core-bridge.mjs';
import { decryptShopeeToken } from './shopee-token-crypto.mjs';
import {
  getOrderDetail,
  getShippingParameter,
  parseShopeeError,
} from './connectors/shopee-protocol.mjs';

const API_BASE_URL = 'https://partner.shopeemobile.com';
const ORDER_DETAIL_PATH = '/api/v2/order/get_order_detail';
const SHIPPING_PARAMETER_PATH = '/api/v2/logistics/get_shipping_parameter';
const PILOT_MODES = new Set(['pj_shopee_issuer', 'cpf_no_invoice_step']);
const PACKAGE_RE = /^[A-Za-z0-9_-]{1,100}$/;
const ORDER_RE = /^[A-Za-z0-9]{8,100}$/;
const REQUIREMENT_KEYS = new Set(['pickup', 'dropoff', 'non_integrated']);
// get_shipping_parameter requires package-level eligibility, not only order status.
// LOGISTICS_REQUEST_CREATED additionally requires Instant Order reschedule rules,
// which this initial read-only preflight does not implement.
const ELIGIBLE_PACKAGE_STATUSES = new Set(['LOGISTICS_READY', 'LOGISTICS_PICKUP_RETRY']);

function requiredEnv(getEnv, key) {
  const value = getEnv(key);
  if (typeof value !== 'string' || !value.trim()) throw new Error('missing_' + key);
  return value.trim();
}

function positiveInteger(value, field) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new TypeError('invalid_' + field);
  return n;
}

function singlePackage(order) {
  const packages = order?.package_list;
  if (packages == null || (Array.isArray(packages) && packages.length === 0)) {
    return { ok: true, packageNumber: null };
  }
  if (!Array.isArray(packages) || packages.length !== 1) {
    return { ok: false, code: 'multiple_or_unknown_packages' };
  }
  const packageNumber = String(packages[0]?.package_number ?? '').trim();
  return PACKAGE_RE.test(packageNumber)
    ? { ok: true, packageNumber, logisticsStatus: packages[0]?.logistics_status }
    : { ok: false, code: 'package_identity_missing' };
}

export function assessFiscalReadiness(order, fiscalMode) {
  if (!PILOT_MODES.has(fiscalMode)) {
    return { ready: false, code: 'fiscal_profile_not_configured' };
  }
  const invoice = order?.invoice_data;
  const status = typeof invoice?.status === 'string' ? invoice.status.toLowerCase().trim() : null;
  // Fiscal pendency reported by Shopee blocks both paths, regardless of CPF/PJ.
  if (status === 'pending' || order?.invoice_pending?.status === 'pending') {
    return { ready: false, code: 'invoice_pending_in_seller_center' };
  }
  if (fiscalMode === 'pj_shopee_issuer') {
    return status === 'valid'
      ? { ready: true, code: 'fiscal_valid' }
      : { ready: false, code: 'fiscal_not_confirmed_by_shopee' };
  }
  // Operational CPF pilot profile, explicitly configured for its specific account.
  // This is NOT a legal determination of tax exemption, nor authorization to ship.
  return status && status !== 'valid'
    ? { ready: false, code: 'fiscal_review_required' }
    : { ready: true, code: 'cpf_flow_fiscal_check_passed' };
}

export function summarizeShippingRequirements(payload) {
  const info = payload?.response?.info_needed;
  if (!info || typeof info !== 'object' || Array.isArray(info)) {
    return { ok: false, code: 'shipping_requirements_missing' };
  }
  const keys = Object.keys(info);
  if (keys.some(key => !REQUIREMENT_KEYS.has(key))) {
    return { ok: false, code: 'unsupported_shipping_requirements' };
  }
  const modes = [];
  for (const key of keys) {
    if (info[key] === null || info[key] === undefined) continue;
    if (!Array.isArray(info[key])) {
      return { ok: false, code: 'unrecognized_shipping_requirements' };
    }
    modes.push(key);
  }
  if (modes.length === 0) {
    return { ok: false, code: 'shipping_mode_not_identified' };
  }
  return {
    ok: true,
    code: 'shipping_options_identified',
    modes: modes.sort(),
    // Pickup address/slot, dropoff point, or carrier data must be selected using
    // documented validated choices before a separate ship_order writer is allowed.
    autoArrangementAuthorized: false,
  };
}

export function createShopeeShippingPreflight({
  getEnv = key => process.env[key],
  now = Date.now,
  readConnection = readLiveShopeeOauthConnection,
  decryptToken = decryptShopeeToken,
  readOrderDetail = getOrderDetail,
  readShippingParameter = getShippingParameter,
} = {}) {
  return async function inspectShippingPreflight() {
    const orderSn = requiredEnv(getEnv, 'SHOPEE_LIVE_SHIPPING_PREFLIGHT_ORDER_SN');
    const accountId = requiredEnv(getEnv, 'SHOPEE_LIVE_CHANNEL_ACCOUNT_ID');
    const fiscalMode = requiredEnv(getEnv, 'SHOPEE_LIVE_SHIPPING_FISCAL_MODE');
    if (!ORDER_RE.test(orderSn)) return { ok: false, code: 'invalid_order_identity' };
    if (!PILOT_MODES.has(fiscalMode)) {
      return { ok: false, code: 'fiscal_profile_not_configured' };
    }
    const partnerId = positiveInteger(requiredEnv(getEnv, 'SHOPEE_LIVE_PARTNER_ID'), 'partner_id');
    const partnerKey = requiredEnv(getEnv, 'SHOPEE_LIVE_PARTNER_KEY');
    const encryptionKey = requiredEnv(getEnv, 'SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY');
    const connection = await readConnection({ channel_account_id: accountId });
    if (!connection?.ok || !connection?.payload) {
      return { ok: false, code: 'oauth_connection_unavailable' };
    }
    const oauth = connection.payload;
    if (positiveInteger(oauth.partner_id, 'stored_partner_id') !== partnerId) {
      return { ok: false, code: 'partner_id_mismatch' };
    }
    const shopId = positiveInteger(oauth.shop_id, 'shop_id');
    const expiresAt = Date.parse(String(oauth.access_token_expires_at ?? ''));
    if (!Number.isFinite(expiresAt) || expiresAt <= now() + 60_000) {
      return { ok: false, code: 'access_token_expired_read_only' };
    }
    const accessToken = await decryptToken(oauth.access_token_ciphertext, encryptionKey);
    const signed = { apiBaseUrl: API_BASE_URL, partnerId, partnerKey, shopId, accessToken };
    const detail = await readOrderDetail({
      ...signed, orderDetailPath: ORDER_DETAIL_PATH,
      orderSnList: [orderSn],
      responseOptionalFields: ['package_list', 'invoice_data', 'shipping_carrier'],
    });
    if (!detail?.response?.ok || parseShopeeError(detail.payload)) {
      return { ok: false, code: 'order_detail_rejected' };
    }
    const orders = detail.payload?.response?.order_list;
    if (!Array.isArray(orders) || orders.length !== 1 || orders[0]?.order_sn !== orderSn) {
      return { ok: false, code: 'order_identity_mismatch' };
    }
    const order = orders[0];
    const pkg = singlePackage(order);
    if (!pkg.ok) return { ok: false, code: pkg.code };
    const orderStatus = String(order.order_status ?? '').trim().toUpperCase();
    if (orderStatus !== 'READY_TO_SHIP') {
      return { ok: false, code: 'order_not_ready_to_ship', order_status: orderStatus || 'unknown' };
    }
    const fiscal = assessFiscalReadiness(order, fiscalMode);
    if (!fiscal.ready) {
      return { ok: false, code: fiscal.code, order_status: orderStatus };
    }
    if (!ELIGIBLE_PACKAGE_STATUSES.has(pkg.logisticsStatus)) {
      return {
        ok: false,
        code: pkg.logisticsStatus === 'LOGISTICS_REQUEST_CREATED'
          ? 'package_reschedule_not_supported' : 'package_not_ready_for_shipping_parameter',
        order_status: orderStatus,
      };
    }
    const params = await readShippingParameter({
      ...signed, shippingParameterPath: SHIPPING_PARAMETER_PATH,
      orderSn, packageNumber: pkg.packageNumber,
    });
    if (!params?.response?.ok || parseShopeeError(params.payload)) {
      return { ok: false, code: 'shipping_parameter_rejected', order_status: orderStatus };
    }
    const shipping = summarizeShippingRequirements(params.payload);
    if (!shipping.ok) return { ok: false, code: shipping.code, order_status: orderStatus };
    return {
      ok: true,
      code: shipping.code,
      order_status: orderStatus,
      fiscal: fiscal.code,
      modes: shipping.modes,
      auto_arrangement_authorized: false,
      // Deliberately no raw address, branch, signature, token, invoice or buyer PII.
    };
  };
}

export const inspectShopeeShippingPreflight = createShopeeShippingPreflight();
