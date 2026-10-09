import { createClient } from 'npm:@supabase/supabase-js@2';
import { createBridgeHandler } from './handler.mjs';

const CORE_ORIGIN = 'https://xkskyutmtlhivvpfxkjg.supabase.co';
const LIVE = 'live';
const SHOP_INFO_ENDPOINT = '/api/v2/shop/get_shop_info';

function coreClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || new URL(url).origin !== CORE_ORIGIN || !serviceRole) return null;
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function activeChannelAccount(core: ReturnType<typeof createClient>, channelAccountId: string) {
  const { data, error } = await core
    .from('channel_accounts')
    .select('id,is_active')
    .eq('id', channelAccountId)
    .maybeSingle();
  if (error) return { ok: false, unavailable: true };
  return { ok: data?.is_active === true, unavailable: false };
}

async function executeAction(payload: Record<string, unknown>) {
  const core = coreClient();
  if (!core) return { status: 503, body: { error: 'core_unavailable' } };

  if (payload.action === 'shopee.oauth_state.create') {
    const channelAccountId = String(payload.channel_account_id);
    const account = await activeChannelAccount(core, channelAccountId);
    if (account.unavailable) return { status: 503, body: { error: 'core_unavailable' } };
    if (!account.ok) return { status: 409, body: { error: 'channel_account_unavailable' } };

    const { error } = await core.from('shopee_oauth_states').upsert({
      state_hash: String(payload.state_hash),
      channel_account_id: channelAccountId,
      environment: LIVE,
      expires_at: String(payload.expires_at),
    }, {
      onConflict: 'state_hash',
      ignoreDuplicates: true,
    });

    return error
      ? { status: 503, body: { error: 'oauth_state_persistence_failed' } }
      : { status: 200, body: { status: 'ok', action: payload.action } };
  }

  if (payload.action === 'shopee.oauth_state.consume') {
    const usedAt = new Date().toISOString();
    const { data, error } = await core
      .from('shopee_oauth_states')
      .update({ used_at: usedAt })
      .eq('state_hash', String(payload.state_hash))
      .eq('environment', LIVE)
      .is('used_at', null)
      .gt('expires_at', usedAt)
      .select('channel_account_id')
      .maybeSingle();

    if (error) return { status: 503, body: { error: 'oauth_state_consume_failed' } };
    if (!data?.channel_account_id) return { status: 409, body: { error: 'oauth_state_invalid_or_consumed' } };

    return {
      status: 200,
      body: {
        status: 'ok',
        action: payload.action,
        channel_account_id: String(data.channel_account_id),
      },
    };
  }

  if (payload.action === 'shopee.oauth_connection.upsert') {
    const channelAccountId = String(payload.channel_account_id);
    const account = await activeChannelAccount(core, channelAccountId);
    if (account.unavailable) return { status: 503, body: { error: 'core_unavailable' } };
    if (!account.ok) return { status: 409, body: { error: 'channel_account_unavailable' } };

    const now = new Date().toISOString();
    const { error } = await core.from('shopee_oauth_connections').upsert({
      channel_account_id: channelAccountId,
      environment: LIVE,
      partner_id: Number(payload.partner_id),
      shop_id: Number(payload.shop_id),
      main_account_id: payload.main_account_id == null ? null : Number(payload.main_account_id),
      merchant_id: payload.merchant_id == null ? null : Number(payload.merchant_id),
      access_token_ciphertext: String(payload.access_token_ciphertext),
      refresh_token_ciphertext: String(payload.refresh_token_ciphertext),
      access_token_expires_at: payload.access_token_expires_at == null ? null : String(payload.access_token_expires_at),
      refresh_token_expires_at: payload.refresh_token_expires_at == null ? null : String(payload.refresh_token_expires_at),
      authorization_expires_at: payload.authorization_expires_at == null ? null : String(payload.authorization_expires_at),
      shop_name: payload.shop_name == null ? null : String(payload.shop_name),
      region: payload.region == null ? null : String(payload.region),
      shop_status: payload.shop_status == null ? null : String(payload.shop_status),
      last_authenticated_at: String(payload.last_authenticated_at),
      last_refreshed_at: payload.last_refreshed_at == null ? null : String(payload.last_refreshed_at),
      updated_at: now,
    }, {
      onConflict: 'channel_account_id,environment',
    });

    if (error?.code === '23505') return { status: 409, body: { error: 'oauth_connection_conflict' } };
    return error
      ? { status: 503, body: { error: 'oauth_connection_persistence_failed' } }
      : { status: 200, body: { status: 'ok', action: payload.action } };
  }

  if (payload.action === 'shopee.raw_shop_snapshot.upsert') {
    const channelAccountId = String(payload.channel_account_id);
    const account = await activeChannelAccount(core, channelAccountId);
    if (account.unavailable) return { status: 503, body: { error: 'core_unavailable' } };
    if (!account.ok) return { status: 409, body: { error: 'channel_account_unavailable' } };

    const { error } = await core.from('marketplace_raw_snapshots').upsert({
      source: 'shopee_open_platform',
      environment: LIVE,
      channel_account_id: channelAccountId,
      external_entity_type: 'shop',
      external_entity_id: String(payload.external_entity_id),
      endpoint: SHOP_INFO_ENDPOINT,
      request_id: payload.request_id == null ? null : String(payload.request_id),
      observed_at: String(payload.observed_at),
      payload: payload.payload,
      payload_hash: String(payload.payload_hash),
    }, {
      onConflict: 'source,environment,channel_account_id,external_entity_type,external_entity_id,endpoint,payload_hash',
      ignoreDuplicates: true,
    });

    return error
      ? { status: 503, body: { error: 'raw_snapshot_persistence_failed' } }
      : { status: 200, body: { status: 'ok', action: payload.action } };
  }

  return { status: 400, body: { error: 'unsupported_action' } };
}

Deno.serve(createBridgeHandler({
  getSecret: () => Deno.env.get('INTEGRATION_HUB_CORE_BRIDGE_HMAC_SECRET'),
  checkCore: async () => {
    const core = coreClient();
    if (!core) return false;
    const { error } = await core
      .from('channel_accounts')
      .select('id')
      .limit(1)
      .abortSignal(AbortSignal.timeout(4000));
    return error === null;
  },
  executeAction,
  logger: (entry) => console.info(JSON.stringify(entry)),
}));
