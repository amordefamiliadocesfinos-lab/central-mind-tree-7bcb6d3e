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

export function parseShopeeError(payload) {
  const error = payload && typeof payload.error === 'string' ? payload.error : '';
  return error.trim();
}
