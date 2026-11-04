/**
 * A mensagem é armazenada no histórico, mas só um evento novo e conversacional
 * pode mudar o estado operacional da Inbox. Usado pelos webhooks Meta e Z-API.
 */
export interface CrmWebhookConversationSnapshot {
  last_message_at?: string | null;
  last_inbound_at?: string | null;
  last_outbound_at?: string | null;
  status?: string | null;
  resolved_at?: string | null;
}

export type CrmWebhookDecisionReason =
  | 'new_message' | 'reaction' | 'duplicate' | 'invalid_timestamp' | 'stale_message';

function ms(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function decideCrmWebhookConversationEffect(input: {
  direction: 'inbound' | 'outbound' | 'unknown';
  messageType?: string | null;
  occurredAt: string | null | undefined;
  duplicateMessage?: boolean;
  snapshot: CrmWebhookConversationSnapshot;
}): { apply: boolean; reason: CrmWebhookDecisionReason } {
  if (input.duplicateMessage) return { apply: false, reason: 'duplicate' };
  if (input.messageType?.toLowerCase() === 'reaction') return { apply: false, reason: 'reaction' };
  const eventAt = ms(input.occurredAt);
  if (eventAt === null) return { apply: false, reason: 'invalid_timestamp' };
  const snapshot = input.snapshot;
  const latestMessageAt = Math.max(
    ms(snapshot.last_message_at) ?? 0,
    ms(snapshot.last_inbound_at) ?? 0,
    ms(snapshot.last_outbound_at) ?? 0,
  );
  // Aceita dois eventos legítimos no mesmo segundo (resolução típica da Meta);
  // o ID de mensagem/receipt elimina repetições da mesma mensagem.
  if (eventAt < latestMessageAt) return { apply: false, reason: 'stale_message' };
  const resolvedAt = ms(snapshot.resolved_at);
  if (snapshot.status === 'resolved' && resolvedAt !== null && eventAt <= resolvedAt) {
    return { apply: false, reason: 'stale_message' };
  }
  return { apply: true, reason: 'new_message' };
}

/**
 * Confronto otimista: se Resultado, outra mensagem ou Concluir alterou o estado
 * após a leitura, o webhook não pode sobrescrever essa transição.
 */
export function guardCrmWebhookConversationMutation(query: any, snapshot: CrmWebhookConversationSnapshot): any {
  let guarded = query;
  for (const [column, value] of [
    ['last_message_at', snapshot.last_message_at],
    ['last_inbound_at', snapshot.last_inbound_at],
    ['last_outbound_at', snapshot.last_outbound_at],
    ['resolved_at', snapshot.resolved_at],
    ['status', snapshot.status],
  ] as const) {
    guarded = value == null ? guarded.is(column, null) : guarded.eq(column, value);
  }
  return guarded;
}
