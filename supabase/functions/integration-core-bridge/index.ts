import { createClient } from 'npm:@supabase/supabase-js@2';
import { createBridgeHandler } from './handler.mjs';

Deno.serve(createBridgeHandler({
  getSecret: () => Deno.env.get('INTEGRATION_HUB_CORE_BRIDGE_HMAC_SECRET'),
  checkCore: async () => {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || new URL(url).origin !== 'https://xkskyutmtlhivvpfxkjg.supabase.co' || !serviceRole) return false;
    // The client and service_role exist only inside this authenticated server-side callback.
    const core = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { error } = await core.from('channel_accounts').select('id').limit(1).abortSignal(AbortSignal.timeout(4000));
    return error === null;
  },
  logger: (entry) => console.info(JSON.stringify(entry)),
}));
