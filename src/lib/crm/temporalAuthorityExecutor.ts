import { supabase } from '@/integrations/supabase/client';
import { syncCrmNextActionTask } from './nextAction';
import type { TemporalInvalidations } from './temporalAuthority';

export interface TemporalAuthorityExecutionInput {
  contactId: string;
  conversationId?: string | null;
  invalidations: TemporalInvalidations;
}

export interface TemporalAuthorityExecutionResult {
  returnAtInvalidated: boolean;
  nextActionInvalidated: boolean;
  crmNextActionTaskInvalidated: boolean;
  followUpCycleResetByBoundary: boolean;
  reactivationPreserved: boolean;
  nextActionRequiresReassessment: boolean;
}

export interface TemporalAuthorityPersistence {
  clearConversationReturn(conversationId: string, contactId: string): Promise<void>;
  clearContactNextAction(contactId: string): Promise<void>;
  clearCrmNextActionTask(contactId: string): Promise<void>;
}

export const supabaseTemporalAuthorityPersistence: TemporalAuthorityPersistence = {
  async clearConversationReturn(conversationId, contactId) {
    const { error } = await supabase
      .from('service_conversations')
      .update({ return_at: null })
      .eq('id', conversationId)
      .eq('contact_id', contactId);
    if (error) throw error;
  },

  async clearContactNextAction(contactId) {
    const { error } = await supabase
      .from('contacts')
      .update({
        next_action_text: null,
        next_action_date: null,
        next_contact_date: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId);
    if (error) throw error;
  },

  async clearCrmNextActionTask(contactId) {
    await syncCrmNextActionTask(contactId, { title: null, dueAt: null });
  },
};

/**
 * F4-B1 — traduz decisões semânticas da F4-A em efeitos persistentes granulares.
 *
 * Regras de segurança:
 * - return_at, intenção de próxima ação e tarefa crm_next_action são efeitos distintos;
 * - reavaliação NÃO equivale a exclusão: a próxima ação permanece até nova decisão canônica;
 * - follow-up não possui contador persistido para zerar: last_inbound_at é a fronteira do ciclo;
 * - crm_reactivation nunca é tocada por este executor.
 */
export async function executeTemporalAuthority(
  input: TemporalAuthorityExecutionInput,
  persistence: TemporalAuthorityPersistence = supabaseTemporalAuthorityPersistence,
): Promise<TemporalAuthorityExecutionResult> {
  const { contactId, conversationId, invalidations } = input;

  let returnAtInvalidated = false;
  let nextActionInvalidated = false;
  let crmNextActionTaskInvalidated = false;

  if (invalidations.invalidateReturnAt && conversationId) {
    await persistence.clearConversationReturn(conversationId, contactId);
    returnAtInvalidated = true;
  }

  if (invalidations.invalidateNextAction) {
    await persistence.clearContactNextAction(contactId);
    nextActionInvalidated = true;
  }

  if (invalidations.invalidateCrmNextActionTask) {
    await persistence.clearCrmNextActionTask(contactId);
    crmNextActionTaskInvalidated = true;
  }

  return {
    returnAtInvalidated,
    nextActionInvalidated,
    crmNextActionTaskInvalidated,
    followUpCycleResetByBoundary: invalidations.resetFollowUpCycle,
    reactivationPreserved: invalidations.preserveReactivation,
    nextActionRequiresReassessment: invalidations.reassessNextAction,
  };
}
