const encoder = new TextEncoder();

async function hmacHex(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function requiredPositiveInteger(value, field) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new TypeError(`${field} must be a positive safe integer`);
  }
  return parsed;
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function parseJsonPayload(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { error: 'invalid_json', message: String(text).slice(0, 300) };
  }
}

export async function signPublicRequest({
  partnerId,
  partnerKey,
  path,
  timestamp = Math.floor(Date.now() / 1000),
}) {
  const normalizedPartnerId = requiredPositiveInteger(partnerId, 'partnerId');
  const normalizedPath = requiredText(path, 'path');
  const normalizedPartnerKey = requiredText(partnerKey, 'partnerKey');
  const normalizedTimestamp = requiredPositiveInteger(timestamp, 'timestamp');

  return {
    timestamp: normalizedTimestamp,
    sign: await hmacHex(
      `${normalizedPartnerId}${normalizedPath}${normalizedTimestamp}`,
      normalizedPartnerKey,
    ),
  };
}

export async function signShopRequest({
  partnerId,
  partnerKey,
  path,
  accessToken,
  shopId,
  timestamp = Math.floor(Date.now() / 1000),
}) {
  const normalizedPartnerId = requiredPositiveInteger(partnerId, 'partnerId');
  const normalizedPath = requiredText(path, 'path');
  const normalizedPartnerKey = requiredText(partnerKey, 'partnerKey');
  const normalizedAccessToken = requiredText(accessToken, 'accessToken');
  const normalizedShopId = requiredPositiveInteger(shopId, 'shopId');
  const normalizedTimestamp = requiredPositiveInteger(timestamp, 'timestamp');

  return {
    timestamp: normalizedTimestamp,
    sign: await hmacHex(
      `${normalizedPartnerId}${normalizedPath}${normalizedTimestamp}${normalizedAccessToken}${normalizedShopId}`,
      normalizedPartnerKey,
    ),
  };
}

export function buildAuthorizeUrl({
  authorizeUrl,
  partnerId,
  redirectUri,
  state,
  authType = 'seller',
  responseType = 'code',
}) {
  const url = new URL(requiredText(authorizeUrl, 'authorizeUrl'));
  url.searchParams.set('partner_id', String(requiredPositiveInteger(partnerId, 'partnerId')));
  url.searchParams.set('auth_type', requiredText(authType, 'authType'));
  url.searchParams.set('redirect_uri', requiredText(redirectUri, 'redirectUri'));
  url.searchParams.set('response_type', requiredText(responseType, 'responseType'));
  url.searchParams.set('state', requiredText(state, 'state'));
  return url;
}

async function signedPublicPost({
  apiBaseUrl,
  path,
  partnerId,
  partnerKey,
  body,
  fetchImpl = globalThis.fetch,
  timestamp,
}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const signature = await signPublicRequest({ partnerId, partnerKey, path, timestamp });
  const url = new URL(requiredText(path, 'path'), requiredText(apiBaseUrl, 'apiBaseUrl'));
  url.searchParams.set('partner_id', String(requiredPositiveInteger(partnerId, 'partnerId')));
  url.searchParams.set('timestamp', String(signature.timestamp));
  url.searchParams.set('sign', signature.sign);

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const rawText = await response.text();
  return { response, payload: parseJsonPayload(rawText), rawText };
}

export function exchangeToken({
  apiBaseUrl,
  tokenPath,
  partnerId,
  partnerKey,
  code,
  shopId = null,
  mainAccountId = null,
  fetchImpl = globalThis.fetch,
  timestamp,
}) {
  const body = {
    code: requiredText(code, 'code'),
    partner_id: requiredPositiveInteger(partnerId, 'partnerId'),
  };
  if (shopId !== null && shopId !== undefined) {
    body.shop_id = requiredPositiveInteger(shopId, 'shopId');
  } else {
    body.main_account_id = requiredPositiveInteger(mainAccountId, 'mainAccountId');
  }

  return signedPublicPost({
    apiBaseUrl,
    path: tokenPath,
    partnerId,
    partnerKey,
    body,
    fetchImpl,
    timestamp,
  });
}

export function refreshToken({
  apiBaseUrl,
  refreshPath,
  partnerId,
  partnerKey,
  refreshToken: token,
  shopId,
  fetchImpl = globalThis.fetch,
  timestamp,
}) {
  const normalizedPartnerId = requiredPositiveInteger(partnerId, 'partnerId');
  return signedPublicPost({
    apiBaseUrl,
    path: refreshPath,
    partnerId: normalizedPartnerId,
    partnerKey,
    body: {
      partner_id: normalizedPartnerId,
      refresh_token: requiredText(token, 'refreshToken'),
      shop_id: requiredPositiveInteger(shopId, 'shopId'),
    },
    fetchImpl,
    timestamp,
  });
}

export async function getShopInfo({
  apiBaseUrl,
  shopInfoPath,
  partnerId,
  partnerKey,
  accessToken,
  shopId,
  fetchImpl = globalThis.fetch,
  timestamp,
}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const normalizedPartnerId = requiredPositiveInteger(partnerId, 'partnerId');
  const normalizedShopId = requiredPositiveInteger(shopId, 'shopId');
  const signature = await signShopRequest({
    partnerId: normalizedPartnerId,
    partnerKey,
    path: shopInfoPath,
    accessToken,
    shopId: normalizedShopId,
    timestamp,
  });

  const url = new URL(requiredText(shopInfoPath, 'shopInfoPath'), requiredText(apiBaseUrl, 'apiBaseUrl'));
  url.searchParams.set('partner_id', String(normalizedPartnerId));
  url.searchParams.set('timestamp', String(signature.timestamp));
  url.searchParams.set('access_token', requiredText(accessToken, 'accessToken'));
  url.searchParams.set('shop_id', String(normalizedShopId));
  url.searchParams.set('sign', signature.sign);

  const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  const rawText = await response.text();
  return { response, payload: parseJsonPayload(rawText), rawText };
}


async function signedShopGet({
  apiBaseUrl,
  path,
  partnerId,
  partnerKey,
  accessToken,
  shopId,
  query = {},
  fetchImpl = globalThis.fetch,
  timestamp,
}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const normalizedPartnerId = requiredPositiveInteger(partnerId, 'partnerId');
  const normalizedShopId = requiredPositiveInteger(shopId, 'shopId');
  const normalizedPath = requiredText(path, 'path');
  const normalizedAccessToken = requiredText(accessToken, 'accessToken');
  const signature = await signShopRequest({
    partnerId: normalizedPartnerId,
    partnerKey,
    path: normalizedPath,
    accessToken: normalizedAccessToken,
    shopId: normalizedShopId,
    timestamp,
  });

  const url = new URL(normalizedPath, requiredText(apiBaseUrl, 'apiBaseUrl'));
  url.searchParams.set('partner_id', String(normalizedPartnerId));
  url.searchParams.set('timestamp', String(signature.timestamp));
  url.searchParams.set('access_token', normalizedAccessToken);
  url.searchParams.set('shop_id', String(normalizedShopId));
  url.searchParams.set('sign', signature.sign);

  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  const rawText = await response.text();
  return { response, payload: parseJsonPayload(rawText), rawText };
}


async function signedShopPost({
  apiBaseUrl,
  path,
  partnerId,
  partnerKey,
  accessToken,
  shopId,
  body = {},
  fetchImpl = globalThis.fetch,
  timestamp,
  responseMode = 'json',
}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const normalizedPartnerId = requiredPositiveInteger(partnerId, 'partnerId');
  const normalizedShopId = requiredPositiveInteger(shopId, 'shopId');
  const normalizedPath = requiredText(path, 'path');
  const normalizedAccessToken = requiredText(accessToken, 'accessToken');
  const signature = await signShopRequest({
    partnerId: normalizedPartnerId,
    partnerKey,
    path: normalizedPath,
    accessToken: normalizedAccessToken,
    shopId: normalizedShopId,
    timestamp,
  });

  const url = new URL(normalizedPath, requiredText(apiBaseUrl, 'apiBaseUrl'));
  url.searchParams.set('partner_id', String(normalizedPartnerId));
  url.searchParams.set('timestamp', String(signature.timestamp));
  url.searchParams.set('access_token', normalizedAccessToken);
  url.searchParams.set('shop_id', String(normalizedShopId));
  url.searchParams.set('sign', signature.sign);

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  });
  if (responseMode === 'raw') return { response };
  const rawText = await response.text();
  return { response, payload: parseJsonPayload(rawText), rawText };
}

export function getShippingParameter({
  apiBaseUrl,
  shippingParameterPath,
  partnerId,
  partnerKey,
  accessToken,
  shopId,
  orderSn,
  packageNumber = null,
  fetchImpl = globalThis.fetch,
  timestamp,
}) {
  const query = {
    order_sn: requiredText(orderSn, 'orderSn'),
  };
  if (packageNumber !== null && packageNumber !== undefined && String(packageNumber).trim() !== '') {
    query.package_number = String(packageNumber).trim();
  }

  return signedShopGet({
    apiBaseUrl,
    path: shippingParameterPath,
    partnerId,
    partnerKey,
    accessToken,
    shopId,
    query,
    fetchImpl,
    timestamp,
  });
}
export function getShippingDocumentParameter({
  apiBaseUrl,
  shippingDocumentParameterPath,
  partnerId,
  partnerKey,
  accessToken,
  shopId,
  orderList,
  fetchImpl = globalThis.fetch,
  timestamp,
}) {
  if (!Array.isArray(orderList) || orderList.length === 0 || orderList.length > 50) {
    throw new TypeError('orderList must contain between 1 and 50 entries');
  }

  const normalizedOrderList = orderList.map((entry, index) => {
    const normalized = {
      order_sn: requiredText(entry?.order_sn, `orderList[${index}].order_sn`),
    };
    if (entry?.package_number !== null && entry?.package_number !== undefined
      && String(entry.package_number).trim() !== '') {
      normalized.package_number = String(entry.package_number).trim();
    }
    return normalized;
  });

  return signedShopPost({
    apiBaseUrl,
    path: shippingDocumentParameterPath,
    partnerId,
    partnerKey,
    accessToken,
    shopId,
    body: { order_list: normalizedOrderList },
    fetchImpl,
    timestamp,
  });
}

export function getOrderList({
  apiBaseUrl,
  orderListPath,
  partnerId,
  partnerKey,
  accessToken,
  shopId,
  timeRangeField = 'create_time',
  timeFrom,
  timeTo,
  pageSize,
  cursor = null,
  orderStatus = null,
  fetchImpl = globalThis.fetch,
  timestamp,
}) {
  const normalizedTimeRangeField = requiredText(timeRangeField, 'timeRangeField');
  if (!['create_time', 'update_time'].includes(normalizedTimeRangeField)) {
    throw new TypeError('timeRangeField must be create_time or update_time');
  }
  const normalizedTimeFrom = requiredPositiveInteger(timeFrom, 'timeFrom');
  const normalizedTimeTo = requiredPositiveInteger(timeTo, 'timeTo');
  if (normalizedTimeTo < normalizedTimeFrom) throw new TypeError('timeTo must be greater than or equal to timeFrom');

  const query = {
    time_range_field: normalizedTimeRangeField,
    time_from: normalizedTimeFrom,
    time_to: normalizedTimeTo,
    page_size: requiredPositiveInteger(pageSize, 'pageSize'),
  };
  if (cursor !== null && cursor !== undefined && String(cursor).trim() !== '') {
    query.cursor = String(cursor).trim();
  }
  if (orderStatus !== null && orderStatus !== undefined && String(orderStatus).trim() !== '') {
    query.order_status = String(orderStatus).trim();
  }

  return signedShopGet({
    apiBaseUrl,
    path: orderListPath,
    partnerId,
    partnerKey,
    accessToken,
    shopId,
    query,
    fetchImpl,
    timestamp,
  });
}

export function getOrderDetail({
  apiBaseUrl,
  orderDetailPath,
  partnerId,
  partnerKey,
  accessToken,
  shopId,
  orderSnList,
  responseOptionalFields = [],
  fetchImpl = globalThis.fetch,
  timestamp,
}) {
  if (!Array.isArray(orderSnList) || orderSnList.length === 0) {
    throw new TypeError('orderSnList must be a non-empty array');
  }
  const normalizedOrderSnList = orderSnList.map((value, index) => requiredText(value, `orderSnList[${index}]`));
  const optionalFields = Array.isArray(responseOptionalFields)
    ? responseOptionalFields.map((value, index) => requiredText(value, `responseOptionalFields[${index}]`)).join(',')
    : requiredText(responseOptionalFields, 'responseOptionalFields');

  return signedShopGet({
    apiBaseUrl,
    path: orderDetailPath,
    partnerId,
    partnerKey,
    accessToken,
    shopId,
    query: {
      order_sn_list: normalizedOrderSnList.join(','),
      response_optional_fields: optionalFields,
    },
    fetchImpl,
    timestamp,
  });
}

export function parseShopeeError(payload) {
  const error = payload && typeof payload.error === 'string' ? payload.error : '';
  return error.trim();
}


const SHIPPING_DOCUMENT_TYPES = new Set(['NORMAL_AIR_WAYBILL', 'THERMAL_AIR_WAYBILL']);

function normalizeSingleShippingDocumentOrder(orderSn, packageNumber) {
  const entry = { order_sn: requiredText(orderSn, 'orderSn') };
  if (packageNumber !== null && packageNumber !== undefined && String(packageNumber).trim() !== '') {
    entry.package_number = String(packageNumber).trim();
  }
  return [entry];
}

export function getShippingDocumentResult({
  apiBaseUrl,
  shippingDocumentResultPath,
  partnerId,
  partnerKey,
  accessToken,
  shopId,
  orderSn,
  packageNumber = null,
  shippingDocumentType = 'NORMAL_AIR_WAYBILL',
  fetchImpl = globalThis.fetch,
  timestamp,
}) {
  if (!SHIPPING_DOCUMENT_TYPES.has(shippingDocumentType)) {
    throw new TypeError('unsupported shipping document type');
  }
  const orderList = normalizeSingleShippingDocumentOrder(orderSn, packageNumber);
  orderList[0].shipping_document_type = shippingDocumentType;
  return signedShopPost({
    apiBaseUrl,
    path: shippingDocumentResultPath,
    partnerId,
    partnerKey,
    accessToken,
    shopId,
    body: { order_list: orderList },
    fetchImpl,
    timestamp,
  });
}

export function downloadShippingDocument({
  apiBaseUrl,
  downloadShippingDocumentPath,
  partnerId,
  partnerKey,
  accessToken,
  shopId,
  orderSn,
  packageNumber = null,
  shippingDocumentType = 'NORMAL_AIR_WAYBILL',
  fetchImpl = globalThis.fetch,
  timestamp,
}) {
  if (shippingDocumentType !== 'NORMAL_AIR_WAYBILL') {
    throw new TypeError('F6-O.2b pilot only accepts NORMAL_AIR_WAYBILL PDF');
  }
  return signedShopPost({
    apiBaseUrl,
    path: downloadShippingDocumentPath,
    partnerId,
    partnerKey,
    accessToken,
    shopId,
    body: {
      order_list: normalizeSingleShippingDocumentOrder(orderSn, packageNumber),
      shipping_document_type: shippingDocumentType,
    },
    fetchImpl,
    timestamp,
    responseMode: 'raw',
  });
}


/**
 * F6-O.2e.2b — Signed transport primitive ONLY, NOT a runnable workflow.
 * Restricted to the documented BR case info_needed={dropoff: []}.
 * A future caller MUST establish fresh order+package+fiscal eligibility,
 * an atomic durable idempotency claim and explicit feature gate BEFORE
 * invoking this mutating Shopee API. No route invokes it in this phase.
 */
export function buildSimpleDropoffRequest({ orderSn, packageNumber, infoNeeded, ...additional }) {
  if (Reflect.ownKeys(additional).length !== 0) throw new TypeError('unsupported_shipping_parameters');
  const order = requiredText(orderSn, 'orderSn');
  const pkg = requiredText(packageNumber, 'packageNumber');
  if (!/^[A-Za-z0-9]{8,100}$/.test(order) || !/^[A-Za-z0-9_-]{1,100}$/.test(pkg)) {
    throw new TypeError('invalid_shipping_identity');
  }
  if (infoNeeded === null || typeof infoNeeded !== 'object' || Array.isArray(infoNeeded)
      || Object.keys(infoNeeded).length !== 1 || !Object.hasOwn(infoNeeded, 'dropoff')
      || !Array.isArray(infoNeeded.dropoff) || infoNeeded.dropoff.length !== 0) {
    throw new TypeError('simple_dropoff_requires_empty_dropoff_only');
  }
  return { order_sn: order, package_number: pkg, dropoff: {} };
}

export function shipOrderSimpleDropoff({
  apiBaseUrl,
  shipOrderPath,
  partnerId,
  partnerKey,
  accessToken,
  shopId,
  orderSn,
  packageNumber,
  infoNeeded,
  fetchImpl = globalThis.fetch,
  timestamp,
  ...additional
}) {
  if (Reflect.ownKeys(additional).length !== 0) throw new TypeError('unsupported_shipping_parameters');
  const body = buildSimpleDropoffRequest({ orderSn, packageNumber, infoNeeded });
  return signedShopPost({
    apiBaseUrl,
    path: shipOrderPath,
    partnerId,
    partnerKey,
    accessToken,
    shopId,
    body,
    fetchImpl,
    timestamp,
  });
}

/**
 * Signed read-only tracking query; may have no tracking number immediately
 * after arrangement. Callers must not treat an empty result as success.
 */
export function createShippingDocument({
  apiBaseUrl, partnerId, partnerKey, accessToken, shopId,
  orderSn, packageNumber, trackingNumber,
  shippingDocumentType = 'NORMAL_AIR_WAYBILL',
  fetchImpl = globalThis.fetch, timestamp, ...additional
}) {
  if (Reflect.ownKeys(additional).length) throw new TypeError('unsupported_document_parameters');
  const order = requiredText(orderSn, 'orderSn');
  const pkg = requiredText(packageNumber, 'packageNumber');
  const tracking = requiredText(trackingNumber, 'trackingNumber');
  // This controlled BR pilot requires tracking even for channels that permit
  // printing before arrangement. Those exceptions need a separate contract.
  if (!/^[A-Za-z0-9]{8,100}$/.test(order) || !/^[A-Za-z0-9_-]{1,100}$/.test(pkg)
      || !/^[A-Za-z0-9_-]{1,100}$/.test(tracking)
      || shippingDocumentType !== 'NORMAL_AIR_WAYBILL') {
    throw new TypeError('invalid_document_identity');
  }
  return signedShopPost({
    apiBaseUrl, path: '/api/v2/logistics/create_shipping_document',
    partnerId, partnerKey, accessToken, shopId, timestamp, fetchImpl,
    body: { order_list: [{ order_sn: order, package_number: pkg,
      tracking_number: tracking, shipping_document_type: shippingDocumentType }] },
  });
}

export function getTrackingNumber({
  apiBaseUrl,
  getTrackingNumberPath,
  partnerId,
  partnerKey,
  accessToken,
  shopId,
  orderSn,
  packageNumber,
  fetchImpl = globalThis.fetch,
  timestamp,
  ...additional
}) {
  if (Reflect.ownKeys(additional).length !== 0) throw new TypeError('unsupported_tracking_parameters');
  const order = requiredText(orderSn, 'orderSn');
  const pkg = requiredText(packageNumber, 'packageNumber');
  if (!/^[A-Za-z0-9]{8,100}$/.test(order) || !/^[A-Za-z0-9_-]{1,100}$/.test(pkg)) {
    throw new TypeError('invalid_tracking_identity');
  }
  return signedShopGet({
    apiBaseUrl,
    path: getTrackingNumberPath,
    partnerId,
    partnerKey,
    accessToken,
    shopId,
    query: { order_sn: order, package_number: pkg },
    fetchImpl,
    timestamp,
  });
}
