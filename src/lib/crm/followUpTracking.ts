import { supabase } from '@/integrations/supabase/client';
import { CRM_EVENT_CODES } from '@/lib/crm/model';
import {
  buildFollowUpAttemptMetadata,
  computeFollowUpCycle,
  shouldRegisterFollowUpAttempt,
  type FollowUpAttemptCheckInput,
  type FollowUpCycleState,
  type FollowUpHistoryEvent,
} from '@/lib/crm/followUpCycle';

/**
 * F5.2.1 — leitura/gravação do ciclo de follow-up.
 * Sem migration: reutiliza `contact_history.event_metadata`.
 */

export async function loadFollowUpCycle(
  contactId: string,
  options: { lastInboundAt?: string | null } = {},
): Promise<FollowUpCycleState> {
  const { data } = await supabase
    .from('contact_history')
    .select('event_code, event_metadata, interaction_date, created_at')
    .eq('contact_id', contactId)
    .order('interaction_date', { ascending: false })
    .limit(200);

  return computeFollowUpCycle((data || []) as FollowUpHistoryEvent[], options);
}

export interface RegisterFollowUpAttemptInput extends FollowUpAttemptCheckInput {
  contactId: string;
  /** Prévia opcional da mensagem enviada, apenas para o histórico. */
  preview?: string | null;
}

/**
 * Registra a tentativa somente quando o envio é um follow-up real.
 * Retorna o novo estado do ciclo, ou o estado atual quando nada foi gravado.
 */
export async function registerFollowUpAttemptIfReal(
  input: RegisterFollowUpAttemptInput,
  now: Date = new Date(),
): Promise<FollowUpCycleState> {
  const current = await loadFollowUpCycle(input.contactId, { lastInboundAt: input.lastInboundAt });
  if (!shouldRegisterFollowUpAttempt(input, now)) return current;

  const at = now.toISOString();
  const attemptNumber = current.nextAttemptNumber;
  const metadata = buildFollowUpAttemptMetadata({
    attemptNumber,
    cycleStartedAt: current.cycleStartedAt ?? at,
  });

  const { error } = await supabase.from('contact_history').insert([{
    contact_id: input.contactId,
    event_type: 'whatsapp',
    interaction_type: 'mensagem',
    event_code: CRM_EVENT_CODES.FOLLOW_UP_COMPLETED,
    event_metadata: metadata,
    description: `🔁 Follow-up ${attemptNumber} de 3${input.preview ? ` · "${input.preview}"` : ''}`,
    interaction_date: at,
  });
  if (error) {
    console.error('Falha ao registrar tentativa de follow-up:', error);
    return current;
  }

  return {
    attemptCount: attemptNumber,
    nextAttemptNumber: attemptNumber + 1,
    limitReached: attemptNumber >= 3,
    cycleStartedAt: current.cycleStartedAt ?? at,
  };
}
