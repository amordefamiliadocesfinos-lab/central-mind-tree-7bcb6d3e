import { createHash } from 'node:crypto';
import {
  readLiveShopeeOauthConnection,
  callCoreBridgeAction,
} from './core-bridge.mjs';
import {
  getOrderDetail,
  getShippingDocumentParameter,
  getShippingDocumentResult,
  downloadShippingDocument,
  parseShopeeError,
} from './connectors/shopee-protocol.mjs';
import { decryptShopeeToken } from './shopee-token-crypto.mjs';

const API_BASE_URL = 'https://partner.shopeemobile.com';
const CORE_ORIGIN = 'https://xkskyutmtlhivvpfxkjg.supabase.co';
const ORDER_DETAIL_PATH = '/api/v2/order/get_order_detail';
const PARAMETER_PATH = '/api/v2/logistics/get_shipping_document_parameter';
const RESULT_PATH = '/api/v2/logistics/get_shipping_document_result';
const DOWNLOAD_PATH = '/api/v2/logistics/download_shipping_document';
const PDF_TYPE = 'NORMAL_AIR_WAYBILL';
const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;

const getEnvDefault = (name) => process.env[name];

function requiredEnv(getEnv, key) {
  const value = getEnv(key);
  if (typeof value !== 'string' || value.trim() === '') throw new Error('missing_' + key);
  return value.trim();
}

function validPositiveInteger(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new TypeError('invalid_numeric_identity');
  return number;
}

function uniquePackageNumber(order) {
  const packages = order?.package_list;
  if (packages === undefined || packages === null) return { ok: true, value: null };
  if (!Array.isArray(packages) || packages.length > 1) return { ok: false, code: 'multiple_packages_not_supported' };
  if (packages.length === 0) return { ok: true, value: null };
  const number = String(packages[0]?.package_number ?? '').trim();
  if (!number || !/^[a-zA-Z0-9_-]{1,100}$/.test(number)) return { ok: false, code: 'package_identity_missing' };
  return { ok: true, value: number };
}

function singleDocumentOrder(orderSn, packageNumber) {
  return [{ order_sn: orderSn, ...(packageNumber ? { package_number: packageNumber } : {}) }];
}

async function boundedPdf(response) {
  if (!response?.ok) return null;
  const type = response.headers?.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
  if (!['application/pdf', 'application/octet-stream', 'binary/octet-stream'].includes(type)) return null;
  const contentLength = response.headers?.get('content-length');
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_DOCUMENT_BYTES)) return null;
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_DOCUMENT_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const pdf = Buffer.concat(chunks, length);
  return pdf.length >= 16 && pdf.subarray(0, 5).toString('ascii') === '%PDF-' ? pdf : null;
}

export function createShopeeLabelSynchronizer({
  getEnv = getEnvDefault,
  now = Date.now,
  readConnection = readLiveShopeeOauthConnection,
  callCore = callCoreBridgeAction,
  decryptToken = decryptShopeeToken,
  readOrderDetail = getOrderDetail,
  readParameter = getShippingDocumentParameter,
  readDocumentResult = getShippingDocumentResult,
  downloadDocument = downloadShippingDocument,
  uploadFetch = globalThis.fetch, fetchImpl = globalThis.fetch,
} = {}) {
  return async function syncReadyShopeeLabel() {
    const orderSn = requiredEnv(getEnv, 'SHOPEE_LIVE_LABEL_ORDER_SN');
    const channelAccountId = requiredEnv(getEnv, 'SHOPEE_LIVE_CHANNEL_ACCOUNT_ID');
    const partnerId = validPositiveInteger(requiredEnv(getEnv, 'SHOPEE_LIVE_PARTNER_ID'));
    const partnerKey = requiredEnv(getEnv, 'SHOPEE_LIVE_PARTNER_KEY');
    const encryptionKey = requiredEnv(getEnv, 'SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY');
    if (!/^[A-Za-z0-9]{8,100}$/.test(orderSn)) return { ok: false, code: 'invalid_order_identity' };
    const connection = await readConnection({ channel_account_id: channelAccountId });
    if (!connection?.ok) return { ok: false, code: 'oauth_connection_unavailable' };
    const oauth = connection.payload ?? {};
    const shopId = validPositiveInteger(oauth.shop_id);
    const fixedShop = getEnv('SHOPEE_LIVE_LABEL_SHOP_ID');
    if (fixedShop != null && String(shopId) !== String(fixedShop)) return { ok: false, code: 'label_shop_identity_mismatch' };
    if (validPositiveInteger(oauth.partner_id) !== partnerId) return { ok: false, code: 'partner_id_mismatch' };
    const expiresAt = Date.parse(String(oauth.access_token_expires_at ?? ''));
    if (!Number.isFinite(expiresAt) || expiresAt <= now() + 60_000) {
      return { ok: false, code: 'access_token_expired_read_only' };
    }
    const accessToken = await decryptToken(oauth.access_token_ciphertext, encryptionKey);
    const shared = { fetchImpl, apiBaseUrl: API_BASE_URL, partnerId, partnerKey, accessToken, shopId };

    const detail = await readOrderDetail({
      ...shared, orderDetailPath: ORDER_DETAIL_PATH, orderSnList: [orderSn],
      responseOptionalFields: ['package_list', 'shipping_carrier', 'invoice_data'],
    });
    if (!detail.response.ok || parseShopeeError(detail.payload)) return { ok: false, code: 'order_detail_rejected' };
    const orderList = detail.payload?.response?.order_list;
    if (!Array.isArray(orderList) || orderList.length !== 1 || orderList[0]?.order_sn !== orderSn) {
      return { ok: false, code: 'order_identity_mismatch' };
    }
    const pkg = uniquePackageNumber(orderList[0]);
    if (!pkg.ok) return { ok: false, code: pkg.code };
    const packageNumber = pkg.value;
    const fixedPackage = getEnv('SHOPEE_LIVE_LABEL_PACKAGE_NUMBER');
    if (fixedPackage != null && packageNumber !== fixedPackage) return { ok: false, code: 'label_package_identity_mismatch' };

    const parameters = await readParameter({
      ...shared, shippingDocumentParameterPath: PARAMETER_PATH,
      orderList: singleDocumentOrder(orderSn, packageNumber),
    });
    if (!parameters.response.ok || parseShopeeError(parameters.payload)) {
      return { ok: false, code: 'document_parameter_unavailable' };
    }
    const entries = parameters.payload?.response?.result_list;
    if (!Array.isArray(entries) || entries.length !== 1
        || entries[0].order_sn !== orderSn
        || (packageNumber && entries[0].package_number !== packageNumber)
        || !Array.isArray(entries[0].selectable_shipping_document_type)
        || !entries[0].selectable_shipping_document_type.includes(PDF_TYPE)) {
      return { ok: false, code: 'pdf_document_type_unavailable' };
    }

    const task = await readDocumentResult({
      ...shared, shippingDocumentResultPath: RESULT_PATH,
      orderSn, packageNumber, shippingDocumentType: PDF_TYPE,
    });
    if (!task.response.ok || parseShopeeError(task.payload)) {
      return { ok: false, code: 'document_status_rejected' };
    }
    const results = task.payload?.response?.result_list;
    if (!Array.isArray(results) || results.length !== 1
        || results[0].order_sn !== orderSn
        || (packageNumber && results[0].package_number !== packageNumber)) {
      return { ok: false, code: 'document_status_identity_mismatch' };
    }
    const status = String(results[0].status ?? '');
    if (status !== 'READY') {
      return { ok: false, code: status === 'PROCESSING' ? 'document_processing'
        : status === 'FAILED' ? 'document_failed' : 'document_not_ready' };
    }

    const response = await downloadDocument({
      ...shared, downloadShippingDocumentPath: DOWNLOAD_PATH,
      orderSn, packageNumber, shippingDocumentType: PDF_TYPE,
    });
    const pdf = await boundedPdf(response.response);
    if (!pdf) return { ok: false, code: 'document_pdf_invalid_or_unavailable' };
    const metadata = {
      channel_account_id: channelAccountId,
      shop_id: shopId,
      order_sn: orderSn,
      package_number: packageNumber,
      sha256: createHash('sha256').update(pdf).digest('hex'),
      file_size: pdf.length,
    };
    const stage = await callCore({ action: 'shopee.shipping_label.prepare', data: metadata });
    if (!stage?.ok || stage.payload?.status !== 'ok') {
      return { ok: false, code: 'core_label_prepare_failed' };
    }
    if (stage.payload.already_exists === true) {
      return { ok: true, code: 'already_available', document_id: stage.payload.document_id };
    }

    // A URL assinada nunca aparece em logs, resposta pública ou documento.
    const signedUrl = String(stage.payload.upload_url ?? '');
    let uploadUrl;
    try { uploadUrl = new URL(signedUrl); } catch { return { ok: false, code: 'upload_url_invalid' }; }
    if (uploadUrl.origin !== CORE_ORIGIN
        || !uploadUrl.pathname.startsWith('/storage/v1/object/upload/sign/shopee-labels/')) {
      return { ok: false, code: 'upload_url_untrusted' };
    }
    const uploaded = await uploadFetch(uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'application/pdf' },
      body: pdf,
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    // A prior attempt may have uploaded the immutable object before metadata failed.
    // Never overwrite it: Core must re-read and verify identity, size and SHA-256
    // before recovering the attachment, even when Storage rejected this upload.
    const committed = await callCore({ action: 'shopee.shipping_label.commit', data: metadata });
    if (!committed?.ok || committed.payload?.status !== 'ok') {
      return { ok: false, code: uploaded.ok ? 'core_label_commit_failed' : 'private_storage_upload_failed' };
    }
    return {
      ok: true, code: committed.payload.already_exists ? 'already_available' : 'label_attached',
      document_id: committed.payload.document_id,
      document_type: 'shipping_label',
      mime_type: 'application/pdf',
    };
  };
}

export const syncReadyShopeeLabel = createShopeeLabelSynchronizer();
