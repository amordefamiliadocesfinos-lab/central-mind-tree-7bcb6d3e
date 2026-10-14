import { supabase } from '@/integrations/supabase/client';
import { resolveCampaignContext } from './campaignContext';
import {
  CRM_CAMPAIGN_SALE_EVENT, CRM_CAMPAIGN_SALE_SOURCE,
  isCrmCampaignOrderTraceValid, summarizeCrmCampaignSales,
  type CampaignSaleOrder, type CampaignSaleRecipient, type CampaignSaleEvidence,
  type CampaignSaleSummary,
} from './campaignSales';

const db = supabase as any;

/**
 * Depois da venda unificada CRIADA, registra referência somente se houver
 * campanha enviada + inbound desta conversa + vínculo vivo com o Pedido.
 * Não há gravação de Pedido, estoque, dinheiro ou Resultado nesta função.
 */
export async function recordInboxCampaignSaleTrace(input: {
  contactId: string; conversationId: string | null; orderId: string;
}): Promise<'linked' | 'not_applicable' | 'already_linked'> {
  if (!input.conversationId || !input.orderId || !input.contactId) return 'not_applicable';
  const { data: conversation, error: conversationError } = await db
    .from('service_conversations').select('id,contact_id,last_inbound_at')
    .eq('id', input.conversationId).eq('contact_id', input.contactId).maybeSingle();
  if (conversationError) throw new Error('Falha na leitura da conversa de origem.');
  if (!conversation?.last_inbound_at) return 'not_applicable';

  const link = await resolveCampaignContext({
    contactId: input.contactId, conversationId: input.conversationId,
    lastInboundAt: conversation.last_inbound_at,
  });
  if (!link?.responded) return 'not_applicable';
  const { data: recipient, error: recipientError } = await db
    .from('crm_campaign_recipients')
    .select('id,campaign_id,contact_id,conversation_id,status,sent_at')
    .eq('id', link.recipientId).eq('campaign_id', link.campaignId)
    .eq('contact_id', input.contactId).eq('conversation_id', input.conversationId)
    .eq('status', 'sent').maybeSingle();
  if (recipientError) throw new Error('Falha na leitura do destinatário.');
  if (!recipient) return 'not_applicable';
  const { data: order, error: orderError } = await db.from('orders')
    .select('id,contact_id,order_number,created_at,deleted_at,sale_origin,status,payment_status,total_value')
    .eq('id', input.orderId).eq('contact_id', input.contactId).maybeSingle();
  if (orderError) throw new Error('Falha na leitura do pedido.');
  if (!order) return 'not_applicable';

  const event: CampaignSaleEvidence = {
    contact_id: input.contactId,
    event_metadata: {
      campaign_id: link.campaignId, recipient_id: link.recipientId,
      conversation_id: input.conversationId, order_id: order.id,
      source: CRM_CAMPAIGN_SALE_SOURCE,
      sent_at: recipient.sent_at, inbound_at: conversation.last_inbound_at,
    },
  };
  if (!isCrmCampaignOrderTraceValid({ campaignId: link.campaignId, recipient, order, event })) {
    return 'not_applicable';
  }
  // Deduplicação lógica: a chave de venda permanece a do Pedido original.
  const { data: prior, error: priorError } = await db.from('contact_history')
    .select('id,event_metadata').eq('contact_id', input.contactId)
    .eq('event_code', CRM_CAMPAIGN_SALE_EVENT)
    .contains('event_metadata', { order_id: order.id }).limit(20);
  if (priorError) throw new Error('Falha ao conferir vínculo anterior.');
  if ((prior ?? []).length) return 'already_linked';

  const { error } = await db.from('contact_history').insert({
    contact_id: input.contactId,
    event_type: 'campaign_sale_origin',
    interaction_type: 'campaign_sale_origin',
    event_code: CRM_CAMPAIGN_SALE_EVENT,
    description: 'Pedido registrado na Inbox após resposta a campanha; origem rastreada, causalidade não comprovada.',
    event_metadata: event.event_metadata,
    interaction_date: new Date().toISOString(),
  });
  if (error) throw new Error('Pedido registrado, mas falhou o vínculo de origem com a campanha.');
  return 'linked';
}

async function batched<T>(
  values: string[], query: (slice: string[]) => Promise<T[]>,
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < values.length; i += 80) {
    results.push(...await query(values.slice(i, i + 80)));
  }
  return results;
}

/** Consulta existente em somente leitura. Uma falha nunca vira número zero. */
export async function loadCrmCampaignSales(campaignId: string): Promise<CampaignSaleSummary> {
  const { data: recipientData, error: recipientsError } = await db
    .from('crm_campaign_recipients')
    .select('id,campaign_id,contact_id,conversation_id,status,sent_at')
    .eq('campaign_id', campaignId).eq('status', 'sent');
  if (recipientsError) throw new Error('Destinatários da campanha indisponíveis.');
  const recipients = (recipientData ?? []) as CampaignSaleRecipient[];
  const ids = [...new Set(recipients.map(r => r.contact_id))];
  if (!ids.length) return summarizeCrmCampaignSales(campaignId, [], [], []);
  const orders = await batched(ids, async chunk => {
    const { data, error } = await db.from('orders')
      .select('id,contact_id,order_number,created_at,deleted_at,sale_origin,status,payment_status,total_value')
      .in('contact_id', chunk).is('deleted_at', null).order('created_at', { ascending: false }).limit(1000);
    if (error || (data ?? []).length >= 1000) throw new Error('Consulta de pedidos incompleta. Refinar leitura antes de emitir indicadores.');
    return (data ?? []) as CampaignSaleOrder[];
  });
  const { data: events, error: eventError } = await db.from('contact_history')
    .select('contact_id,event_metadata').eq('event_code', CRM_CAMPAIGN_SALE_EVENT)
    .contains('event_metadata', { campaign_id: campaignId }).limit(1000);
  if (eventError || (events ?? []).length >= 1000) throw new Error('Consulta de vínculos incompleta ou indisponível.');
  return summarizeCrmCampaignSales(campaignId, recipients, orders, (events ?? []) as CampaignSaleEvidence[]);
}
