import {
  canCreateAutomaticFollowUpObligation,
  clearOfficialCrmNextAction,
  setOfficialCrmNextAction,
} from './official-next-action.ts';
import { refreshLiveContextAfterEvent } from './live-context.ts';

export type OutboundConversationSnapshot = {
  id: string;
  contact_id?: string | null;
  attendance_state?: string | null;
  return_at?: string | null;
  last_inbound_at?: string | null;
  last_outbound_at?: string | null;
  funnel_stage?: string | null;
};

const WAITING_STATES = new Set([
  'aguardando_cliente',
  'aguardando_resposta',
  'retornar_em',
  'awaiting_response',
  'waiting_customer',
]);

function normalizeState(value?: string | null) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

export function isRealFollowUpOutbound(
  conversation: OutboundConversationSnapshot,
  occurredAt: string,
): boolean {
  const occurredAtMs = Date.parse(occurredAt);
  const returnAt = conversation.return_at ? Date.parse(conversation.return_at) : Number.NaN;
  const lastInboundAt = conversation.last_inbound_at ? Date.parse(conversation.last_inbound_at) : Number.NaN;
  const lastOutboundAt = conversation.last_outbound_at ? Date.parse(conversation.last_outbound_at) : 0;
  if (Number.isNaN(occurredAtMs)) return false;
  return WAITING_STATES.has(normalizeState(conversation.attendance_state))
    && Number.isFinite(returnAt)
    && returnAt <= occurredAtMs
    && (!Number.isFinite(lastInboundAt) || lastInboundAt <= lastOutboundAt);
}

export async function applyOutboundOperationalEffects(
  supabase: any,
  input: {
    conversation: OutboundConversationSnapshot;
    occurredAt: string;
    preview: string;
    summaryText?: string | null;
  },
): Promise<{ automaticFollowUpScheduled: boolean | null; preservedExistingObligation: boolean }> {
  const { conversation } = input;
  const occurredAt = Number.isNaN(Date.parse(input.occurredAt))
    ? new Date().toISOString()
    : input.occurredAt;
  const preview = String(input.preview ?? '').slice(0, 100);

  const { error: conversationError } = await supabase
    .from('service_conversations')
    .update({
      last_message_at: occurredAt,
      last_outbound_at: occurredAt,
      last_message_preview: preview,
      needs_reply: false,
      unread_count: 0,
      attendance_state: 'aguardando_cliente',
      status: 'open',
      resolved_at: null,
    })
    .eq('id', conversation.id);
  if (conversationError) throw conversationError;

  if (!conversation.contact_id) {
    return { automaticFollowUpScheduled: null, preservedExistingObligation: false };
  }

  const [{ data: contact, error: contactError }, { data: pendingTask, error: taskError }] = await Promise.all([
    supabase
      .from('contacts')
      .select('funnel_status,next_action_text,next_action_date,next_contact_date')
      .eq('id', conversation.contact_id)
      .maybeSingle(),
    supabase
      .from('tasks')
      .select('id,title,scheduled_date,due_date')
      .eq('contact_id', conversation.contact_id)
      .eq('source', 'crm_next_action')
      .is('deleted_at', null)
      .neq('status', 'concluído')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (contactError) throw contactError;
  if (taskError) throw taskError;

  const currentStage = contact?.funnel_status ?? conversation.funnel_stage ?? 'novo_lead';
  const nextStage = currentStage === 'novo_lead' ? 'contato_realizado' : currentStage;
  if (nextStage !== currentStage) {
    const { error } = await supabase.from('contacts').update({
      funnel_status: nextStage,
      updated_at: occurredAt,
    }).eq('id', conversation.contact_id);
    if (error) throw error;
  }

  const { error: funnelError } = await supabase.from('service_conversations').update({
    funnel_stage: nextStage,
  }).eq('id', conversation.id);
  if (funnelError) throw funnelError;

  // F1/F2 — outbound executa a ação, mas Resultado é quem a conclui.
  // Portanto uma obrigação canônica já existente nunca é substituída por um
  // follow-up automático só porque uma mensagem foi enviada.
  const preservedExistingObligation = Boolean(
    contact?.next_action_text
    || contact?.next_action_date
    || contact?.next_contact_date
    || pendingTask?.id,
  );

  let automaticFollowUpScheduled: boolean | null = null;
  if (!preservedExistingObligation) {
    const currentSendIsRealFollowUp = isRealFollowUpOutbound(conversation, occurredAt);
    const canSchedule = await canCreateAutomaticFollowUpObligation(
      supabase,
      conversation.contact_id,
      conversation.last_inbound_at,
      currentSendIsRealFollowUp,
    );
    automaticFollowUpScheduled = canSchedule;

    if (canSchedule) {
      const returnAt = new Date(Date.parse(occurredAt) + 2 * 86400000);
      returnAt.setUTCHours(12, 0, 0, 0);
      await setOfficialCrmNextAction(supabase, {
        contactId: conversation.contact_id,
        title: 'Verificar resposta no WhatsApp',
        dueAt: returnAt.toISOString(),
        conversationId: conversation.id,
        taskTime: '09:00',
      });
    } else {
      await clearOfficialCrmNextAction(supabase, {
        contactId: conversation.contact_id,
        conversationId: conversation.id,
      });
    }
  } else {
    automaticFollowUpScheduled = false;
  }

  const summary = String(input.summaryText ?? '').trim();
  if (summary.length >= 24) {
    await refreshLiveContextAfterEvent(supabase, {
      contactId: conversation.contact_id,
      type: 'outbound',
      occurredAt,
      summary: `Mensagem relevante enviada: ${summary.slice(0, 240)}`,
    });
  } else {
    await refreshLiveContextAfterEvent(supabase, {
      contactId: conversation.contact_id,
      type: 'outbound',
      occurredAt,
    });
  }

  return { automaticFollowUpScheduled, preservedExistingObligation };
}
