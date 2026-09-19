import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { normalizeBrPhone } from '../_shared/whatsapp/connector.ts';
import { getWhatsAppConnector } from '../_shared/whatsapp/meta-connector.ts';
import {
  canCreateAutomaticFollowUpObligation,
  clearOfficialCrmNextAction,
  setOfficialCrmNextAction,
} from '../_shared/crm/official-next-action.ts';
import { refreshLiveContextAfterEvent } from '../_shared/crm/live-context.ts';

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

  let body: { conversation_id?: string; message?: string; media_url?: string; media_type?: string; media_mime_type?: string; media_filename?: string; mode?: string; campaign_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
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
    return json({ error: result.errorMessage ?? 'Falha ao enviar mensagem', code: result.errorCode ?? 'send_failed' }, 502);
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
    // Campanha: nenhum efeito de atendimento (sem aguardando_cliente, return_at, próxima ação,
    // tarefa crm_next_action ou mudança de funil). Só o histórico da mensagem é preservado.
    return json({ ok: true, mode: 'campaign', message_id: pending.id, external_message_id: result.externalMessageId ?? null });
  }

  // O estado anterior ao envio determina se esta mensagem é uma tentativa real
  // de follow-up. Esta decisão precisa acontecer antes de sobrescrever os campos
  // temporais da conversa.
  const waitingStates = new Set(['aguardando_cliente', 'aguardando_resposta', 'retornar_em', 'awaiting_response', 'waiting_customer']);
  const normalizedAttendanceState = String(conv.attendance_state ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const previousReturnAt = conv.return_at ? Date.parse(conv.return_at) : Number.NaN;
  const previousLastInboundAt = conv.last_inbound_at ? Date.parse(conv.last_inbound_at) : Number.NaN;
  const previousLastOutboundAt = conv.last_outbound_at ? Date.parse(conv.last_outbound_at) : 0;
  const currentSendIsRealFollowUp = waitingStates.has(normalizedAttendanceState)
    && Number.isFinite(previousReturnAt)
    && previousReturnAt <= Date.now()
    && (!Number.isFinite(previousLastInboundAt) || previousLastInboundAt <= previousLastOutboundAt);

  await supabase
    .from('service_conversations')
    .update({
      last_message_at: nowIso,
      last_outbound_at: nowIso,
      last_message_preview: preview.slice(0, 100),
      needs_reply: false,
      unread_count: 0,
      attendance_state: 'aguardando_cliente',
    })
    .eq('id', conversationId);

  let automaticFollowUpScheduled: boolean | null = null;
  if (conv.contact_id) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('funnel_status')
      .eq('id', conv.contact_id)
      .maybeSingle();
    const currentStage = contact?.funnel_status ?? conv.funnel_stage ?? 'novo_lead';
    const nextStage = currentStage === 'novo_lead' ? 'contato_realizado' : currentStage;
    const returnAt = new Date(Date.now() + 2 * 86400000);
    returnAt.setUTCHours(12, 0, 0, 0);

    await supabase.from('contacts').update({
      funnel_status: nextStage,
      updated_at: nowIso,
    }).eq('id', conv.contact_id);
    await supabase.from('service_conversations').update({
      funnel_stage: nextStage,
    }).eq('id', conversationId);
    const canScheduleFollowUp = await canCreateAutomaticFollowUpObligation(
      supabase,
      conv.contact_id,
      conv.last_inbound_at,
      currentSendIsRealFollowUp,
    );
    automaticFollowUpScheduled = canScheduleFollowUp;
    if (canScheduleFollowUp) {
      await setOfficialCrmNextAction(supabase, {
        contactId: conv.contact_id,
        title: 'Verificar resposta no WhatsApp',
        dueAt: returnAt.toISOString(),
        conversationId,
        taskTime: '09:00',
      });
    } else {
      // Se o envio atual é o 3º follow-up real, ele já é considerado aqui,
      // mesmo antes de o frontend registrar o evento 3/3. A obrigação atual é
      // consumida e nenhuma 4ª tarefa/return_at pode nascer.
      await clearOfficialCrmNextAction(supabase, { contactId: conv.contact_id, conversationId });
    }
    if (message.length >= 24) {
      await refreshLiveContextAfterEvent(supabase, {
        contactId: conv.contact_id,
        type: 'outbound',
        occurredAt: nowIso,
        summary: `Mensagem relevante enviada: ${message.slice(0, 240)}`,
      });
    }
  }

  return json({
    ok: true,
    message_id: pending.id,
    external_message_id: result.externalMessageId ?? null,
    automatic_follow_up_scheduled: automaticFollowUpScheduled,
  });
});
