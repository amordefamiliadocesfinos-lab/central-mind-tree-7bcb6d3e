/**
 * O contexto CRM ainda não contém saldo vivo por variante. Nunca transformar
 * pergunta pendente de disponibilidade em sugestão factual de estoque.
 */
export function requiresLiveStockForReply(messages: Array<{ direction?: string; content?: string | null }> | null | undefined): boolean {
  const inboundBlock: string[] = [];
  for (const message of [...(messages ?? [])].reverse()) {
    if (message?.direction === 'outbound') break;
    if (message?.direction === 'inbound') inboundBlock.push(String(message.content ?? ''));
  }
  const text = inboundBlock.join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /\b(estoque|disponibilidade|disponiveis?|pronta entrega|tem agora|tem hoje)\b/.test(text)
    || /\b(quais|qual|que)\s+(?:sabores?|trufas?|produtos?)\s+(?:voces?\s+)?(?:tem|ha|estao disponiveis)\b/.test(text);
}
