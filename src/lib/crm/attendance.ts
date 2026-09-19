import { supabase } from '@/integrations/supabase/client';
import { clearCrmNextAction, setCrmNextAction, syncCrmNextActionTask } from '@/lib/crm/nextAction';
import { refreshCrmLiveContext } from '@/lib/crm/liveContext';
import { CRM_EVENT_CODES, normalizeCrmStage } from '@/lib/crm/model';
import { isQueueShadowObservationEnabled, observeAttendanceOutcomeShadow } from '@/lib/crm/canonical/queueShadowObservation';
import { getCanonicalNextAction } from '@/lib/crm/canonical/nextActions';
import { getCanonicalResult } from '@/lib/crm/canonical/results';
import { getCrmTransition } from '@/lib/crm/canonical/transitions';
import { resolveFunnelStageFromCanonicalResult } from '@/lib/crm/canonical/funnelProgression';
import { shouldAwaitCustomerAfterCanonicalResult } from '@/lib/crm/canonical/operationalResponsibility';
import { canSetReturnAt } from '@/lib/crm/canonical/temporal';
import { classifyTemporalFact, getTemporalInvalidations, type TemporalSchedule } from '@/lib/crm/temporalAuthority';
import type { CrmResultCode } from '@/lib/crm/canonical/types';

export type AttendanceOutcome =
  | 'awaiting_response' | 'proposal_sent' | 'negotiation' | 'sale_closed'
  | 'post_sale_done' | 'client_replied' | 'invalid_phone' | 'waiting_internal_quote'
  | 'no_interest' | 'record_only';

export const ATTENDANCE_OUTCOMES: Array<{ key: AttendanceOutcome; label: string }> = [
  { key: 'awaiting_response', label: 'Aguardando resposta' }, { key: 'proposal_sent', label: 'Proposta enviada' },
  { key: 'negotiation', label: 'Em negociação' }, { key: 'client_replied', label: 'Cliente respondeu' },
  { key: 'waiting_internal_quote', label: 'Aguardando orçamento interno' }, { key: 'sale_closed', label: 'Venda fechada' },
  { key: 'post_sale_done', label: 'Pós-venda realizado' }, { key: 'invalid_phone', label: 'Telefone inválido' },
  { key: 'no_interest', label: 'Sem interesse' }, { key: 'record_only', label: 'Apenas registrar' },
];

export const ATTENDANCE_STATE_LABELS: Record<string, string> = {
  responder: 'Responder', em_atendimento: 'Em atendimento', aguardando_cliente: 'Aguardando resposta',
  retornar_em: 'Retomar emâ€¦', concluido: 'Concluído', resolvido: 'Concluído',
};

const CONFIG: Record<AttendanceOutcome, {
  label: string; stage?: string; action?: string | null; days?: number;
  attendanceState: 'aguardando_cliente' | 'retornar_em' | 'concluido' | 'em_atendimento';
  eventCode: string; resolved?: boolean; conversationReturn?: boolean;
}> = {
  awaiting_response: { label: 'Atendimento realizado â€” aguardando resposta', stage: 'contato_realizado', action: 'Verificar resposta do cliente', days: 2, attendanceState: 'aguardando_cliente', eventCode: CRM_EVENT_CODES.CONTACT_ATTEMPTED, conversationReturn: true },
  proposal_sent: { label: 'Proposta enviada', stage: 'proposta_enviada', action: 'Fazer follow-up da proposta', days: 2, attendanceState: 'aguardando_cliente', eventCode: CRM_EVENT_CODES.PROPOSAL_SENT, conversationReturn: true },
  negotiation: { label: 'Cliente em negociação', stage: 'negociacao', action: 'Retomar negociação', days: 1, attendanceState: 'aguardando_cliente', eventCode: CRM_EVENT_CODES.NEGOTIATION_STARTED, conversationReturn: true },
  sale_closed: { label: 'Venda fechada', stage: 'fechado', action: 'Realizar pós-venda', days: 3, attendanceState: 'concluido', eventCode: CRM_EVENT_CODES.SALE_WON, resolved: true },
  post_sale_done: { label: 'Pós-venda realizado', stage: 'cadencia', action: 'Reativar relacionamento com o cliente', days: 30, attendanceState: 'concluido', eventCode: CRM_EVENT_CODES.POST_SALE_COMPLETED, resolved: true },
  client_replied: { label: 'Cliente respondeu', stage: 'contato_realizado', action: 'Definir próximo passo comercial', days: 1, attendanceState: 'em_atendimento', eventCode: CRM_EVENT_CODES.CUSTOMER_REPLIED },
  invalid_phone: { label: 'Telefone inválido ou ausente', action: 'Corrigir telefone do contato', days: 1, attendanceState: 'retornar_em', eventCode: CRM_EVENT_CODES.CONTACT_ATTEMPTED },
  waiting_internal_quote: { label: 'Aguardando orçamento interno', stage: 'contato_realizado', action: 'Concluir orçamento interno', days: 1, attendanceState: 'retornar_em', eventCode: CRM_EVENT_CODES.FOLLOW_UP_SCHEDULED },
  no_interest: { label: 'Sem interesse', stage: 'perdido', action: null, attendanceState: 'concluido', eventCode: CRM_EVENT_CODES.SALE_LOST, resolved: true },
  record_only: { label: 'Atendimento registrado', action: null, attendanceState: 'concluido', eventCode: CRM_EVENT_CODES.CONTACT_ATTEMPTED, resolved: true },
};

function dueInDays(days?: number) {
  if (days == null) return null;
  const due = new Date(); due.setDate(due.getDate() + days); due.setHours(9, 0, 0, 0);
  return due.toISOString();
}

function scheduledDateAt(dateOrDateTime?: string | null) {
  if (!dateOrDateTime) return null;
  // Uma data sem horário representa um compromisso acionável naquele dia,
  // não um horário oculto às 09:00. O horário só é respeitado quando foi
  // informado explicitamente pelo operador.
  const target = new Date(dateOrDateTime.includes('T')
    ? dateOrDateTime
    : `${dateOrDateTime}T00:00:00`);
  if (Number.isNaN(target.getTime())) throw new Error('Data inválida para a próxima ação');
  return target.toISOString();
}

/**
 * Writer operacional da Inbox. A decisão pertence ao motor canônico; esta
 * função só traduz a decisão para as estruturas já existentes do CRM.
 */
export async function applyCanonicalAttendanceResult(input: {
  contactId: string;
  conversationId: string;
  resultCode: CrmResultCode;
  scheduledFor?: string | null;
}) {
  const now = new Date().toISOString();
  const canonicalResult = getCanonicalResult(input.resultCode);
  if (!canonicalResult) throw new Error('Resultado canônico inválido');

  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('funnel_status, next_action_text, next_action_date, commercial_opt_out')
    .eq('id', input.contactId)
    .maybeSingle();
  if (contactError || !contact) throw contactError || new Error('Contato não encontrado');

  const { data: conversation, error: conversationError } = await supabase
    .from('service_conversations')
    .select('status, attendance_state, return_at, needs_reply')
    .eq('id', input.conversationId)
    .eq('contact_id', input.contactId)
    .maybeSingle();
  if (conversationError || !conversation) throw conversationError || new Error('Conversa não encontrada para este contato');

  // O Resultado canônico substitui a programação dependente anterior. A F4-A
  // decide isso antes de qualquer escrita; a materialização continua no writer
  // único abaixo, sem executar uma limpeza separada depois do novo Resultado.
  const previousTemporalSnapshot = {
    returnAt: conversation.return_at,
    nextActionText: contact.next_action_text,
    nextActionAt: contact.next_action_date,
  };
  const temporalSchedules: TemporalSchedule[] = [];
  if (previousTemporalSnapshot.returnAt) {
    temporalSchedules.push({
      kind: 'return_at',
      dependency: 'conversation_context',
      scheduledAt: previousTemporalSnapshot.returnAt,
    });
  }
  if (previousTemporalSnapshot.nextActionText || previousTemporalSnapshot.nextActionAt) {
    temporalSchedules.push({
      kind: 'next_action',
      dependency: 'conversation_context',
      scheduledAt: previousTemporalSnapshot.nextActionAt,
    });
  }
  const temporalInvalidations = getTemporalInvalidations(
    classifyTemporalFact({ isCanonicalResult: true, occurredAt: now }),
    temporalSchedules,
  );

  const scheduledAt = scheduledDateAt(input.scheduledFor);
  const decision = getCrmTransition({
    result: input.resultCode,
    currentStage: normalizeCrmStage(contact.funnel_status),
    // A representação legada armazena o texto, não o código canônico.
    // Não inferimos código por texto: a decisão é tomada pelo resultado atual.
    currentNextAction: null,
    currentNextActionDate: contact.next_action_date,
    currentReturnAt: conversation.return_at,
    conversationStatus: conversation.status,
    attendanceState: conversation.attendance_state,
    needsReply: conversation.needs_reply ?? false,
    operationalContext: {
      hasLegitimateFutureReason: Boolean(scheduledAt),
      hasConcreteReturnMoment: Boolean(scheduledAt),
    },
  });

  if (decision.temporal.required && !scheduledAt) {
    throw new Error('Este resultado exige uma data de retorno combinada');
  }

  const nextAction = getCanonicalNextAction(decision.nextAction.value);
  const shouldSchedule = Boolean(nextAction?.canBeFuture && scheduledAt);
  const returnAt = canSetReturnAt(decision.nextAction.value, shouldSchedule ? scheduledAt : null) ? scheduledAt : null;
  const stageResolution = resolveFunnelStageFromCanonicalResult({
    result: input.resultCode,
    currentStage: contact.funnel_status,
    decision,
    hasLegitimateFutureReturn: Boolean(returnAt),
  });

  if (stageResolution.action === 'MOVE' || input.resultCode === 'CRM-RES-033') {
    const { error } = await supabase.from('contacts').update({
      ...(stageResolution.action === 'MOVE' ? { funnel_status: stageResolution.nextStage } : {}),
      ...(input.resultCode === 'CRM-RES-033' ? { commercial_opt_out: true } : {}),
      updated_at: now,
    }).eq('id', input.contactId);
    if (error) throw error;
  }

  if (nextAction && shouldSchedule && scheduledAt) {
    await setCrmNextAction({
      contactId: input.contactId,
      title: nextAction.label,
      dueAt: scheduledAt,
      conversationId: input.conversationId,
      syncConversationReturn: Boolean(returnAt),
    });
  } else if (nextAction) {
    const { error } = await supabase.from('contacts').update({
      next_action_text: nextAction.label,
      next_action_date: null,
      next_contact_date: null,
      updated_at: now,
    }).eq('id', input.contactId);
    if (error) throw error;
    await syncCrmNextActionTask(input.contactId, { title: null, dueAt: null });
  } else {
    await clearCrmNextAction(input.contactId);
  }

  const resolvesConversation = ['OUT_OF_ACTIVE_COMMERCIAL_QUEUE', 'CONTACT_RESTRICTED'].includes(decision.desiredOperationalState);
  // A responsabilidade operacional é declarada por Resultado. Uma ação
  // imediata ainda mantém a conversa na atenção; retorno já programado só
  // devolve a conversa à fila quando realmente vencer.
  const waitingForCustomer = shouldAwaitCustomerAfterCanonicalResult({
    resultCode: input.resultCode,
    nextAction,
    nextActionScheduled: shouldSchedule,
  });
  const attendanceState = resolvesConversation
    ? 'concluido'
    : waitingForCustomer
      ? 'aguardando_cliente'
      : returnAt
        ? 'retornar_em'
        : 'em_atendimento';
  const { error: conversationUpdateError } = await supabase.from('service_conversations').update({
    attendance_state: attendanceState,
    status: resolvesConversation ? 'resolved' : 'open',
    resolved_at: resolvesConversation ? now : null,
    needs_reply: false,
    unread_count: 0,
    return_at: returnAt,
  }).eq('id', input.conversationId);
  if (conversationUpdateError) throw conversationUpdateError;

  const historyRows: { contact_id: string; description: string; [key: string]: unknown }[] = [{
    contact_id: input.contactId,
    event_type: 'contact',
    interaction_type: 'contact',
    event_code: CRM_EVENT_CODES.CONTACT_ATTEMPTED,
    event_metadata: {
      source: 'inbox_canonical_result',
      result_code: input.resultCode,
      next_action_code: decision.nextAction.value,
      next_action_date: shouldSchedule ? scheduledAt : null,
      return_at: returnAt,
      operational_state: decision.desiredOperationalState,
      handoff_required: decision.handoff.required,
      ...(previousTemporalSnapshot.returnAt ? { previous_return_at: previousTemporalSnapshot.returnAt } : {}),
      ...(temporalInvalidations.reassessNextAction ? { temporal_reassessment: true } : {}),
    },
    description: `Resultado: ${canonicalResult.label}`,
    interaction_date: now,
  }];
  if (stageResolution.action === 'MOVE') {
    historyRows.push({
      contact_id: input.contactId,
      event_type: 'stage_change',
      interaction_type: 'sistema',
      event_code: CRM_EVENT_CODES.STAGE_CHANGED,
      event_metadata: {
        source: 'inbox_canonical_result',
        result_code: input.resultCode,
        old_stage: stageResolution.previousStage,
        new_stage: stageResolution.nextStage,
      },
      description: `Movido de "${stageResolution.previousStage}" para "${stageResolution.nextStage}" pelo resultado: ${canonicalResult.label}`,
      interaction_date: now,
    });
  }
  const { error: historyError } = await supabase.from('contact_history').insert(historyRows);
  if (historyError) throw historyError;

  refreshCrmLiveContext({
    contactId: input.contactId,
    type: 'result',
    occurredAt: new Date().toISOString(),
    summary: `Resultado registrado: ${canonicalResult.label}.`,
  });

  return {
    label: canonicalResult.label,
    decision,
    stage: stageResolution,
    nextActionLabel: nextAction?.label ?? null,
    nextActionDate: shouldSchedule ? scheduledAt : null,
    returnAt,
    handoffPending: decision.handoff.required,
    conversationResolved: resolvesConversation,
  };
}

export async function applyAttendanceOutcome(input: {
  contactId: string;
  conversationId?: string | null;
  outcome: AttendanceOutcome;
  saleAlreadyRecorded?: boolean;
  observationSource?: 'queue';
}) {
  const now = new Date().toISOString();
  const config = CONFIG[input.outcome];
  const { data: contact, error: contactError } = await supabase.from('contacts').select('funnel_status').eq('id', input.contactId).maybeSingle();
  if (contactError || !contact) throw contactError || new Error('Contato não encontrado');

  const currentStage = normalizeCrmStage(contact.funnel_status);
  const requestedStage = config.stage ? normalizeCrmStage(config.stage) : currentStage;
  const nextStage = requestedStage === 'contato_realizado' && ['novo_lead', 'cadencia'].includes(currentStage) ? 'contato_realizado' : requestedStage;
  const returnAt = dueInDays(config.days);
  const nextActionDate = config.action && returnAt ? returnAt : null;
  // PO-2: stage and temporal intent are available. The Shadow runs only for the
  // queue, behind an opt-in development flag, before the first operational write.
  observeAttendanceOutcomeShadow({
    source: input.observationSource ?? 'inbox',
    legacyResult: input.outcome,
    currentFunnelStatus: currentStage,
    currentNextActionText: null,
    currentNextActionDate: null,
    legacyBehavior: {
      stage: nextStage,
      nextActionText: config.action ?? null,
      nextActionDate,
      returnAt: config.conversationReturn ? returnAt : null,
      // Conversation and handoff are intentionally absent at PO-2: CONFIG only
      // describes an intent and no physical conversation has been selected yet.
    },
  }, {
    enabled: isQueueShadowObservationEnabled(import.meta.env.DEV, import.meta.env.VITE_CRM_SHADOW_QUEUE_OBSERVATION),
  });
  const { error: updateError } = await supabase.from('contacts').update({ ultimo_contato: now.slice(0, 10), funnel_status: nextStage, updated_at: now }).eq('id', input.contactId);
  if (updateError) throw updateError;

  if (!(input.outcome === 'sale_closed' && input.saleAlreadyRecorded)) {
    const { error: historyError } = await supabase.from('contact_history').insert({
      contact_id: input.contactId, event_type: 'contact', interaction_type: 'contact', event_code: config.eventCode,
      event_metadata: { source: 'unified_inbox', outcome: input.outcome, next_stage: nextStage, return_at: returnAt }, description: config.label, interaction_date: now,
    });
    if (historyError) throw historyError;
  }

  let conversationId = input.conversationId ?? null;
  if (!conversationId) {
    const { data } = await supabase.from('service_conversations').select('id').eq('contact_id', input.contactId).order('last_message_at', { ascending: false }).limit(1).maybeSingle();
    conversationId = data?.id ?? null;
  }

  if (config.action && returnAt) {
    await setCrmNextAction({ contactId: input.contactId, title: config.action, dueAt: returnAt, conversationId, syncConversationReturn: config.conversationReturn });
  } else {
    await clearCrmNextAction(input.contactId);
  }

  if (conversationId) {
    const { error } = await supabase.from('service_conversations').update({
      attendance_state: config.attendanceState, status: config.resolved ? 'resolved' : 'open', resolved_at: config.resolved ? now : null,
      needs_reply: false, unread_count: 0, ...(config.conversationReturn ? {} : { return_at: null }), funnel_stage: nextStage,
    }).eq('id', conversationId);
    if (error) throw error;
  }
  refreshCrmLiveContext({
    contactId: input.contactId,
    type: 'result',
    occurredAt: new Date().toISOString(),
    summary: `Resultado operacional registrado: ${config.label}.`,
  });
  return { label: config.label, nextStage, returnAt, attendanceState: config.attendanceState };
}

export async function snoozeAttendance(input: { contactId: string; conversationId?: string | null; when: number | string }) {
  const target = typeof input.when === 'number' ? new Date() : new Date(`${input.when}T09:00:00`);
  if (typeof input.when === 'number') { target.setDate(target.getDate() + input.when); target.setHours(9, 0, 0, 0); }
  if (Number.isNaN(target.getTime())) throw new Error('Data inválida');
  const returnAt = target.toISOString();
  await setCrmNextAction({ contactId: input.contactId, title: 'Retomar atendimento', dueAt: returnAt, conversationId: input.conversationId, syncConversationReturn: true });
  if (input.conversationId) {
    const { error } = await supabase.from('service_conversations').update({ attendance_state: 'retornar_em', return_at: returnAt, needs_reply: false }).eq('id', input.conversationId);
    if (error) throw error;
  }
  const { error: historyError } = await supabase.from('contact_history').insert({
    contact_id: input.contactId, event_type: 'follow_up', interaction_type: 'follow_up', event_code: CRM_EVENT_CODES.FOLLOW_UP_SCHEDULED,
    event_metadata: { source: 'unified_inbox', return_at: returnAt }, description: `Atendimento adiado para ${target.toLocaleString('pt-BR')}`, interaction_date: new Date().toISOString(),
  });
  if (historyError) throw historyError;
  refreshCrmLiveContext({
    contactId: input.contactId,
    type: 'next_action',
    occurredAt: new Date().toISOString(),
    summary: 'Próxima ação de atendimento reagendada.',
  });
  return returnAt;
}
