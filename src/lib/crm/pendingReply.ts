/**
 * CRM C1 — mensagem pendente é um fato da conversa, não uma propriedade do
 * Resultado comercial. O Resultado não prova que o operador respondeu.
 * Datas da conversa prevalecem sobre flags legadas, sem simular envio.
 */
export interface CrmReplyTimeline {
  needsReply: boolean;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
}

function parsedAt(raw: string | null): number | null {
  if (!raw) return null;
  const value = Date.parse(raw);
  return Number.isFinite(value) ? value : null;
}

export function hasCrmUnansweredInbound(input: CrmReplyTimeline): boolean {
  const inbound = parsedAt(input.lastInboundAt);
  const outbound = parsedAt(input.lastOutboundAt);
  if (inbound === null) {
    // Sem data confiável, não descartar uma pendência já marcada.
    return input.needsReply;
  }
  if (outbound === null) return true;
  if (inbound > outbound) return true;
  if (inbound < outbound) return false;
  // Eventos com a mesma resolução temporal: evitar apagar um pending explícito.
  return input.needsReply;
}

export function resolveCrmCanonicalReplyState(input: {
  timeline: CrmReplyTimeline;
  resolvesConversation: boolean;
  waitingForCustomer: boolean;
  hasReturnAt: boolean;
}): { needsReply: boolean; attendanceState: 'concluido' | 'em_atendimento' | 'aguardando_cliente' | 'retornar_em' } {
  if (input.resolvesConversation) return { needsReply: false, attendanceState: 'concluido' };
  const needsReply = hasCrmUnansweredInbound(input.timeline);
  return {
    needsReply,
    attendanceState: needsReply ? 'em_atendimento'
      : input.waitingForCustomer ? 'aguardando_cliente'
      : input.hasReturnAt ? 'retornar_em' : 'em_atendimento',
  };
}
