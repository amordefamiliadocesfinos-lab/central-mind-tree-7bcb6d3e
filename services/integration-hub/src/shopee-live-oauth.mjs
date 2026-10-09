import {
  consumeLiveShopeeOauthState,
  createLiveShopeeOauthState,
  sha256Hex,
  upsertLiveShopeeOauthConnection,
  upsertLiveShopeeShopSnapshot,
} from './core-bridge.mjs';
import {
  exchangeToken,
  getShopInfo,
  parseShopeeError,
  refreshToken,
  signPublicRequest,
} from './connectors/shopee-protocol.mjs';

const API_BASE_URL = 'https://partner.shopeemobile.com';
const AUTH_PATH = '/api/v2/shop/auth_partner';
const TOKEN_PATH = '/api/v2/auth/token/get';
const REFRESH_PATH = '/api/v2/auth/access_token/get';
const SHOP_INFO_PATH = '/api/v2/shop/get_shop_info';
const STATE_TTL_MS = 10 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ACCESS_TOKEN_FALLBACK_TTL_MS = 4 * 60 * 60 * 1000;
const STATE_COOKIE = '__Host-pc_shopee_live_state';

const HTML_HEADERS = Object.freeze({
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
  'Content-Type': 'text/html; charset=utf-8',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
});

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function html(status, title, message, extraHeaders = {}) {
  return {
    status,
    headers: { ...HTML_HEADERS, ...extraHeaders },
    body: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></main></body></html>`,
  };
}

function redirect(location, state) {
  return {
    status: 302,
    headers: {
      'Cache-Control': 'no-store',
      'Location': location,
      'Referrer-Policy': 'no-referrer',
      'Set-Cookie': `${STATE_COOKIE}=${encodeURIComponent(state)}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
      'X-Content-Type-Options': 'nosniff',
    },
    body: '',
  };
}

function clearStateCookie() {
  return `${STATE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function readCookie(headers, name) {
  const header = headers?.cookie ?? headers?.Cookie ?? '';
  if (typeof header !== 'string' || header.length === 0) return null;
  for (const segment of header.split(';')) {
    const [rawName, ...rest] = segment.trim().split('=');
    if (rawName !== name) continue;
    try { return decodeURIComponent(rest.join('=')); } catch { return null; }
  }
  return null;
}

function requiredEnv(getEnv, name) {
  const value = getEnv(name);
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function positiveIntegerEnv(getEnv, name) {
  const value = Number(requiredEnv(getEnv, name));
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Invalid ${name}`);
  return value;
}

function bytesToBase64Url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

function randomState() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function encryptionKey(secret) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt']);
}

async function encryptToken(token, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(secret);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(token),
  ));
  return `${bytesToBase64Url(iv)}.${bytesToBase64Url(ciphertext)}`;
}

function accessTokenExpiry(expireIn, nowMs) {
  const seconds = Number(expireIn);
  if (Number.isFinite(seconds) && seconds > 0 && seconds <= 7 * 24 * 60 * 60) {
    return new Date(nowMs + seconds * 1000).toISOString();
  }
  return new Date(nowMs + ACCESS_TOKEN_FALLBACK_TTL_MS).toISOString();
}

function epochSecondsToIso(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString()
    : null;
}

function normalizedQuery(request, name) {
  const value = request?.query?.[name];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

async function buildLiveAuthorizeUrl({ partnerId, partnerKey, redirectUri, sign = signPublicRequest }) {
  const signature = await sign({
    partnerId,
    partnerKey,
    path: AUTH_PATH,
  });
  const url = new URL(AUTH_PATH, API_BASE_URL);
  url.searchParams.set('partner_id', String(partnerId));
  url.searchParams.set('redirect', redirectUri);
  url.searchParams.set('timestamp', String(signature.timestamp));
  url.searchParams.set('sign', signature.sign);
  return url.toString();
}

export function createShopeeLiveOauthHandler({
  getEnv = (name) => process.env[name],
  now = Date.now,
  createState = createLiveShopeeOauthState,
  consumeState = consumeLiveShopeeOauthState,
  persistConnection = upsertLiveShopeeOauthConnection,
  persistSnapshot = upsertLiveShopeeShopSnapshot,
  exchange = exchangeToken,
  refresh = refreshToken,
  readShop = getShopInfo,
  sign = signPublicRequest,
  makeState = randomState,
  encrypt = encryptToken,
  logger = (entry) => console.info(JSON.stringify(entry)),
} = {}) {
  return async function handleShopeeLiveOauthRequest(request) {
    const path = String(request?.path ?? '/');
    const method = String(request?.method ?? 'GET').toUpperCase();
    if (path !== '/shopee/live/oauth/start' && path !== '/shopee/live/oauth/callback') return null;
    if (method !== 'GET') return html(405, 'Método não permitido', 'Esta rota aceita somente GET.');

    try {
      const partnerId = positiveIntegerEnv(getEnv, 'SHOPEE_LIVE_PARTNER_ID');
      const partnerKey = requiredEnv(getEnv, 'SHOPEE_LIVE_PARTNER_KEY');
      const redirectUri = requiredEnv(getEnv, 'SHOPEE_LIVE_REDIRECT_URI');
      const channelAccountId = requiredEnv(getEnv, 'SHOPEE_LIVE_CHANNEL_ACCOUNT_ID');
      const tokenEncryptionSecret = requiredEnv(getEnv, 'SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY');

      if (path === '/shopee/live/oauth/start') {
        const state = makeState();
        const stateHash = sha256Hex(state);
        const expiresAt = new Date(now() + STATE_TTL_MS).toISOString();
        const persisted = await createState({
          channel_account_id: channelAccountId,
          state_hash: stateHash,
          expires_at: expiresAt,
        });
        if (!persisted?.ok) {
          return html(503, 'Shopee Live indisponível', 'Não foi possível iniciar a autorização com segurança.');
        }

        const authorizationUrl = await buildLiveAuthorizeUrl({
          partnerId,
          partnerKey,
          redirectUri,
          sign,
        });
        return redirect(authorizationUrl, state);
      }

      const code = normalizedQuery(request, 'code');
      const shopIdRaw = normalizedQuery(request, 'shop_id');
      const mainAccountIdRaw = normalizedQuery(request, 'main_account_id');
      const shopId = shopIdRaw === null ? null : Number(shopIdRaw);
      const mainAccountId = mainAccountIdRaw === null ? null : Number(mainAccountIdRaw);
      const state = readCookie(request?.headers, STATE_COOKIE);
      const cleared = { 'Set-Cookie': clearStateCookie() };

      if (!code || (!shopId && !mainAccountId) || !state) {
        return html(400, 'Autorização Shopee incompleta', 'O retorno OAuth não trouxe os dados necessários para validação.', cleared);
      }
      if (shopId !== null && (!Number.isSafeInteger(shopId) || shopId <= 0)) {
        return html(400, 'Autorização Shopee inválida', 'O shop_id retornado é inválido.', cleared);
      }
      if (mainAccountId !== null && (!Number.isSafeInteger(mainAccountId) || mainAccountId <= 0)) {
        return html(400, 'Autorização Shopee inválida', 'O main_account_id retornado é inválido.', cleared);
      }

      const consumed = await consumeState({ state_hash: sha256Hex(state) });
      if (!consumed?.ok) {
        const status = consumed?.status === 409 ? 409 : 503;
        return html(
          status,
          status === 409 ? 'Autorização Shopee expirada' : 'Shopee Live indisponível',
          status === 409
            ? 'O estado OAuth expirou ou já foi utilizado. Inicie novamente pelo Painel Central.'
            : 'Não foi possível validar o estado OAuth no Core.',
          cleared,
        );
      }

      const canonicalAccountId = consumed.payload?.channel_account_id;
      if (canonicalAccountId !== channelAccountId) {
        return html(409, 'Autorização Shopee rejeitada', 'A autorização não corresponde à conta piloto configurada.', cleared);
      }

      const tokenResult = await exchange({
        apiBaseUrl: API_BASE_URL,
        tokenPath: TOKEN_PATH,
        partnerId,
        partnerKey,
        code,
        shopId,
        mainAccountId,
      });
      if (!tokenResult.response.ok || parseShopeeError(tokenResult.payload)) {
        logger({
          event: 'shopee_live_token_exchange_rejected',
          status: tokenResult.response.status,
          error: typeof tokenResult.payload?.error === 'string' ? tokenResult.payload.error : null,
          request_id: tokenResult.payload?.request_id ? String(tokenResult.payload.request_id) : null,
        });
        return html(502, 'Falha ao obter token Shopee', 'A Shopee recusou a troca do código de autorização. Nenhum efeito operacional foi aplicado.', cleared);
      }

      const accessToken = String(tokenResult.payload?.access_token ?? '');
      const refreshTokenValue = String(tokenResult.payload?.refresh_token ?? '');
      const tokenShopIds = Array.isArray(tokenResult.payload?.shop_id_list)
        ? tokenResult.payload.shop_id_list.map(Number).filter(Number.isSafeInteger)
        : [];
      const effectiveShopId = shopId ?? tokenShopIds[0] ?? null;
      if (!accessToken || !refreshTokenValue || !effectiveShopId) {
        return html(502, 'Resposta OAuth incompleta', 'A Shopee não retornou access_token, refresh_token e shop_id suficientes.', cleared);
      }

      const firstRead = await readShop({
        apiBaseUrl: API_BASE_URL,
        shopInfoPath: SHOP_INFO_PATH,
        partnerId,
        partnerKey,
        accessToken,
        shopId: effectiveShopId,
      });
      if (!firstRead.response.ok || parseShopeeError(firstRead.payload)) {
        return html(502, 'OAuth concluído, leitura falhou', 'Os tokens foram obtidos, mas get_shop_info não respondeu com sucesso.', cleared);
      }

      const firstObservedAt = new Date(now()).toISOString();
      const firstSnapshot = await persistSnapshot({
        channel_account_id: channelAccountId,
        external_entity_id: String(effectiveShopId),
        request_id: firstRead.payload?.request_id ? String(firstRead.payload.request_id) : null,
        observed_at: firstObservedAt,
        payload: firstRead.payload,
        payload_hash: sha256Hex(firstRead.rawText),
      });
      if (!firstSnapshot?.ok) {
        return html(503, 'Leitura concluída, auditoria falhou', 'A leitura foi bem-sucedida, mas o Raw Snapshot Live não pôde ser persistido.', cleared);
      }

      const firstNowMs = now();
      const firstNowIso = new Date(firstNowMs).toISOString();
      const initialConnection = await persistConnection({
        channel_account_id: channelAccountId,
        partner_id: partnerId,
        shop_id: effectiveShopId,
        main_account_id: mainAccountId,
        merchant_id: firstRead.payload?.merchant_id ? Number(firstRead.payload.merchant_id) : null,
        access_token_ciphertext: await encrypt(accessToken, tokenEncryptionSecret),
        refresh_token_ciphertext: await encrypt(refreshTokenValue, tokenEncryptionSecret),
        access_token_expires_at: accessTokenExpiry(tokenResult.payload?.expire_in, firstNowMs),
        refresh_token_expires_at: new Date(firstNowMs + REFRESH_TTL_MS).toISOString(),
        authorization_expires_at: epochSecondsToIso(firstRead.payload?.expire_time),
        shop_name: firstRead.payload?.shop_name ? String(firstRead.payload.shop_name) : null,
        region: firstRead.payload?.region ? String(firstRead.payload.region) : null,
        shop_status: firstRead.payload?.status ? String(firstRead.payload.status) : null,
        last_authenticated_at: firstNowIso,
        last_refreshed_at: null,
      });
      if (!initialConnection?.ok) {
        return html(503, 'Leitura concluída, persistência falhou', 'OAuth e get_shop_info funcionaram, mas a conexão Live não pôde ser persistida.', cleared);
      }

      const refreshResult = await refresh({
        apiBaseUrl: API_BASE_URL,
        refreshPath: REFRESH_PATH,
        partnerId,
        partnerKey,
        refreshToken: refreshTokenValue,
        shopId: effectiveShopId,
      });
      if (!refreshResult.response.ok || parseShopeeError(refreshResult.payload)) {
        return html(502, 'Leitura concluída, renovação falhou', 'OAuth e get_shop_info funcionaram, mas a renovação do token Live falhou.', cleared);
      }

      const refreshedAccessToken = String(refreshResult.payload?.access_token ?? '');
      const refreshedRefreshToken = String(refreshResult.payload?.refresh_token ?? '');
      if (!refreshedAccessToken || !refreshedRefreshToken) {
        return html(502, 'Renovação incompleta', 'A Shopee não retornou o novo par de tokens esperado.', cleared);
      }

      const refreshedRead = await readShop({
        apiBaseUrl: API_BASE_URL,
        shopInfoPath: SHOP_INFO_PATH,
        partnerId,
        partnerKey,
        accessToken: refreshedAccessToken,
        shopId: effectiveShopId,
      });
      if (!refreshedRead.response.ok || parseShopeeError(refreshedRead.payload)) {
        return html(502, 'Renovação concluída, releitura falhou', 'O token foi renovado, mas a releitura de get_shop_info falhou.', cleared);
      }

      const refreshedObservedAt = new Date(now()).toISOString();
      const refreshedSnapshot = await persistSnapshot({
        channel_account_id: channelAccountId,
        external_entity_id: String(effectiveShopId),
        request_id: refreshedRead.payload?.request_id ? String(refreshedRead.payload.request_id) : null,
        observed_at: refreshedObservedAt,
        payload: refreshedRead.payload,
        payload_hash: sha256Hex(refreshedRead.rawText),
      });
      if (!refreshedSnapshot?.ok) {
        return html(503, 'Releitura concluída, auditoria falhou', 'A segunda leitura foi bem-sucedida, mas o Raw Snapshot Live não pôde ser persistido.', cleared);
      }

      const refreshedNowMs = now();
      const refreshedNowIso = new Date(refreshedNowMs).toISOString();
      const finalConnection = await persistConnection({
        channel_account_id: channelAccountId,
        partner_id: partnerId,
        shop_id: effectiveShopId,
        main_account_id: mainAccountId,
        merchant_id: refreshedRead.payload?.merchant_id ? Number(refreshedRead.payload.merchant_id) : null,
        access_token_ciphertext: await encrypt(refreshedAccessToken, tokenEncryptionSecret),
        refresh_token_ciphertext: await encrypt(refreshedRefreshToken, tokenEncryptionSecret),
        access_token_expires_at: accessTokenExpiry(refreshResult.payload?.expire_in, refreshedNowMs),
        refresh_token_expires_at: new Date(refreshedNowMs + REFRESH_TTL_MS).toISOString(),
        authorization_expires_at: epochSecondsToIso(refreshedRead.payload?.expire_time),
        shop_name: refreshedRead.payload?.shop_name ? String(refreshedRead.payload.shop_name) : null,
        region: refreshedRead.payload?.region ? String(refreshedRead.payload.region) : null,
        shop_status: refreshedRead.payload?.status ? String(refreshedRead.payload.status) : null,
        last_authenticated_at: refreshedNowIso,
        last_refreshed_at: refreshedNowIso,
      });
      if (!finalConnection?.ok) {
        return html(503, 'Conexão validada, persistência falhou', 'A prova Live funcionou, mas os tokens renovados não puderam ser persistidos.', cleared);
      }

      return html(
        200,
        'Shopee Live conectado',
        `OAuth Live, get_shop_info, renovação de token e releitura concluídos para shop_id ${effectiveShopId}. Nenhuma projeção em Pedido, Estoque, Financeiro ou CRM foi executada.`,
        cleared,
      );
    } catch (error) {
      logger({
        event: 'shopee_live_oauth_unavailable',
        error: error instanceof Error ? error.message : 'unknown',
      });
      return html(503, 'Shopee Live indisponível', 'A configuração ou execução do OAuth Live está indisponível.');
    }
  };
}

export const handleShopeeLiveOauthRequest = createShopeeLiveOauthHandler();
