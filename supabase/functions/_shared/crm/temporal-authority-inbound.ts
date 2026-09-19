import {
  classifyTemporalFact,
  getTemporalInvalidations,
  type TemporalSchedule,
} from './temporal-authority.ts';

const INBOUND_SCHEDULES: TemporalSchedule[] = [
  { kind: 'return_at', dependency: 'waiting_customer' },
  { kind: 'next_action', dependency: 'waiting_customer' },
  { kind: 'crm_next_action', dependency: 'waiting_customer' },
  { kind: 'follow_up_cycle', dependency: 'conversation_context' },
  { kind: 'crm_reactivation', dependency: 'independent' },
];

/**
 * F4-B2 — conecta inbound real ao núcleo F4-A sem duplicar regra semântica.
 *
 * O adaptador Edge aplica apenas efeitos físicos autorizados para este evento.
 * Reassessment de Próxima Ação não equivale a exclusão; portanto contato/tarefa
 * permanecem intactos. O follow-up é reiniciado pela própria fronteira
 * last_inbound_at já persistida pelo webhook. crm_reactivation nunca é tocada.
 */
export async function applyInboundTemporalAuthority(
  supabase: any,
  input: { contactId: string | null; conversationId: string; occurredAt: string },
) {
  const fact = classifyTemporalFact({ direction: 'inbound', occurredAt: input.occurredAt });
  const invalidations = getTemporalInvalidations(fact, INBOUND_SCHEDULES);

  let returnAtInvalidated = false;
  if (invalidations.invalidateReturnAt && input.contactId) {
    const { error } = await supabase
      .from('service_conversations')
      .update({ return_at: null })
      .eq('id', input.conversationId)
      .eq('contact_id', input.contactId);
    if (error) throw error;
    returnAtInvalidated = true;
  }

  return {
    returnAtInvalidated,
    nextActionRequiresReassessment: invalidations.reassessNextAction,
    followUpCycleResetByBoundary: invalidations.resetFollowUpCycle,
    reactivationPreserved: invalidations.preserveReactivation,
  };
}
