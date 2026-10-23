import { pathToFileURL } from 'node:url';
import { ADAO } from './read-adao-orders.mjs';
import { createShopeeOauthRefreshOnce } from './shopee-oauth-refresh-once.mjs';
import { CORE_BRIDGE_URL, readLiveShopeeOauthConnection,
  refreshLiveShopeeOauthConnection } from './core-bridge.mjs';
import { refreshToken } from './connectors/shopee-protocol.mjs';

const REFRESH_PATH = '/api/v2/auth/access_token/get';
const REQUIRED_SECRETS = ['SHOPEE_LIVE_PARTNER_KEY', 'SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY', 'CORE_BRIDGE_HMAC_SECRET'];
const CONFIRMATION = '--confirm=REFRESH_ADAO_TOKEN_ONCE';
const quiet = () => {};
const fail = code => ({ ok: false, code, account_id: ADAO.channel_account_id, shop_id: ADAO.shop_id });

/** One-shot maintenance, not a scheduler or automatic token refresh. */
export async function refreshAdaoTokenOnce({ env = process.env, fetchImpl = globalThis.fetch, now = Date.now,
  confirmed = false } = {}) {
  if (!confirmed) return fail('confirmation_required');
  if (REQUIRED_SECRETS.some(name => typeof env[name] !== 'string' || !env[name].trim())) {
    return fail('configuration_missing');
  }
  const getEnv = name => ({
    SHOPEE_LIVE_PARTNER_ID: String(ADAO.partner_id),
    SHOPEE_LIVE_CHANNEL_ACCOUNT_ID: ADAO.channel_account_id,
    SHOPEE_LIVE_PARTNER_KEY: env.SHOPEE_LIVE_PARTNER_KEY,
    SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY: env.SHOPEE_LIVE_TOKEN_ENCRYPTION_KEY,
  })[name];
  let coreReads = 0;
  let coreWrites = 0;
  let shopeeRefreshes = 0;
  const transport = async (input, init = {}) => {
    const url = new URL(input);
    const method = init.method ?? 'GET';
    if (method !== 'POST') throw new Error('forbidden_transport');
    if (url.href === CORE_BRIDGE_URL) {
      const body = JSON.parse(init.body);
      if (body.channel_account_id !== ADAO.channel_account_id) throw new Error('wrong_account');
      if (body.action === 'shopee.oauth_connection.read') {
        if (Object.keys(body).some(key => !['action', 'channel_account_id'].includes(key))
          || ++coreReads > 2) throw new Error('forbidden_core_read');
      } else if (body.action === 'shopee.oauth_connection.refresh') {
        if (++coreWrites > 1 || typeof body.access_token_ciphertext !== 'string'
          || typeof body.refresh_token_ciphertext !== 'string'
          || typeof body.last_refreshed_at !== 'string') throw new Error('forbidden_core_write');
      } else throw new Error('forbidden_core_action');
    } else if (url.origin === 'https://partner.shopeemobile.com'
      && url.pathname === REFRESH_PATH
      && url.searchParams.get('partner_id') === String(ADAO.partner_id)) {
      const body = JSON.parse(init.body);
      if (++shopeeRefreshes > 1 || body.partner_id !== ADAO.partner_id
        || body.shop_id !== ADAO.shop_id || typeof body.refresh_token !== 'string') {
        throw new Error('forbidden_shopee_refresh');
      }
    } else throw new Error('forbidden_endpoint');
    return fetchImpl(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(15000) });
  };
  const coreRead = data => {
    if (data?.channel_account_id !== ADAO.channel_account_id) return Promise.resolve({ ok: false });
    return readLiveShopeeOauthConnection(data, {
      url: CORE_BRIDGE_URL, secret: env.CORE_BRIDGE_HMAC_SECRET, fetchImpl: transport, logger: quiet,
    });
  };
  const identityMatches = result => result?.ok === true
    && Number(result.payload?.partner_id) === ADAO.partner_id
    && Number(result.payload?.shop_id) === ADAO.shop_id;
  try {
    const first = await coreRead({ channel_account_id: ADAO.channel_account_id });
    if (!first?.ok) return fail('connection_unavailable');
    if (!identityMatches(first)) return fail('stored_identity_mismatch');
    const expires = Date.parse(String(first.payload.access_token_expires_at ?? ''));
    if (Number.isFinite(expires) && expires > now() + 60_000) {
      return { ok: true, code: 'already_valid', account_id: ADAO.channel_account_id,
        shop_id: ADAO.shop_id, access_token_expires_at: first.payload.access_token_expires_at };
    }

    let usedFirst = false;
    const run = createShopeeOauthRefreshOnce({
      getEnv, now,
      readConnection: async data => {
        if (data?.channel_account_id !== ADAO.channel_account_id) return { ok: false };
        const result = usedFirst ? await coreRead(data) : first;
        usedFirst = true;
        return identityMatches(result) ? result : { ok: false };
      },
      persistRefresh: data => {
        if (data?.channel_account_id !== ADAO.channel_account_id) return Promise.resolve({ ok: false });
        return refreshLiveShopeeOauthConnection(data, {
          url: CORE_BRIDGE_URL, secret: env.CORE_BRIDGE_HMAC_SECRET, fetchImpl: transport, logger: quiet,
        });
      },
      refreshAccessToken: async args => {
        if (args.partnerId !== ADAO.partner_id || args.shopId !== ADAO.shop_id) {
          throw new Error('wrong_shop');
        }
        const response = await refreshToken({ ...args, fetchImpl: transport });
        if (response.response?.ok && response.payload?.shop_id != null
          && Number(response.payload.shop_id) !== ADAO.shop_id) {
          return { response: { ok: false, status: 409 }, payload: { error: 'shop_mismatch' } };
        }
        return response;
      },
    });
    const result = await run();
    if (!result?.ok || !identityMatches({ ok: true, payload: result.after })) {
      return fail(result?.ok ? 'post_refresh_identity_mismatch' : result?.code ?? 'refresh_failed');
    }
    return { ok: true, code: 'refreshed', account_id: ADAO.channel_account_id,
      shop_id: ADAO.shop_id, access_token_expires_at: result.after.access_token_expires_at };
  } catch {
    return fail('execution_failed');
  }
}

export async function main(args = process.argv.slice(2)) {
  if (args.length !== 2 || args[0] !== '--refresh-once' || args[1] !== CONFIRMATION) {
    console.log('Usage: node services/integration-hub/src/refresh-adao-token-once.mjs --refresh-once --confirm=REFRESH_ADAO_TOKEN_ONCE');
    return 2;
  }
  const result = await refreshAdaoTokenOnce({ confirmed: true });
  console.log(JSON.stringify(result));
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
