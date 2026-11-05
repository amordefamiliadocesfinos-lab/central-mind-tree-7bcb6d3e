/** Revisão social: orientação de leitura, nunca decisão automática sobre P0. */
export type CrmLastMessage = {
  direction: string | null;
  message_type: string | null;
  content?: string | null;
  created_at?: string | null;
};

const isSocial = (type: string | null) => type === 'reaction' || type === 'sticker';

/** Compatibilidade para consumidores anteriores. */
export function getCrmSocialEventReviewHint(message: CrmLastMessage | null): string | null {
  return getCrmSocialContextReviewHint(message ? [message] : []);
}

/**
 * Mensagens mais recentes primeiro. Examina somente o trecho posterior ao
 * último outbound, evitando classificar uma figurinha isoladamente quando
 * a pergunta comercial anterior ainda está sem resposta.
 *
 * Este método apenas sugere o gesto de revisão: não modifica needs_reply,
 * não declara "sem fato novo" e nunca resolve a conversa.
 */
export function getCrmSocialContextReviewHint(
  latestFirst: readonly CrmLastMessage[],
): string | null {
  if (!latestFirst.length || latestFirst[0].direction !== 'inbound'
    || !isSocial(latestFirst[0].message_type)) return null;

  const pendingInbound: CrmLastMessage[] = [];
  for (const message of latestFirst) {
    if (message.direction === 'outbound') break;
    if (message.direction === 'inbound') pendingInbound.push(message);
  }
  // A ausência de texto não autoriza concluir que a conversa inteira é social:
  // limite de consulta e anexos desconhecidos exigem conferência do histórico.
  const earlierNonSocial = pendingInbound.slice(1).some(message =>
    !isSocial(message.message_type) && message.message_type !== 'system');
  const type = latestFirst[0].message_type === 'sticker' ? 'figurinha' : 'reação';
  if (earlierNonSocial) {
    return `A última interação é uma ${type}, mas há mensagem anterior de outro tipo desde a última resposta. Leia toda a solicitação antes de decidir o Resultado; não descarte a prioridade.`;
  }
  return `A última interação é uma ${type} e as mensagens recebidas examinadas desde a última resposta são sociais. Confira o histórico completo e as obrigações oficiais; só o operador pode confirmar ausência de fato novo.`;
}
