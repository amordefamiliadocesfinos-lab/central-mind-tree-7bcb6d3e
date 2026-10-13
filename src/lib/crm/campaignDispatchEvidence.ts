/**
 * F0-C — Evidência de mensagem de campanha, estritamente somente leitura.
 * Nunca infere ausência de envio de um resultado HTTP perdido e NUNCA libera retry.
 * Vincula service_messages somente pelo ID registrado no destinatário e pelo
 * ID da conversa do mesmo recipient; não pesquisa mensagens parecidas por data.
 */
export interface CampaignDispatchRecipient {
  id: string;
  status: string;
  conversation_id: string | null;
  rendered_message: string | null;
  service_message_id?: string | null;
  external_message_id?: string | null;
  error_code?: string | null;
}

export interface CampaignDispatchMessage {
  id: string;
  conversation_id: string;
  source: string | null;
  direction: string | null;
  content: string | null;
  delivery_status: string | null;
  external_message_id: string | null;
  created_at: string | null;
  provider_name: string | null;
}

export type CampaignMessageLookup = 'not_requested' | 'loading' | 'found' | 'missing' | 'error';
export type CampaignDispatchEvidenceState =
  | 'not_applicable'
  | 'without_reference'
  | 'checking'
  | 'unavailable'
  | 'not_found'
  | 'mismatched'
  | 'pending_unconfirmed'
  | 'failed_unconfirmed'
  | 'sent_without_provider_id'
  | 'provider_accepted'
  | 'provider_delivered'
  | 'provider_read';

export interface CampaignDispatchEvidence {
  state: CampaignDispatchEvidenceState;
  message: string;
  /** Mostra o fato observado, não equivale a nova autorização de disparo. */
  providerStatus: string | null;
  providerMessageId: string | null;
  serviceMessageId: string | null;
  observedAt: string | null;
  /** A F0-C não promove recipient para 'sent' e não libera reenvio. */
  replayAuthorized: false;
}

export function assessCampaignDispatchEvidence(input: {
  recipient: CampaignDispatchRecipient;
  lookup: CampaignMessageLookup;
  message: CampaignDispatchMessage | null;
}): CampaignDispatchEvidence {
  const r = input.recipient;
  const base = {
    providerStatus: null,
    providerMessageId: null,
    serviceMessageId: r.service_message_id || null,
    observedAt: null,
    replayAuthorized: false as const,
  };
  const wrap = (state: CampaignDispatchEvidenceState, message: string): CampaignDispatchEvidence =>
    ({ ...base, state, message });
  if (r.status !== 'failed') return wrap('not_applicable', 'Destinatário não está em falha para conferência.');
  if (!r.service_message_id || !r.conversation_id) {
    return wrap('without_reference',
      'Não existe referência direta à mensagem nesta tentativa. Isso NÃO comprova que o WhatsApp deixou de enviar.');
  }
  if (input.lookup === 'not_requested' || input.lookup === 'loading') {
    return wrap('checking', 'Consultando o registro de mensagem vinculado, sem executar envio.');
  }
  if (input.lookup === 'error') {
    return wrap('unavailable', 'A consulta ao histórico falhou; não é possível concluir se ocorreu envio.');
  }
  if (input.lookup !== 'found' || !input.message) {
    return wrap('not_found', 'Mensagem vinculada não localizada no histórico acessível; ausência não comprova não envio.');
  }
  const msg = input.message;
  if (msg.id !== r.service_message_id || msg.conversation_id !== r.conversation_id
    || msg.direction !== 'outbound' || msg.source !== 'crm'
    || (r.rendered_message ?? '').trim() !== (msg.content ?? '').trim()
    || (r.external_message_id && r.external_message_id !== msg.external_message_id)) {
    return wrap('mismatched',
      'O registro encontrado não corresponde integralmente ao destinatário. Não associar a outro atendimento.');
  }
  const linked = {
    ...base,
    providerStatus: msg.delivery_status || null,
    providerMessageId: msg.external_message_id || null,
    observedAt: msg.created_at || null,
  };
  if (msg.delivery_status === 'read' && msg.external_message_id) return {
    ...linked, state: 'provider_read',
    message: 'O histórico registra leitura pelo destinatário. Confirmar discrepância da campanha antes de qualquer alteração.',
  };
  if (msg.delivery_status === 'delivered' && msg.external_message_id) return {
    ...linked, state: 'provider_delivered',
    message: 'O histórico registra entrega pelo provedor. O status da campanha continua exigindo conciliação separada.',
  };
  if (msg.delivery_status === 'sent' && msg.external_message_id) return {
    ...linked, state: 'provider_accepted',
    message: 'O histórico registra aceite de envio pelo provedor, sem comprovação de entrega ou leitura.',
  };
  if (['sent', 'delivered', 'read'].includes(msg.delivery_status ?? '')) return {
    ...linked, state: 'sent_without_provider_id',
    message: 'Há status de saída, mas sem identificador externo verificável. Exige conferência manual.',
  };
  if (msg.delivery_status === 'failed') return {
    ...linked, state: 'failed_unconfirmed',
    message: 'O histórico registra falha. Isso não comprova, isoladamente, ausência de entrega no provedor.',
  };
  return {
    ...linked, state: 'pending_unconfirmed',
    message: 'Há tentativa de mensagem registrada, mas o resultado de entrega continua indefinido.',
  };
}
