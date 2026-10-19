import { createHash } from 'node:crypto';
import { readLiveShopeeOauthConnection, claimShopeeShippingDocument, resolveShopeeShippingDocument } from './core-bridge.mjs';
import { decryptShopeeToken } from './shopee-token-crypto.mjs';
import { getOrderDetail, getTrackingNumber, getShippingDocumentParameter,
  createShippingDocument, getShippingDocumentResult } from './connectors/shopee-protocol.mjs';
import { createShopeeLabelSynchronizer } from './shopee-live-label.mjs';

const API = 'https://partner.shopeemobile.com';
const TYPE = 'NORMAL_AIR_WAYBILL';
const PILOTS = Object.freeze([
  Object.freeze({ account: '8a8ad166-0317-4597-8be6-e43fb46b4d1b',
    shop: 531736366, partner: 2047685, order: '261017T5TF35CH', package: 'OFG245899610150874' }),
  Object.freeze({ account: '8a8ad166-0317-4597-8be6-e43fb46b4d1b',
    shop: 531736366, partner: 2047685, order: '2610203UYY7N0T', package: 'OFG246133145190444',
    tracking: 'BR262168766782H' }),
]);
const PATHS = new Set(['/api/v2/order/get_order_detail', '/api/v2/logistics/get_tracking_number',
  '/api/v2/logistics/get_shipping_document_parameter', '/api/v2/logistics/create_shipping_document',
  '/api/v2/logistics/get_shipping_document_result']);
const fail = code => ({ ok: false, code });
const clean = r => r?.response?.ok === true && r.payload?.error === '';
function entry(r, scope, allowMissingPackage = false) {
  const rows = r?.payload?.response?.result_list;
  if (!clean(r) || !Array.isArray(rows) || rows.length !== 1) return null;
  const row = rows[0];
  return row?.order_sn === scope.order && (row.package_number === scope.package
    || (allowMissingPackage && row.package_number === undefined))
    && (row.fail_error == null || row.fail_error === '') ? row : null;
}

/** One durable POST at most. Only read-only status polling may repeat.
 * A lost acknowledgement keeps the claim locked; it never authorizes resending.
 */
export function createShopeeLabelPreparation({
  getEnv = k => process.env[k], now = Date.now,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  readConnection = readLiveShopeeOauthConnection, decryptToken = decryptShopeeToken,
  readDetail = getOrderDetail, readTracking = getTrackingNumber,
  readParameter = getShippingDocumentParameter, createDocument = createShippingDocument,
  readResult = getShippingDocumentResult, claim = claimShopeeShippingDocument,
  resolve = resolveShopeeShippingDocument, fetchImpl = globalThis.fetch,
  syncLabel,
} = {}) {
  return async function prepareLabelOnce() {
    const enabled = k => String(getEnv(k) ?? '').trim().toLowerCase() === 'true';
    if (!enabled('SHOPEE_LIVE_LABEL_CREATE_ENABLED')) return fail('label_create_not_enabled');
    if (!enabled('SHOPEE_LIVE_LABEL_SYNC_ENABLED')) return fail('label_sync_not_enabled');
    const scope = PILOTS.find(pilot =>
      getEnv('SHOPEE_LIVE_CHANNEL_ACCOUNT_ID') === pilot.account
      && getEnv('SHOPEE_LIVE_LABEL_ORDER_SN') === pilot.order
      && getEnv('SHOPEE_LIVE_LABEL_PACKAGE_NUMBER') === pilot.package
      && Number(getEnv('SHOPEE_LIVE_LABEL_SHOP_ID')) === pilot.shop
      && Number(getEnv('SHOPEE_LIVE_PARTNER_ID')) === pilot.partner);
    if (!scope) return fail('label_pilot_scope_mismatch');
    const expiry = getEnv('SHOPEE_LIVE_LABEL_CREATE_WINDOW_EXPIRES_AT');
    const deadline = Date.parse(expiry ?? '');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(expiry ?? '')
        || !Number.isFinite(deadline) || new Date(deadline).toISOString().slice(0,19) !== expiry.slice(0,19)
        || deadline - now() <= 60000 || deadline - now() > 30 * 60000) return fail('label_window_inactive');
    const started = now();
    // Fits the existing 60s Cloud Run request budget. Each read is bounded too.
    const budget = Math.min(deadline, started + 45000);
    let shared;
    try {
      const c = await readConnection({ channel_account_id: scope.account });
      if (!c?.ok || Number(c.payload?.shop_id) !== scope.shop
          || Number(c.payload?.partner_id) !== scope.partner) return fail('connection_identity_mismatch');
      if (!(Date.parse(c.payload.access_token_expires_at) > now() + 60000)) return fail('access_token_expired_no_refresh');
      const token = await decryptToken(c.payload.access_token_ciphertext, getEnv('SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY'));
      const transport = (url, options = {}) => {
        const u = new URL(url), remaining = budget - now();
        if (u.origin !== API || !PATHS.has(u.pathname) || remaining <= 0) throw new Error('transport_refused');
        return fetchImpl(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(Math.max(1, Math.min(5000, Math.floor(remaining)))) });
      };
      shared = { apiBaseUrl: API, partnerId: scope.partner, partnerKey: getEnv('SHOPEE_LIVE_PARTNER_KEY'),
        shopId: scope.shop, accessToken: token, fetchImpl: transport };
      const detail = await readDetail({ ...shared, orderDetailPath: '/api/v2/order/get_order_detail',
        orderSnList: [scope.order], responseOptionalFields: ['package_list', 'invoice_data'] });
      const orders = detail?.payload?.response?.order_list;
      if (!clean(detail) || orders?.length !== 1 || orders[0]?.order_sn !== scope.order) return fail('order_identity_mismatch');
      const order = orders[0];
      if (order.order_status !== 'PROCESSED' || order.invoice_data?.status !== 'valid'
          || order.package_list?.length !== 1 || order.package_list[0]?.package_number !== scope.package
          || order.package_list[0]?.logistics_status !== 'LOGISTICS_REQUEST_CREATED') return fail('arranged_package_or_invoice_not_confirmed');
      const params = entry(await readParameter({ ...shared,
        shippingDocumentParameterPath: '/api/v2/logistics/get_shipping_document_parameter',
        orderList: [{ order_sn: scope.order, package_number: scope.package }] }), scope);
      if (!params?.selectable_shipping_document_type?.includes(TYPE)) return fail('normal_air_waybill_unavailable');
      const tracking = await readTracking({ ...shared, getTrackingNumberPath: '/api/v2/logistics/get_tracking_number',
        orderSn: scope.order, packageNumber: scope.package });
      const number = tracking?.payload?.response?.tracking_number;
      if (!clean(tracking) || typeof number !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(number)) return fail('tracking_number_required');
      if (scope.tracking && number !== scope.tracking) return fail('tracking_number_required');
      const body = { order_list: [{ order_sn: scope.order, package_number: scope.package,
        tracking_number: number, shipping_document_type: TYPE }] };
      const hash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
      const metadata = { channel_account_id: scope.account, shop_id: scope.shop,
        order_sn: scope.order, package_number: scope.package, document_type: TYPE, request_hash: hash };
      if (budget - now() <= 10000) return fail('label_window_inactive');
      // An existing Shopee task must not be recreated. Only the documented
      // print-first error authorizes a fresh task claim; all other errors close.
      const before = await readResult({ ...shared, shippingDocumentResultPath: '/api/v2/logistics/get_shipping_document_result',
        orderSn: scope.order, packageNumber: scope.package, shippingDocumentType: TYPE });
      const existing = entry(before, scope);
      const synchronize = async () => {
        if (!enabled('SHOPEE_LIVE_LABEL_SYNC_ENABLED') || now() >= deadline) return fail('label_sync_not_enabled');
        const sync = syncLabel ?? createShopeeLabelSynchronizer({ getEnv, now, readConnection, decryptToken });
        const result = await sync();
        return result?.ok === true && ['label_attached','already_available'].includes(result.code)
          ? { ok: true, code: result.code, document_id: result.document_id ?? null, document_type: 'shipping_label' }
          : fail('ready_label_sync_failed');
      };
      if (existing?.status === 'READY') return await synchronize();
      if (existing?.status === 'PROCESSING') return fail('document_processing');
      if (existing) return fail(existing.status === 'FAILED' ? 'document_failed' : 'document_status_unknown');
      const missingCode = 'logistics.shipping_document_should_print_first';
      const errorRows = before?.payload?.response?.result_list;
      if (errorRows !== undefined && (!Array.isArray(errorRows) || errorRows.length !== 1
          || errorRows[0]?.order_sn !== scope.order || errorRows[0]?.package_number !== scope.package)) {
        return fail('document_status_rejected');
      }
      const rowMissing = ['', 'common.batch_api_all_failed'].includes(before?.payload?.error)
        && errorRows?.length === 1 && errorRows[0]?.order_sn === scope.order
        && errorRows[0]?.package_number === scope.package && errorRows[0]?.fail_error === missingCode;
      if (before?.response?.ok !== true || (before.payload?.error !== missingCode && !rowMissing)) {
        return fail('document_status_rejected');
      }
      const reserved = await claim(metadata);
      if (reserved?.ok !== true) return fail('document_claim_unavailable');
      const claimData = reserved.payload;
      const fresh = claimData?.status === 'claimed' && claimData.fresh === true;
      const accepted = claimData?.status === 'already_succeeded' && claimData.fresh === false;
      if ((!fresh && !accepted) || !/^[0-9a-f-]{36}$/i.test(claimData?.attempt_id ?? '')) return fail('document_claim_locked');
      if (fresh) {
        let outcome = 'uncertain';
        try {
          if (!enabled('SHOPEE_LIVE_LABEL_CREATE_ENABLED') || now() >= budget) throw new Error('window_expired');
          const ack = entry(await createDocument({ ...shared, orderSn: scope.order,
            packageNumber: scope.package, trackingNumber: number, shippingDocumentType: TYPE }), scope, true);
          if (ack) outcome = 'succeeded';
        } catch { /* No retry, including transport errors and lost confirmation. */ }
        let stored;
        try { stored = await resolve({ attempt_id: claimData.attempt_id, request_hash: hash, outcome }); } catch { stored = null; }
        if (!stored?.ok || !['resolved','already_resolved'].includes(stored.payload?.status)
            || stored.payload?.state !== outcome) return fail('document_core_confirmation_missing');
        if (outcome !== 'succeeded') return fail('document_creation_uncertain');
      }
      // Existing acknowledged claim may resume reads/sync only, never POST again.
      for (let attempt = 0; attempt < 4; attempt += 1) {
        if (!enabled('SHOPEE_LIVE_LABEL_CREATE_ENABLED') || budget - now() <= 5000) return fail('document_processing');
        if (attempt) await sleep(2000);
        if (budget - now() <= 5000) return fail('document_processing');
        const row = entry(await readResult({ ...shared, shippingDocumentResultPath: '/api/v2/logistics/get_shipping_document_result',
          orderSn: scope.order, packageNumber: scope.package, shippingDocumentType: TYPE }), scope);
        if (!row) return fail('document_status_rejected');
        if (row.status === 'FAILED') return fail('document_failed');
        if (row.status === 'READY') {
          // Existing synchronizer revalidates official identity, READY, PDF and
          // immutable Storage metadata. It has no stock/separation side effects.
          return await synchronize();
        }
        if (row.status !== 'PROCESSING') return fail('document_status_unknown');
      }
      return fail('document_processing');
    } catch { return fail('label_preparation_unavailable'); }
  };
}

export const prepareShopeeLabelOnce = createShopeeLabelPreparation();
