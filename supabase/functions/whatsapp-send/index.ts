import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { normalizeBrPhone } from '../_shared/whatsapp/connector.ts';
import { getWhatsAppConnector } from '../_shared/whatsapp/meta-connector.ts';
import { applyOutboundOperationalEffects } from '../_shared/crm/outbound-operational.ts';

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

  let body: { conversation_id?: string; message?: string; media_url?: string; media_type?: string; media_mime_type?: string; media_filename?: string; mode?: string; campaign_id?: string; recipient_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  // Handshake somente leitura: impede o painel de enviar usando uma versão
  // antiga da função, ainda sem reserva atômica (sincronização/deploy assíncronos).
  if (body.mode === 'campaign_preflight') {
    return json({ ok: true, campaign_dispatch_protocol: 2 });
  }
  const isCampaign = String(body.mode ?? '').trim() === 'campaign';
  const conversationId = String(body.conversation_id ?? '').trim();
  const message = String(body.message ?? '').trim();
  const mediaUrl = String(body.media_url ?? '').trim();
  const mediaType = String(body.media_type ?? '').trim();
  const allowedMedia = ['image', 'audio', 'video', 'document'];
  if (!conversationId) return json({ error: 'Conversa não informada' }, 400);
  if (!message && !mediaUrl) return json({ error: 'Mensagem vazia' }, 400);
  if (mediaUrl && !allowedMedia.includes(mediaType)) return json({ error: 'Tipo de mídia não suportado' }, 400);
  if (message.length > 4096) return json({ error: 'Mensagem muito longa' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const { data: conv } = await supabase
    .from('service_conversations')
    .select('id, contact_id, contact_handle, last_inbound_at, last_outbound_at, attendance_state, return_at, funnel_stage')
    .eq('id', conversationId)
    .maybeSingle();
  if (!conv) return json({ error: 'Conversa não encontrada' }, 404);

  let phone = normalizeBrPhone(conv.contact_handle);
  if (!phone && conv.contact_id) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('phone_normalized')
      .eq('id', conv.contact_id)
      .maybeSingle();
    phone = contact?.phone_normalized ?? null;
  }
  if (!phone) return json({ error: 'Contato sem telefone de WhatsApp válido' }, 400);

  // Texto livre só pode ser enviado dentro da janela de atendimento da Meta.
  const lastInboundAt = conv.last_inbound_at ? Date.parse(conv.last_inbound_at) : 0;
  // A última barreira de opt-out vive no servidor. Uma resposta dentro da
  // janela iniciada pelo cliente permanece legítima; uma nova abordagem nossa
  // não pode depender apenas do bloqueio visual do painel.
  if (conv.contact_id) {
    const { data: optOutContact } = await supabase
      .from('contacts')
      .select('commercial_opt_out')
      .eq('id', conv.contact_id)
      .maybeSingle();
    const isCustomerReplyWindow = Boolean(lastInboundAt) && Date.now() - lastInboundAt <= 24 * 60 * 60 * 1000;
    if (optOutContact?.commercial_opt_out === true && (isCampaign || !isCustomerReplyWindow)) {
      return json({
        error: isCampaign
          ? 'Contato optou por não receber comunicações comerciais'
          : 'Este contato marcou que não deseja receber contato comercial. Remova o opt-out conscientemente antes de iniciar uma nova abordagem.',
        code: 'commercial_opt_out',
      }, 403);
    }
  } else if (isCampaign) {
    return json({ error: 'Conversa sem contato vinculado', code: 'missing_contact' }, 400);
  }

  if (!lastInboundAt || Date.now() - lastInboundAt > 24 * 60 * 60 * 1000) {
    return json({
      error: 'A janela de atendimento de 24 horas está encerrada. Use um template aprovado pela Meta para reiniciar a conversa.',
      code: 'template_required',
    }, 409);
  }

  const connector = getWhatsAppConnector();
  if (!connector.isConfigured) {
    return json({ error: 'Integração de WhatsApp ainda não configurada', code: 'not_configured' }, 503);
  }

  const { data: integration } = await supabase
    .from('whatsapp_integrations')
    .select('is_enabled, connection_status')
    .eq('instance_reference', connector.instanceReference)
    .maybeSingle();

  if (integration && integration.is_enabled === false) {
    return json({ error: 'Envio de WhatsApp está desativado' }, 409);
  }
  if (integration && ['disconnected', 'not_configured'].includes(integration.connection_status)) {
    return json({ error: 'WhatsApp desconectado — reconecte a integração' }, 409);
  }

  // F0-B — idempotência da campanha: o servidor é a autoridade do envio.
  // Reserva atômica do destinatário antes de qualquer escrita em messages ou
  // chamada ao provedor. Sem confirmação de resultado, a reserva NÃO retorna
  // automaticamente a 'pending', para evitar reenvio após timeout.
  const campaignId = String(body.campaign_id ?? '').trim();
  const recipientId = String(body.recipient_id ?? '').trim();
  if (isCampaign) {
    if (!campaignId || !recipientId) {
      return json({ error: 'Destinatário e campanha obrigatórios', code: 'campaign_recipient_required' }, 400);
    }
    const { data: liveCampaign, error: campaignError } = await supabase
      .from('crm_campaigns').select('status').eq('id', campaignId).maybeSingle();
    if (campaignError) return json({ error: 'Falha ao conferir campanha', code: 'campaign_lookup_failed' }, 500);
    if (!liveCampaign || !['prepared', 'sending'].includes(liveCampaign.status)) {
      return json({ error: 'Campanha não está autorizada para execução', code: 'campaign_not_active' }, 409);
    }
    const { data: recipient, error: readError } = await supabase
      .from('crm_campaign_recipients')
      .select('id, campaign_id, contact_id, conversation_id, rendered_message, status, delivery_mode')
      .eq('id', recipientId)
      .eq('campaign_id', campaignId)
      .maybeSingle();
    if (readError) return json({ error: 'Falha ao conferir destinatário da campanha', code: 'campaign_lookup_failed' }, 500);
    if (!recipient || recipient.contact_id !== conv.contact_id
      || recipient.conversation_id !== conversationId
      || String(recipient.rendered_message ?? '').trim() !== message
      || recipient.status !== 'pending' || recipient.delivery_mode !== 'api') {
      return json({ error: 'Destinatário não está pendente para este envio; atualize a campanha', code: 'campaign_recipient_not_pending' }, 409);
    }
    // status=failed + error_code=dispatch_unconfirmed é uma reserva fail-closed.
    // O schema existente não possui status 'processing'; preservar a constraint
    // atual evita migration e garante que reexecuções não alcancem o provedor.
    const { data: claimed, error: claimError } = await supabase
      .from('crm_campaign_recipients')
      .update({
        status: 'failed',
        error_code: 'dispatch_unconfirmed',
        error_message: 'Tentativa de envio iniciada. Conferir o histórico/provedor antes de qualquer reenvio.',
      })
      .eq('id', recipientId)
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .eq('delivery_mode', 'api')
      .select('id')
      .maybeSingle();
    if (claimError) return json({ error: 'Falha ao reservar destinatário', code: 'campaign_claim_failed' }, 500);
    if (!claimed) return json({ error: 'Destinatário já reservado ou processado', code: 'campaign_recipient_not_pending' }, 409);
  }

  const nowIso = new Date().toISOString();
  const preview = mediaUrl ? (message || `${mediaType === 'audio' ? 'Áudio' : mediaType === 'video' ? 'Vídeo' : mediaType === 'image' ? 'Imagem' : 'Documento'} enviado`) : message;
  const { data: pending, error: pendingErr } = await supabase
    .from('service_messages')
    .insert({
      conversation_id: conversationId,
      sender: 'agent',
      content: preview,
      is_ai_suggested: false,
      direction: 'outbound',
      message_type: mediaUrl ? mediaType : 'text',
      media_url: mediaUrl || null,
      media_mime_type: body.media_mime_type || null,
      media_filename: body.media_filename || null,
      media_caption: mediaUrl && message ? message : null,
      delivery_status: 'pending',
      // `source` possui CHECK ('mobile','crm','provider','legacy') — campanha usa 'crm'.
      source: 'crm',
      provider_name: connector.providerName,
      provider_instance_ref: connector.instanceReference,
    })
    .select('id')
    .single();
  if (pendingErr) {
    return json({ error: `Falha ao registrar mensagem: ${pendingErr.message}`, code: 'message_persist_failed' }, 500);
  }

  const result = mediaUrl
    ? await connector.sendMediaMessage(phone, {
        type: mediaType as 'image' | 'audio' | 'video' | 'document',
        url: mediaUrl, caption: message || undefined, filename: body.media_filename || undefined,
      })
    : await connector.sendTextMessage(phone, message);

  if (!result.ok) {
    await supabase
      .from('service_messages')
      .update({ delivery_status: 'failed', error_code: result.errorCode ?? 'unknown' })
      .eq('id', pending.id);
    if (isCampaign) {
      // Uma rejeição não prova ausência de envio no provedor em todos os casos.
      // Mantemos o destinatário bloqueado para reconciliação manual.
      await supabase.from('crm_campaign_recipients').update({
        error_message: `Provedor retornou erro: ${result.errorCode ?? 'send_failed'} — ${result.errorMessage ?? 'sem detalhes'}. Conferir antes de reprocessar.`,
        service_message_id: pending.id,
      }).eq('id', recipientId).eq('campaign_id', campaignId)
        .eq('status', 'failed').eq('error_code', 'dispatch_unconfirmed');
    }
    return json({ error: result.errorMessage ?? 'Falha ao enviar mensagem',
      code: isCampaign ? 'dispatch_unconfirmed' : (result.errorCode ?? 'send_failed') }, 502);
  }

  await supabase
    .from('service_messages')
    .update({
      delivery_status: 'sent',
      external_message_id: result.externalMessageId ?? null,
      provider_timestamp: nowIso,
    })
    .eq('id', pending.id);

  if (isCampaign) {
    // Campanha: confirmar o destinatário no SERVIDOR, antes de responder ao
    // navegador. Mesmo que a resposta HTTP se perca, novo clique não reenvia.
    const { data: confirmed, error: confirmError } = await supabase
      .from('crm_campaign_recipients')
      .update({
        status: 'sent',
        sent_at: nowIso,
        service_message_id: pending.id,
        external_message_id: result.externalMessageId ?? null,
        error_code: null,
        error_message: null,
      })
      .eq('id', recipientId).eq('campaign_id', campaignId)
      .eq('status', 'failed').eq('error_code', 'dispatch_unconfirmed')
      .select('id').maybeSingle();
    if (confirmError || !confirmed) {
      return json({
        error: 'Provedor aceitou o envio, mas confirmação da campanha requer reconciliação. Não reenviar.',
        code: 'dispatch_unconfirmed',
        message_id: pending.id,
      }, 503);
    }
    // Sem efeitos de atendimento (sem tarefas, return_at ou funil).
    return json({ ok: true, mode: 'campaign', recipient_id: recipientId,
      message_id: pending.id, external_message_id: result.externalMessageId ?? null });
  }

  const outboundEffects = await applyOutboundOperationalEffects(supabase, {
    conversation: conv,
    occurredAt: nowIso,
    preview,
    summaryText: message,
  });

  return json({
    ok: true,
    message_id: pending.id,
    external_message_id: result.externalMessageId ?? null,
    automatic_follow_up_scheduled: outboundEffects.automaticFollowUpScheduled,
    preserved_existing_obligation: outboundEffects.preservedExistingObligation,
  });
});
