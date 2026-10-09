import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  buildAuthorizeUrl,
  exchangeToken,
  getShopInfo,
  parseShopeeError,
  refreshToken,
} from '../_shared/shopee-protocol.mjs';

const ENVIRONMENT = 'sandbox';
const AUTHORIZE_URL = 'https://open.sandbox.test-stable.shopee.com/auth';
const API_BASE_URL = 'https://openplatform.sandbox.test-stable.shopee.sg';
const TOKEN_PATH = '/api/v2/auth/token/get';
const REFRESH_PATH = '/api/v2/auth/access_token/get';
const SHOP_INFO_PATH = '/api/v2/shop/get_shop_info';
const STATE_TTL_MS = 10 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ACCESS_TOKEN_DOC_TTL_MS = 4 * 60 * 60 * 1000;

const encoder = new TextEncoder();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function html(title: string, message: string, status = 200) {
  const escape = (value: string) => value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(title)}</title></head><body><main><h1>${escape(title)}</h1><p>${escape(message)}</p></main></body></html>`,
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
        'Content-Type': 'text/html; charset=utf-8',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function encryptionKey(secret: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt']);
}

async function encryptToken(token: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(secret);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(token),
  ));
  return `${bytesToBase64Url(iv)}.${bytesToBase64Url(ciphertext)}`;
}

function accessTokenExpiry(expireIn: unknown) {
  const value = Number(expireIn);
  if (Number.isFinite(value) && value > 0 && value <= 7 * 24 * 60 * 60) {
    return new Date(Date.now() + value * 1000).toISOString();
  }
  return new Date(Date.now() + ACCESS_TOKEN_DOC_TTL_MS).toISOString();
}

function epochSecondsToIso(value: unknown) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString()
    : null;
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  const route = url.pathname.split('/').filter(Boolean).at(-1) ?? '';

  try {
    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const partnerId = Number(requiredEnv('SHOPEE_TEST_PARTNER_ID'));
    const partnerKey = requiredEnv('SHOPEE_TEST_PARTNER_KEY');
    const redirectUri = requiredEnv('SHOPEE_TEST_REDIRECT_URI');
    const channelAccountId = requiredEnv('SHOPEE_TEST_CHANNEL_ACCOUNT_ID');
    const tokenEncryptionKey = requiredEnv('SHOPEE_TOKEN_ENCRYPTION_KEY');

    if (!Number.isSafeInteger(partnerId) || partnerId <= 0) {
      return json({ error: 'invalid_partner_id_configuration' }, 503);
    }

    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (request.method === 'GET' && route === 'authorize') {
      const state = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
      const stateHash = await sha256(state);
      const expiresAt = new Date(Date.now() + STATE_TTL_MS).toISOString();
      const { error } = await db.from('shopee_oauth_states').insert({
        state_hash: stateHash,
        channel_account_id: channelAccountId,
        environment: ENVIRONMENT,
        expires_at: expiresAt,
      });
      if (error) return json({ error: 'oauth_state_persistence_failed' }, 503);

      const authorizeUrl = buildAuthorizeUrl({
        authorizeUrl: AUTHORIZE_URL,
        partnerId,
        redirectUri,
        state,
      });
      return Response.redirect(authorizeUrl.toString(), 302);
    }

    if (request.method === 'GET' && route === 'callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const shopIdRaw = url.searchParams.get('shop_id');
      const mainAccountIdRaw = url.searchParams.get('main_account_id');
      const shopId = shopIdRaw ? Number(shopIdRaw) : null;
      const mainAccountId = mainAccountIdRaw ? Number(mainAccountIdRaw) : null;

      if (!code || !state || (!shopId && !mainAccountId)) {
        return html('Autorização Shopee incompleta', 'O callback não trouxe code, state e uma identidade de loja válidos.', 400);
      }
      if (shopId !== null && (!Number.isSafeInteger(shopId) || shopId <= 0)) {
        return html('Autorização Shopee inválida', 'O shop_id retornado é inválido.', 400);
      }
      if (mainAccountId !== null && (!Number.isSafeInteger(mainAccountId) || mainAccountId <= 0)) {
        return html('Autorização Shopee inválida', 'O main_account_id retornado é inválido.', 400);
      }

      const stateHash = await sha256(state);
      const { data: stateRecord, error: stateError } = await db
        .from('shopee_oauth_states')
        .select('id,channel_account_id,expires_at,used_at')
        .eq('state_hash', stateHash)
        .eq('environment', ENVIRONMENT)
        .maybeSingle();

      if (
        stateError ||
        !stateRecord ||
        stateRecord.used_at ||
        Date.parse(stateRecord.expires_at) <= Date.now() ||
        stateRecord.channel_account_id !== channelAccountId
      ) {
        return html('Autorização Shopee expirada', 'O estado OAuth é inválido, expirou ou já foi utilizado. Inicie novamente pelo Painel Central.', 400);
      }

      const { data: consumedState, error: consumeError } = await db
        .from('shopee_oauth_states')
        .update({ used_at: new Date().toISOString() })
        .eq('id', stateRecord.id)
        .is('used_at', null)
        .select('id')
        .maybeSingle();
      if (consumeError || !consumedState) {
        return html('Autorização Shopee já utilizada', 'Este retorno OAuth já foi processado.', 409);
      }

      const tokenResult = await exchangeToken({
        apiBaseUrl: API_BASE_URL,
        tokenPath: TOKEN_PATH,
        partnerId,
        partnerKey,
        code,
        shopId,
        mainAccountId,
      });
      if (!tokenResult.response.ok || parseShopeeError(tokenResult.payload)) {
        console.error('[Shopee Sandbox OAuth] Token exchange rejected:', JSON.stringify({
          status: tokenResult.response.status,
          error: typeof tokenResult.payload.error === 'string' ? tokenResult.payload.error : null,
          message: typeof tokenResult.payload.message === 'string' ? tokenResult.payload.message : null,
          request_id: tokenResult.payload.request_id ? String(tokenResult.payload.request_id) : null,
        }));
        return html('Falha ao obter token Shopee', 'A Shopee recusou a troca do código de autorização. Nenhum efeito operacional foi aplicado.', 502);
      }

      const accessToken = String(tokenResult.payload.access_token ?? '');
      const refreshToken = String(tokenResult.payload.refresh_token ?? '');
      const tokenShopIds = Array.isArray(tokenResult.payload.shop_id_list)
        ? tokenResult.payload.shop_id_list.map(Number).filter(Number.isSafeInteger)
        : [];
      const effectiveShopId = shopId ?? tokenShopIds[0] ?? null;
      if (!accessToken || !refreshToken || !effectiveShopId) {
        return html('Resposta OAuth incompleta', 'A Shopee não retornou access_token, refresh_token e shop_id suficientes para a prova.', 502);
      }

      const firstRead = await getShopInfo({
        apiBaseUrl: API_BASE_URL,
        shopInfoPath: SHOP_INFO_PATH,
        partnerId,
        partnerKey,
        accessToken,
        shopId: effectiveShopId,
      });
      if (!firstRead.response.ok || parseShopeeError(firstRead.payload)) {
        return html('OAuth concluído, leitura falhou', 'Os tokens foram obtidos, mas get_shop_info não respondeu com sucesso. Nenhuma projeção operacional foi aplicada.', 502);
      }

      const initialSnapshotHash = await sha256(firstRead.rawText);
      const { error: initialSnapshotError } = await db.from('marketplace_raw_snapshots').upsert({
        source: 'shopee_open_platform',
        environment: ENVIRONMENT,
        channel_account_id: channelAccountId,
        external_entity_type: 'shop',
        external_entity_id: String(effectiveShopId),
        endpoint: SHOP_INFO_PATH,
        request_id: firstRead.payload.request_id ? String(firstRead.payload.request_id) : null,
        payload: firstRead.payload,
        payload_hash: initialSnapshotHash,
        observed_at: new Date().toISOString(),
      }, {
        onConflict: 'source,environment,channel_account_id,external_entity_type,external_entity_id,endpoint,payload_hash',
        ignoreDuplicates: true,
      });
      if (initialSnapshotError) return html('Leitura concluída, auditoria falhou', 'A leitura foi bem-sucedida, mas o Raw Snapshot não pôde ser persistido.', 503);

      // Persist the first valid token pair before attempting refresh.
      // If refresh fails, the completed OAuth authorization is not lost.
      const initialNow = new Date().toISOString();
      const { error: initialConnectionError } = await db.from('shopee_oauth_connections').upsert({
        channel_account_id: channelAccountId,
        environment: ENVIRONMENT,
        partner_id: partnerId,
        shop_id: effectiveShopId,
        main_account_id: mainAccountId,
        merchant_id: firstRead.payload.merchant_id ? Number(firstRead.payload.merchant_id) : null,
        access_token_ciphertext: await encryptToken(accessToken, tokenEncryptionKey),
        refresh_token_ciphertext: await encryptToken(refreshToken, tokenEncryptionKey),
        access_token_expires_at: accessTokenExpiry(tokenResult.payload.expire_in),
        refresh_token_expires_at: new Date(Date.now() + REFRESH_TTL_MS).toISOString(),
        authorization_expires_at: epochSecondsToIso(firstRead.payload.expire_time),
        shop_name: firstRead.payload.shop_name ? String(firstRead.payload.shop_name) : null,
        region: firstRead.payload.region ? String(firstRead.payload.region) : null,
        shop_status: firstRead.payload.status ? String(firstRead.payload.status) : null,
        last_authenticated_at: initialNow,
        updated_at: initialNow,
      }, {
        onConflict: 'channel_account_id,environment',
      });
      if (initialConnectionError) {
        return html('Leitura concluída, persistência falhou', 'OAuth e get_shop_info funcionaram, mas os tokens protegidos não puderam ser persistidos.', 503);
      }

      const refreshResult = await refreshToken({
        apiBaseUrl: API_BASE_URL,
        refreshPath: REFRESH_PATH,
        partnerId,
        partnerKey,
        refreshToken,
        shopId: effectiveShopId,
      });
      if (!refreshResult.response.ok || parseShopeeError(refreshResult.payload)) {
        return html('Leitura concluída, renovação falhou', 'OAuth e get_shop_info funcionaram, mas a renovação do token de teste falhou. Nenhuma projeção operacional foi aplicada.', 502);
      }

      const refreshedAccessToken = String(refreshResult.payload.access_token ?? '');
      const refreshedRefreshToken = String(refreshResult.payload.refresh_token ?? '');
      if (!refreshedAccessToken || !refreshedRefreshToken) {
        return html('Renovação incompleta', 'A Shopee não retornou o novo par de tokens esperado.', 502);
      }

      const refreshedRead = await getShopInfo({
        apiBaseUrl: API_BASE_URL,
        shopInfoPath: SHOP_INFO_PATH,
        partnerId,
        partnerKey,
        accessToken: refreshedAccessToken,
        shopId: effectiveShopId,
      });
      if (!refreshedRead.response.ok || parseShopeeError(refreshedRead.payload)) {
        return html('Renovação concluída, releitura falhou', 'O token foi renovado, mas a releitura de get_shop_info falhou.', 502);
      }

      const refreshedSnapshotHash = await sha256(refreshedRead.rawText);
      await db.from('marketplace_raw_snapshots').upsert({
        source: 'shopee_open_platform',
        environment: ENVIRONMENT,
        channel_account_id: channelAccountId,
        external_entity_type: 'shop',
        external_entity_id: String(effectiveShopId),
        endpoint: SHOP_INFO_PATH,
        request_id: refreshedRead.payload.request_id ? String(refreshedRead.payload.request_id) : null,
        payload: refreshedRead.payload,
        payload_hash: refreshedSnapshotHash,
        observed_at: new Date().toISOString(),
      }, {
        onConflict: 'source,environment,channel_account_id,external_entity_type,external_entity_id,endpoint,payload_hash',
        ignoreDuplicates: true,
      });

      const now = new Date().toISOString();
      const { error: connectionError } = await db.from('shopee_oauth_connections').upsert({
        channel_account_id: channelAccountId,
        environment: ENVIRONMENT,
        partner_id: partnerId,
        shop_id: effectiveShopId,
        main_account_id: mainAccountId,
        merchant_id: refreshedRead.payload.merchant_id ? Number(refreshedRead.payload.merchant_id) : null,
        access_token_ciphertext: await encryptToken(refreshedAccessToken, tokenEncryptionKey),
        refresh_token_ciphertext: await encryptToken(refreshedRefreshToken, tokenEncryptionKey),
        access_token_expires_at: accessTokenExpiry(refreshResult.payload.expire_in),
        refresh_token_expires_at: new Date(Date.now() + REFRESH_TTL_MS).toISOString(),
        authorization_expires_at: epochSecondsToIso(refreshedRead.payload.expire_time),
        shop_name: refreshedRead.payload.shop_name ? String(refreshedRead.payload.shop_name) : null,
        region: refreshedRead.payload.region ? String(refreshedRead.payload.region) : null,
        shop_status: refreshedRead.payload.status ? String(refreshedRead.payload.status) : null,
        last_authenticated_at: now,
        last_refreshed_at: now,
        updated_at: now,
      }, {
        onConflict: 'channel_account_id,environment',
      });
      if (connectionError) return html('Conexão validada, persistência falhou', 'A prova OAuth funcionou, mas os tokens protegidos não puderam ser persistidos.', 503);

      return html(
        'Shopee Sandbox conectado',
        `OAuth, leitura get_shop_info, renovação de token e releitura concluídos para shop_id ${effectiveShopId}. Nenhuma projeção em Pedido, Estoque, Financeiro ou CRM foi executada.`,
      );
    }

    return json({ error: 'route_not_found' }, 404);
  } catch (error) {
    console.error('[Shopee Sandbox OAuth] Configuration/runtime error without token disclosure:', error instanceof Error ? error.message : 'unknown');
    return json({ error: 'shopee_sandbox_oauth_unavailable' }, 503);
  }
});
