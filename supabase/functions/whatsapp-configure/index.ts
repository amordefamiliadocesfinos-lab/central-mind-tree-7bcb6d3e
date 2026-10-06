import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { getWhatsAppConnector } from '../_shared/whatsapp/meta-connector.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Não autenticado' }, 401);

  const authClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(
    authHeader.replace('Bearer ', ''),
  );
  if (claimsError || !claimsData?.claims) return json({ error: 'Não autenticado' }, 401);

  const body = await req.json().catch(() => ({}));
  if (body?.action !== 'enable_sent_by_me') return json({ error: 'Ação inválida' }, 400);

  const connector = getWhatsAppConnector();
  const result = await connector.enableSentByMeNotifications();
  if (!result.ok) {
    console.error('sent-by-me configuration failed', result.errorCode ?? 'unknown');
    return json({ error: 'Não foi possível ativar o histórico de mensagens do celular' }, 502);
  }

  return json({ ok: true });
});
