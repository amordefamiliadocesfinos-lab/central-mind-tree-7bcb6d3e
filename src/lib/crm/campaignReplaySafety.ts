/**
 * F0-B — segurança de reexecução da campanha.
 * Ausência de resposta da API NÃO é prova de que o provedor não enviou.
 * Somente erros ocorridos antes da tentativa de entrega são elegíveis a retry.
 */
export const CAMPAIGN_UNCONFIRMED_CODE = 'dispatch_unconfirmed';
const SAFE_PRE_DISPATCH_CODES = new Set([
  'campaign_lookup_failed',
  'campaign_claim_failed',
  'campaign_recipient_required',
  'missing_contact',
  'not_configured',
  'template_required',
  'window_closed',
]);

export function canSafelyRequeueCampaignRecipient(recipient: {
  status: string | null;
  error_code?: string | null;
  service_message_id?: string | null;
  external_message_id?: string | null;
}): boolean {
  return recipient.status === 'failed'
    && !recipient.service_message_id
    && !recipient.external_message_id
    && SAFE_PRE_DISPATCH_CODES.has(recipient.error_code ?? '');
}

export function requiresCampaignSendReconciliation(recipient: {
  status: string | null;
  error_code?: string | null;
  service_message_id?: string | null;
  external_message_id?: string | null;
}): boolean {
  return recipient.status === 'failed' && !canSafelyRequeueCampaignRecipient(recipient);
}

/**
 * Resposta observável da Edge Function efetivamente ativa, sob sessão autenticada.
 * Um commit sincronizado no Lovable NÃO comprova que o runtime implementa v2.
 */
export function isCampaignDispatchProtocolV2(response: unknown): boolean {
  if (!response || typeof response !== 'object') return false;
  const value = response as Record<string, unknown>;
  return value.ok === true && value.campaign_dispatch_protocol === 2;
}
