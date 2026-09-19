import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { normalizeBrPhone } from '../_shared/whatsapp/connector.ts';
import { getWhatsAppConnector } from '../_shared/whatsapp/zapi-connector.ts';
import { refreshLiveContextAfterEvent } from '../_shared/crm/live-context.ts';
import { applyInboundTemporalAuthority } from '../_shared/crm/temporal-authority-inbound.ts';

const MAX_BODY_BYTES = 256 * 1024;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const PHOTO_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const AVATAR_BUCKET = 'contact-avatars';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/**
 * Substitui a foto do contato pela foto atual do WhatsApp.
 * Nunca lança: falhas apenas registram erro técnico (sem secrets/telefone).
 */
async function syncWhatsAppPhoto(
  supabase: any,
  connector: ReturnType<typeof getWhatsAppConnector>,
  contactId: string,
  phone: string,
  conversationId: string | null,
) {
  const { data: contact } = await supabase
    .from('contacts')
    .select('whatsapp_photo_synced_at')
    .eq('id', contactId)
    .maybeSingle();

  const lastSync = contact?.whatsapp_photo_synced_at ? Date.parse(contact.whatsapp_photo_synced_at) : 0;
  if (lastSync && Date.now() - lastSync < PHOTO_SYNC_INTERVAL_MS) return;

  await supabase
    .from('contacts')
    .update({ whatsapp_photo_synced_at: new Date().toISOString() })
    .eq('id', contactId);

  const picture = await connector.getProfilePictureUrl(phone);
  if (!picture.ok || !picture.temporaryUrl) {
    console.log('photo sync skipped', picture.errorCode ?? 'unknown');
    return;
  }

  const res = await fetch(picture.temporaryUrl);
  if (!res.ok) {
    console.log('photo download failed', `http_${res.status}`);
    return;
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.startsWith('image/')) {
    console.log('photo download rejected: content-type inválido');
    return;
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > MAX_AVATAR_BYTES) {
    console.log('photo download rejected: tamanho inválido');
    return;
  }

  const path = `whatsapp/${contactId}`;
  const { error: uploadErr } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (uploadErr) {
    console.log('photo upload failed', uploadErr.message);
    return;
  }

  const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

  await supabase.from('contacts').update({ photo_url: publicUrl }).eq('id', contactId);
  if (conversationId) {
    await supabase
      .from('service_conversations')
      .update({ contact_avatar_url: publicUrl })
      .eq('id', conversationId);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const expectedSecret = Deno.env.get('WHATSAPP_WEBHOOK_SECRET');
  if (!expectedSecret) return json({ error: 'Webhook não configurado' }, 503);

  const url = new URL(req.url);
  const provided = req.headers.get('x-webhook-secret') ?? url.searchParams.get('secret');
  if (provided !== expectedSecret) return json({ error: 'Unauthorized' }, 401);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'Payload muito grande' }, 413);

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const connector = getWhatsAppConnector();
  const evt = connector.normalizeWebhook(payload);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  if (evt.providerInstanceRef) {
    await supabase.from('whatsapp_integrations').upsert(
      {
        provider: evt.providerName,
        instance_reference: evt.providerInstanceRef,
        last_webhook_at: new Date().toISOString(),
        connection_status: 'connected',
        last_checked_at: new Date().toISOString(),
      },
      { onConflict: 'instance_reference' },
    );
  }

  if (!evt.accepted) return json({ ignored: true, reason: evt.ignoredReason });

  const dedupKey = evt.deduplicationKey!;
  const { error: dedupError } = await supabase
    .from('integration_webhook_receipts')
    .insert({
      provider_name: evt.providerName,
      provider_instance_ref: evt.providerInstanceRef,
      event_type: evt.eventType,
      deduplication_key: dedupKey,
      processing_status: 'processing',
    });
  if (dedupError) {
    if (dedupError.code === '23505') return json({ duplicate: true });
    console.error('receipt insert failed', dedupError.message);
    return json({ error: 'Falha ao registrar recebimento' }, 500);
  }

  const finish = async (status: string, message?: string) => {
    await supabase
      .from('integration_webhook_receipts')
      .update({ processing_status: status, error_message: message ?? null, processed_at: new Date().toISOString() })
      .eq('deduplication_key', dedupKey);
  };

  try {
    const phone = normalizeBrPhone(evt.contactPhoneRaw);
    if (!phone) {
      await finish('ignored', 'telefone inválido');
      return json({ ignored: true, reason: 'telefone inválido' });
    }

    const { data: matches } = await supabase
      .from('contacts')
      .select('id, name')
      .eq('phone_normalized', phone)
      .limit(5);

    let contactId: string | null = null;
    let contactName: string | null = evt.contactName ?? null;

    if (matches && matches.length === 1) {
      contactId = matches[0].id;
      contactName = matches[0].name;
    } else if (!matches || matches.length === 0) {
      const fallbackName = evt.contactName?.trim() || `Contato WhatsApp ${phone.slice(-4)}`;
      const { data: created, error: createErr } = await supabase
        .from('contacts')
        .insert({
          name: fallbackName,
          whatsapp: phone,
          origem_lead: 'WhatsApp',
          funnel_status: 'novo_lead',
          is_active: true,
        })
        .select('id, name')
        .single();
      if (createErr) throw new Error(`contato: ${createErr.message}`);
      contactId = created.id;
      contactName = created.name;
    }

    let conversationId: string | null = null;
    if (contactId) {
      const { data: conv } = await supabase
        .from('service_conversations')
        .select('id')
        .eq('contact_id', contactId)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      conversationId = conv?.id ?? null;
    }
    if (!conversationId) {
      const { data: conv } = await supabase
        .from('service_conversations')
        .select('id')
        .eq('contact_handle', phone)
        .limit(1)
        .maybeSingle();
      conversationId = conv?.id ?? null;
    }
    if (!conversationId) {
      const { data: created, error: convErr } = await supabase
        .from('service_conversations')
        .insert({
          contact_id: contactId,
          contact_name: contactName,
          contact_handle: phone,
          status: 'open',
          funnel_stage: 'novo_lead',
          channel: 'whatsapp',
        })
        .select('id')
        .single();
      if (convErr) throw new Error(`conversa: ${convErr.message}`);
      conversationId = created.id;
    }

    const inbound = evt.direction === 'inbound';
    const nowIso = new Date().toISOString();

    const { error: msgErr } = await supabase.from('service_messages').insert({
      conversation_id: conversationId,
      sender: inbound ? 'customer' : 'agent',
      content: evt.content ?? 'Mensagem não suportada',
      is_ai_suggested: false,
      external_message_id: evt.externalMessageId,
      direction: evt.direction,
      message_type: evt.messageType ?? 'text',
      delivery_status: inbound ? 'received' : 'sent',
      provider_timestamp: evt.providerTimestamp,
      source: inbound ? 'provider' : 'mobile',
      provider_name: evt.providerName,
      provider_instance_ref: evt.providerInstanceRef,
    });

    if (msgErr && msgErr.code !== '23505') throw new Error(`mensagem: ${msgErr.message}`);

    const preview = (evt.content ?? '').slice(0, 100);
    const { error: conversationError } = await supabase
      .from('service_conversations')
      .update({
        last_message_at: nowIso,
        last_message_preview: preview,
        needs_reply: inbound,
        ...(inbound
          ? { last_inbound_at: nowIso, status: 'open', resolved_at: null, attendance_state: 'responder' }
          : { last_outbound_at: nowIso }),
      })
      .eq('id', conversationId);
    if (conversationError) throw conversationError;

    if (inbound) {
      await applyInboundTemporalAuthority(supabase, {
        contactId,
        conversationId,
        occurredAt: nowIso,
      });
    }

    if (contactId) {
      try {
        await syncWhatsAppPhoto(supabase, connector, contactId, phone, conversationId);
      } catch (e) {
        console.error('photo sync failed', (e as Error).message);
      }
    }

    await refreshLiveContextAfterEvent(supabase, {
      contactId,
      type: inbound ? 'inbound' : 'outbound',
      occurredAt: nowIso,
      summary: inbound ? `Mensagem recebida: ${(evt.content ?? '').slice(0, 240)}` : undefined,
    });

    await finish('processed');
    return json({ ok: true, duplicate_message: msgErr?.code === '23505' });
  } catch (e) {
    const message = (e as Error).message;
    console.error('webhook processing error', message);
    await finish('error', message);
    return json({ error: 'Falha ao processar evento' }, 500);
  }
});
