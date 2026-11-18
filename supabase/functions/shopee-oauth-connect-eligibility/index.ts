// F3-A — validation ONLY. Does not authorize Shopee or create OAuth state.
// This endpoint MUST NOT be used as a bearer capability by the Integration Hub.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { canInitiateShopeeOAuth, validRequestedAccount } from '../_shared/shopee-oauth-authorization.mjs';

const MAX_BYTES = 512;

function json(status: number, body: Record<string, unknown>, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Vary': 'Origin',
      ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    },
  });
}

Deno.serve(async (request: Request) => {
  const configuredOrigin = Deno.env.get('PAINEL_PUBLIC_ORIGIN');
  const origin = request.headers.get('origin');
  // Fail closed; no wildcard CORS, no silent allowance for arbitrary origins.
  if (!configuredOrigin || !origin || origin !== configuredOrigin) return json(403, { error: 'origin_not_authorized' });
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization,apikey,content-type',
        'Access-Control-Max-Age': '300',
        'Vary': 'Origin',
      },
    });
  }
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, origin);
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') {
    return json(415, { error: 'json_required' }, origin);
  }
  const jwtHeader = request.headers.get('authorization');
  const match = /^Bearer ([^\s]+)$/.exec(jwtHeader ?? '');
  if (!match) return json(401, { error: 'authentication_required' }, origin);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json(503, { error: 'unavailable' }, origin);
  let body: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BYTES) return json(413, { error: 'payload_too_large' }, origin);
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'invalid_request' }, origin);
  }
  const accountId = validRequestedAccount(body);
  if (!accountId) return json(400, { error: 'invalid_request' }, origin);
  try {
    const core = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
    // Always verify the user JWT server-side; ignore roles/user IDs supplied by the browser.
    const { data: identity, error: identityError } = await core.auth.getUser(match[1]);
    if (identityError || !identity?.user?.id) return json(401, { error: 'authentication_required' }, origin);
    const authUserId = identity.user.id;
    const [appUser, account, grant] = await Promise.all([
      core.from('app_users').select('auth_user_id,is_active').eq('auth_user_id', authUserId).eq('is_active', true).maybeSingle(),
      core.from('channel_accounts').select('id,platform_id,is_active').eq('id', accountId).maybeSingle(),
      core.from('shopee_oauth_account_grants').select('auth_user_id,channel_account_id')
        .eq('auth_user_id', authUserId).eq('channel_account_id', accountId).maybeSingle(),
    ]);
    if (appUser.error || account.error || grant.error) return json(503, { error: 'unavailable' }, origin);
    if (!account.data?.platform_id) return json(403, { allowed: false }, origin);
    const platform = await core.from('digital_platforms')
      .select('id,name,is_active,group_type,parent_id')
      .eq('id', account.data.platform_id).maybeSingle();
    if (platform.error) return json(503, { error: 'unavailable' }, origin);
    const allowed = canInitiateShopeeOAuth({
      user: identity.user, appUser: appUser.data, account: account.data,
      platform: platform.data, grant: grant.data,
    });
    // This endpoint only answers eligibility, with no OAuth handoff, token or browser redirect.
    return json(allowed ? 200 : 403, { allowed }, origin);
  } catch {
    return json(503, { error: 'unavailable' }, origin);
  }
});
