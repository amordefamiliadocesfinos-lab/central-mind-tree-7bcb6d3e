/** Indício de evento social; não altera prioridade, status ou obrigação. */
export type CrmLastMessage = { direction: string | null; message_type: string | null };

export function getCrmSocialEventReviewHint(message: CrmLastMessage | null): string | null {
  if (message?.direction !== 'inbound') return null;
  if (message.message_type === 'reaction') {
    return 'A última interação foi uma reação. Verifique se existe uma pergunta ou obrigação anterior sem resposta. Reações, isoladamente, não comprovam nova solicitação comercial.';
  }
  if (message.message_type === 'sticker') {
    return 'A última interação foi uma figurinha. Confira as mensagens anteriores: pode ser apenas confirmação social, mas não conclua o atendimento sem verificar pendências reais.';
  }
  return null;
}
