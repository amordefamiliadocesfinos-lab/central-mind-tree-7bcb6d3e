import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { parseInstagramConversationHandle, sendInstagramText } from '../_shared/instagram/meta-connector.ts';
import { isInstagramCustomerServiceWindowOpen } from '../_shared/instagram/message-window.ts';
import { refreshLiveContextAfterEvent } from '../_shared/crm/live-context.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Não autenticado' }, 401);
  const auth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
  const claims = await auth.auth.getClaims(authorization.replace('Bearer ', ''));
  if (claims.error || !claims.data?.claims) return json({ error: 'Não autenticado' }, 401);
  let body: { conversation_id?: string; message?: string };
  try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const conversationId = String(body.conversation_id ?? '').trim();
  const messageText = String(body.message ?? '').trim();
  if (!conversationId || !messageText) return json({ error: 'Conversa e mensagem são obrigatórias' }, 400);
  if (messageText.length > 1000) return json({ error: 'Mensagem muito longa para Instagram' }, 400);
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const result = await supabase.from('service_conversations').select('id,contact_id,contact_handle,channel,needs_reply,last_inbound_at').eq('id', conversationId).maybeSingle();
  if (result.error) return json({ error: result.error.message }, 500);
  if (!result.data || result.data.channel !== 'instagram') return json({ error: 'Conversa Instagram não encontrada' }, 404);
  if (!isInstagramCustomerServiceWindowOpen(result.data.last_inbound_at)) {
    return json({ error: 'A janela de atendimento do Instagram está encerrada. Aguarde uma nova mensagem do cliente para responder.', code: 'instagram_window_closed' }, 409);
  }
  const identity = parseInstagramConversationHandle(result.data.contact_handle);
  if (!identity) return json({ error: 'Identidade externa Instagram inválida' }, 400);
  const configuredAccountId = Deno.env.get('META_INSTAGRAM_ACCOUNT_ID') ?? '';
  if (!configuredAccountId || identity.accountId !== configuredAccountId) return json({ error: 'Conta profissional Instagram não configurada para esta conversa' }, 409);
  if (result.data.contact_id) {
    const contact = await supabase.from('contacts').select('commercial_opt_out').eq('id', result.data.contact_id).maybeSingle();
    // Opt-out blocks proactive contact, but must not prevent the operator from
    // replying to an active inbound conversation initiated by the customer.
    if (contact.data?.commercial_opt_out && !result.data.needs_reply) {
      return json({ error: 'Este contato marcou que não deseja receber contato comercial.', code: 'commercial_opt_out' }, 403);
    }
  }
  const now = new Date().toISOString();
  const pending = await supabase.from('service_messages').insert({
    conversation_id: conversationId, sender: 'agent', content: messageText, direction: 'outbound', message_type: 'text', delivery_status: 'pending', source: 'crm',
    provider_name: 'meta_instagram_messaging', provider_instance_ref: identity.accountId,
  }).select('id').single();
  if (pending.error) return json({ error: `Falha ao registrar mensagem: ${pending.error.message}` }, 500);
  const sent = await sendInstagramText({ accountId: identity.accountId, scopedUserId: identity.scopedUserId, message: messageText });
  if (!sent.ok) {
    await supabase.from('service_messages').update({ delivery_status: 'failed', error_code: sent.errorCode ?? 'send_failed' }).eq('id', pending.data.id);
    return json({ error: sent.errorMessage ?? 'Falha no envio pelo Instagram', code: sent.errorCode ?? 'send_failed' }, 502);
  }
  await supabase.from('service_messages').update({ delivery_status: 'sent', external_message_id: sent.externalMessageId ?? null, provider_timestamp: now }).eq('id', pending.data.id);
  await supabase.from('service_conversations').update({ last_message_at: now, last_outbound_at: now, last_message_preview: messageText.slice(0, 100), needs_reply: false, unread_count: 0, attendance_state: 'aguardando_cliente' }).eq('id', conversationId);
  await refreshLiveContextAfterEvent(supabase, { contactId: result.data.contact_id, type: 'outbound', occurredAt: now, summary: messageText.length >= 24 ? `Mensagem Instagram enviada: ${messageText.slice(0, 240)}` : undefined });
  return json({ ok: true, message_id: pending.data.id, external_message_id: sent.externalMessageId ?? null });
});
