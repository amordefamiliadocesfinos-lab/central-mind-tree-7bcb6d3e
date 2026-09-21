import { supabase } from '@/integrations/supabase/client';
import { applyCanonicalAttendanceResult } from './attendance';
import { ingestExternalCrmFact, type ExternalFactIngestionResult } from './externalFact';
import { buildExternalFactApplication } from './externalFactResolution';
import type { CrmNewFact, CrmResultCode } from './canonical/types';

export type ExternalFactExecutionResult =
  | { status: 'ignored'; reason: string }
  | { status: 'invalid'; reason: string }
  | { status: 'unresolved'; reason: string }
  | {
      status: 'applied';
      contactId: string;
      conversationId: string;
      resultCode: CrmResultCode;
      materialization: Awaited<ReturnType<typeof applyCanonicalAttendanceResult>>;
    };

type ConversationRow = {
  id: string;
  contact_id: string | null;
  status: string | null;
  attendance_state: string | null;
  return_at: string | null;
  needs_reply: boolean | null;
};

async function resolveConversation(
  contactId: string,
  requestedConversationId?: string | null,
): Promise<ConversationRow | null> {
  const select = 'id, contact_id, status, attendance_state, return_at, needs_reply';

  if (requestedConversationId?.trim()) {
    const { data, error } = await supabase
      .from('service_conversations')
      .select(select)
      .eq('id', requestedConversationId.trim())
      .maybeSingle();

    if (error) throw error;
    if (!data || data.contact_id !== contactId) return null;
    return data as ConversationRow;
  }

  const { data, error } = await supabase
    .from('service_conversations')
    .select(select)
    .eq('contact_id', contactId)
    .order('last_message_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as ConversationRow | null) ?? null;
}

function passthroughIngestionFailure(
  ingestion: Exclude<ExternalFactIngestionResult, { status: 'accepted' }>,
): ExternalFactExecutionResult {
  return ingestion.status === 'ignored'
    ? { status: 'ignored', reason: ingestion.reason }
    : { status: 'invalid', reason: ingestion.reason };
}

/**
 * F5-B1b — executor controlado de fatos externos.
 *
 * Fluxo:
 * ingestão pura (B1a) → conversa determinística → motor canônico →
 * mesmo writer operacional usado pelo Resultado manual.
 *
 * Não existe produtor conectado nesta frente. Nenhuma persistência acontece
 * antes de o fato ser aceito e resolvido.
 */
export async function executeExternalCrmFact(input: CrmNewFact): Promise<ExternalFactExecutionResult> {
  const ingestion = ingestExternalCrmFact(input);
  if (ingestion.status !== 'accepted') return passthroughIngestionFailure(ingestion);

  const fact = ingestion.fact;
  const contactId = fact.contactId!;

  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('id, funnel_status, next_action_date')
    .eq('id', contactId)
    .maybeSingle();

  if (contactError) throw contactError;
  if (!contact) return { status: 'unresolved', reason: 'contact_not_found' };

  const conversation = await resolveConversation(contactId, fact.conversationId);
  if (!conversation) {
    return {
      status: 'unresolved',
      reason: fact.conversationId?.trim()
        ? 'conversation_not_found_or_contact_mismatch'
        : 'conversation_not_found',
    };
  }

  const plan = buildExternalFactApplication(fact, {
    currentStage: contact.funnel_status,
    currentNextActionDate: contact.next_action_date,
    currentReturnAt: conversation.return_at,
    conversationStatus: conversation.status,
    attendanceState: conversation.attendance_state,
    needsReply: conversation.needs_reply ?? false,
  });

  const materialization = await applyCanonicalAttendanceResult({
    contactId,
    conversationId: conversation.id,
    resultCode: plan.resultCode,
    scheduledFor: plan.scheduledFor,
  });

  return {
    status: 'applied',
    contactId,
    conversationId: conversation.id,
    resultCode: plan.resultCode,
    materialization,
  };
}
