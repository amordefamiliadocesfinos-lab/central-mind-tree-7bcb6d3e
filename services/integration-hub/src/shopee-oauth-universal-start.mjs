// Universal OAuth F3-B start: wired behind default-off gate.
// The universal callback is intentionally rejected by the legacy handler until F3-C.
import { randomBytes, createHash } from 'node:crypto';
import { consumeLiveShopeeOauthHandoff, createLiveShopeeOauthState } from './core-bridge.mjs';
import { signPublicRequest } from './connectors/shopee-protocol.mjs';
import { hashHandoffTicket, validateHandoffConsumeResult } from './shopee-oauth-universal-handoff.mjs';

const ROUTE = '/shopee/live/oauth/universal/start';
const CALLBACK = 'https://integration-hub-oauth-bh4c23q1.ue.gateway.dev/shopee/live/oauth/callback';
const COOKIE_NAME = '__Host-pc_shopee_live_state';
const TTL_MS = 600000;
function respond(status, message) {
  return { status, headers: {
    'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8',
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
  }, body: message };
}
export function createUniversalShopeeStartHandler({
  getEnv = (key) => process.env[key],
  consumeHandoff = consumeLiveShopeeOauthHandoff,
  createState = createLiveShopeeOauthState,
  sign = signPublicRequest,
  now = Date.now,
  makeState = () => randomBytes(32).toString('base64url'),
} = {}) {
  return async function handleUniversalStart(request) {
    if (request?.path !== ROUTE) return null;
    if (request?.method !== 'GET') return respond(405, 'Método não permitido');
    // Both flags are required. F3-C callback handling does not exist yet.
    if (getEnv('SHOPEE_OAUTH_UNIVERSAL_START_ENABLED') !== 'true') {
      return respond(503, 'Início OAuth universal ainda não habilitado');
    }
    const query = request?.query ?? {};
    if (Object.keys(query).length !== 1) return respond(400, 'Parâmetros inválidos');
    const ticketHash = hashHandoffTicket(query.ticket);
    if (!ticketHash) return respond(400, 'Ticket inválido');
    const partnerId = Number(getEnv('SHOPEE_LIVE_PARTNER_ID'));
    const partnerKey = getEnv('SHOPEE_LIVE_PARTNER_KEY');
    const callback = getEnv('SHOPEE_LIVE_REDIRECT_URI');
    if (partnerId !== 2047685 || typeof partnerKey !== 'string' || !partnerKey || callback !== CALLBACK) {
      return respond(503, 'Configuração OAuth indisponível');
    }
    try {
      const consumed = await consumeHandoff({ ticket_hash: ticketHash });
      const target = validateHandoffConsumeResult(consumed, [partnerId]);
      if (!target) return respond(409, 'Ticket expirado ou não autorizado');
      const state = 'universal.' + makeState();
      const persisted = await createState({
        state_hash: createHash('sha256').update(state).digest('hex'),
        channel_account_id: target.channel_account_id,
        expires_at: new Date(now() + TTL_MS).toISOString(),
      });
      if (!persisted?.ok) return respond(503, 'Não foi possível preparar o estado OAuth');
      const signature = await sign({ partnerId, partnerKey, path: '/api/v2/shop/auth_partner' });
      if (!Number.isSafeInteger(Number(signature.timestamp)) || !/^[a-f0-9]{64}$/i.test(String(signature.sign))) {
        return respond(503, 'Não foi possível assinar a autorização');
      }
      const url = new URL('https://partner.shopeemobile.com/api/v2/shop/auth_partner');
      url.searchParams.set('partner_id', String(partnerId));
      url.searchParams.set('timestamp', String(signature.timestamp));
      url.searchParams.set('sign', signature.sign);
      url.searchParams.set('redirect', callback);
      return {
        status: 302,
        headers: {
          'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
          'Location': url.toString(),
          'Set-Cookie': `${COOKIE_NAME}=${encodeURIComponent(state)}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
          'X-Content-Type-Options': 'nosniff',
        },
        body: '',
      };
    } catch {
      return respond(503, 'Início OAuth universal indisponível');
    }
  };
}
export const handleUniversalShopeeStart = createUniversalShopeeStartHandler();
