import type { CampaignDispatchEvidence, CampaignDispatchRecipient } from './campaignDispatchEvidence';

/**
 * F0-D — validação de apresentação; NÃO substitui verificação/RPC no servidor.
 * Nunca habilita reenvio ou promove um recipient por conta própria.
 */
export function canOfferCrmCampaignFormalReconciliation(input: {
  isAdmin: boolean;
  recipient: CampaignDispatchRecipient;
  evidence: CampaignDispatchEvidence;
}): boolean {
  const { isAdmin, recipient, evidence } = input;
  const eligible = ['provider_accepted', 'provider_delivered', 'provider_read'].includes(evidence.state);
  return isAdmin
    && recipient.status === 'failed'
    && eligible
    && Boolean(recipient.service_message_id)
    && recipient.service_message_id === evidence.serviceMessageId
    && Boolean(recipient.conversation_id)
    && Boolean(evidence.providerMessageId?.trim())
    && (!recipient.external_message_id || recipient.external_message_id === evidence.providerMessageId)
    && evidence.replayAuthorized === false;
}
