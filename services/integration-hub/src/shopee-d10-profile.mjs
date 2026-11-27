// D10: trusted deployment policy, not caller input. No account/order IDs in code.
// Persistent account policy and recurring admission are D11, not this pilot.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const D10_ORDER_RE = /^[A-Za-z0-9]{8,40}$/;
const int = value => /^\d+$/.test(String(value ?? '')) && Number.isSafeInteger(Number(value)) ? Number(value) : NaN;
export function resolveD10Profile(env, now = Date.now()) {
  if (env('SHOPEE_D10_ENABLED') !== 'true') return null;
  const account = env('SHOPEE_D10_ACCOUNT_ID');
  const shop = int(env('SHOPEE_D10_SHOP_ID'));
  const partner = int(env('SHOPEE_LIVE_PARTNER_ID'));
  const fiscalMode = env('SHOPEE_D10_FISCAL_MODE');
  const from = int(env('SHOPEE_D10_WINDOW_FROM'));
  const to = int(env('SHOPEE_D10_WINDOW_TO'));
  const expiry = Date.parse(env('SHOPEE_D10_EXPIRES_AT') ?? '');
  const seconds = Math.floor(now / 1000);
  if (!UUID.test(account ?? '') || account !== env('SHOPEE_LIVE_CHANNEL_ACCOUNT_ID')
      || !(shop > 0) || partner !== 2047685
      || !['cpf_no_invoice_step','pj_shopee_issuer'].includes(fiscalMode)
      || !(from >= seconds - 86400 && to > from && to <= seconds && to-from <= 3600)
      || !(expiry > now + 60000 && expiry <= now + 1800000)) return null;
  return Object.freeze({account,shop,partner,fiscalMode,from,to,expiry});
}
export function d10CandidateInWindow(profile, candidate) {
  return D10_ORDER_RE.test(candidate?.orderSn ?? '')
    && Number.isSafeInteger(candidate?.createTime)
    && candidate.createTime >= profile.from && candidate.createTime <= profile.to;
}
// The old Adão path has no D10 marker. Only an internal D10 factory supplies it.
export function validD10AutomaticScope(scope, env, now) {
  const p = resolveD10Profile(env, now);
  return Boolean(p && env('SHOPEE_D10_SHIP_ENABLED') === 'true'
    && scope?.profileMode === 'd10'
    && scope.channelAccountId === p.account && scope.shopId === p.shop
    && scope.fiscalMode === p.fiscalMode && d10CandidateInWindow(p, scope));
}
