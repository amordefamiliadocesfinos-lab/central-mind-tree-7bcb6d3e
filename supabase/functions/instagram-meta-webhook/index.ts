import { createClient } from 'npm:@supabase/supabase-js@2';
import { applyInboundTemporalAuthority } from '../_shared/crm/temporal-authority-inbound.ts';
import { refreshLiveContextAfterEvent } from '../_shared/crm/live-context.ts';
import { instagramConversationHandle, normalizeInstagramWebhooks } from '../_shared/instagram/meta-connector.ts';
import { hasValidMetaSignature, isInstagramWebhookVerification } from '../_shared/instagram/webhook-security.ts';

const MAX_BODY_BYTES = 256 * 1024;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (request) => {
  const url = new URL(request.url);
  const verifyToken = Deno.env.get('META_INSTAGRAM_VERIFY_TOKEN') ?? '';
  if (request.method === 'GET') {
    const verified = isInstagramWebhookVerification(url, verifyToken);
    return verified ? new Response(url.searchParams.get('hub.challenge') ?? '') : new Response('Forbidden', { status: 403 });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = Deno.env.get('META_APP_SECRET') ?? '';
  if (!secret) return json({ error: 'Webhook não configurado' }, 503);
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'Payload muito grande' }, 413);
  if (!await hasValidMetaSignature(raw, request.headers.get('x-hub-signature-256'), secret)) return json({ error: 'Assinatura inválida' }, 401);
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return json({ error: 'JSON inválido' }, 400); }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const events = normalizeInstagramWebhooks(payload);
  let processed = 0;
  for (const event of events) {
    if (!event.accepted || !event.deduplicationKey || !event.senderId || !event.recipientId) continue;
    const receipt = await supabase.from('integration_webhook_receipts').insert({
      provider_name: event.providerName, provider_instance_ref: event.providerInstanceRef,
      event_type: event.eventType, deduplication_key: event.deduplicationKey, processing_status: 'processing',
    });
    if (receipt.error?.code === '23505') continue;
    if (receipt.error) { console.error('instagram receipt failed', receipt.error.message); continue; }
    const finish = async (status: string, error?: string) => supabase.from('integration_webhook_receipts').update({ processing_status: status, error_message: error ?? null, processed_at: new Date().toISOString() }).eq('deduplication_key', event.deduplicationKey!);
    try {
      const handle = instagramConversationHandle(event.recipientId, event.senderId);
      let conversationResult = await supabase.from('service_conversations').select('id,contact_id,unread_count').eq('channel', 'instagram').eq('contact_handle', handle).order('last_message_at', { ascending: false }).limit(1).maybeSingle();
      if (conversationResult.error) throw conversationResult.error;
      let conversation = conversationResult.data;
      let contactId = conversation?.contact_id ?? null;
      if (!contactId) {
        const createdContact = await supabase.from('contacts').insert({
          name: event.username?.trim() || `Instagram ${event.senderId.slice(-4)}`,
          origem_lead: 'Instagram', funnel_status: 'novo_lead', is_active: true,
        }).select('id,name,funnel_status').single();
        if (createdContact.error) throw createdContact.error;
        contactId = createdContact.data.id;
        if (conversation) {
          const linked = await supabase.from('service_conversations').update({ contact_id: contactId, contact_name: createdContact.data.name, funnel_stage: createdContact.data.funnel_status }).eq('id', conversation.id);
          if (linked.error) throw linked.error;
        } else {
          const createdConversation = await supabase.from('service_conversations').insert({
            contact_id: contactId, contact_name: createdContact.data.name, contact_handle: handle, channel: 'instagram',
            status: 'open', funnel_stage: createdContact.data.funnel_status,
          }).select('id,contact_id,unread_count').single();
          if (createdConversation.error) throw createdConversation.error;
          conversation = createdConversation.data;
        }
      }
      if (!conversation) throw new Error('Conversa Instagram não criada');
      const at = event.providerTimestamp ?? new Date().toISOString();
      const inbound = event.direction !== 'outbound';
      const message = await supabase.from('service_messages').insert({
        conversation_id: conversation.id, sender: inbound ? 'customer' : 'agent', content: event.content ?? 'Mensagem não suportada',
        direction: event.direction ?? 'inbound', message_type: event.messageType ?? 'text', delivery_status: inbound ? 'received' : 'sent',
        external_message_id: event.externalMessageId, provider_timestamp: at, source: event.source ?? 'provider',
        provider_name: event.providerName, provider_instance_ref: event.providerInstanceRef, media_url: event.mediaUrl ?? null,
        media_mime_type: event.mediaMimeType ?? null, media_filename: event.mediaFilename ?? null, media_caption: event.mediaCaption ?? null,
      });
      if (message.error && message.error.code !== '23505') throw message.error;
      const update = await supabase.from('service_conversations').update({
        last_message_at: at, last_message_preview: (event.content ?? '').slice(0, 100),
        ...(inbound ? { last_inbound_at: at, needs_reply: true, status: 'open', resolved_at: null, attendance_state: 'responder', unread_count: (conversation.unread_count ?? 0) + 1 } : { last_outbound_at: at, needs_reply: false, attendance_state: 'aguardando_cliente' }),
      }).eq('id', conversation.id);
      if (update.error) throw update.error;
      if (inbound) await applyInboundTemporalAuthority(supabase, { contactId, conversationId: conversation.id, occurredAt: at });
      await refreshLiveContextAfterEvent(supabase, { contactId, type: inbound ? 'inbound' : 'outbound', occurredAt: at, summary: inbound ? `Mensagem Instagram recebida: ${(event.content ?? '').slice(0, 240)}` : undefined });
      await finish('processed'); processed++;
    } catch (error) {
      console.error('instagram webhook processing failed', (error as Error).message);
      await finish('error', (error as Error).message);
    }
  }
  return json({ ok: true, received: events.length, processed });
});
