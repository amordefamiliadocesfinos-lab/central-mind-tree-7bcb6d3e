/**
 * F5-C — Relaciona um Pedido à campanha apenas por vínculo explícito
 * gravado no próprio atendimento de Venda do CRM.
 *
 * Não transforma coincidência temporal, resposta, contato ou status Pago
 * em atribuição causal. O evento documenta proveniência operacional.
 */
export const CRM_CAMPAIGN_SALE_EVENT = 'crm_campaign_order_link';
export const CRM_CAMPAIGN_SALE_SOURCE = 'crm_inbox_campaign_response_v1';
export const CRM_CAMPAIGN_SALE_WINDOW_DAYS = 30;

export interface CampaignSaleRecipient {
  id: string;
  campaign_id: string;
  contact_id: string;
  conversation_id: string | null;
  status: string;
  sent_at: string | null;
}

export interface CampaignSaleOrder {
  id: string;
  contact_id: string | null;
  order_number: string | null;
  created_at: string;
  deleted_at: string | null;
  sale_origin: string | null;
  status: string | null;
  payment_status: string | null;
  total_value: number | null;
}

export interface CampaignSaleEvidence {
  contact_id: string;
  event_metadata: {
    campaign_id?: string;
    recipient_id?: string;
    conversation_id?: string;
    order_id?: string;
    source?: string;
    sent_at?: string;
    inbound_at?: string;
  } | null;
}

export interface CampaignSaleSummary {
  sentContacts: number;
  tracedOrders: CampaignSaleOrder[];
  unrelatedOrders: CampaignSaleOrder[];
  tracedOrderValue: number;
  paidStatusOrderCount: number;
  paidStatusOrderValue: number;
  sourceNote: string;
}

const timestamp = (value: string | null | undefined): number | null => {
  const n = value ? Date.parse(value) : NaN;
  return Number.isFinite(n) ? n : null;
};

export function isCrmCampaignOrderTraceValid(input: {
  campaignId: string;
  recipient: CampaignSaleRecipient;
  order: CampaignSaleOrder;
  event: CampaignSaleEvidence;
}): boolean {
  const { campaignId, recipient, order, event } = input;
  const meta = event.event_metadata;
  const send = timestamp(recipient.sent_at);
  const inbound = timestamp(meta?.inbound_at);
  const created = timestamp(order.created_at);
  if (!meta || !send || !inbound || !created) return false;
  if (recipient.status !== 'sent'
    || recipient.campaign_id !== campaignId || meta.campaign_id !== campaignId
    || recipient.id !== meta.recipient_id
    || !recipient.conversation_id || recipient.conversation_id !== meta.conversation_id
    || event.contact_id !== recipient.contact_id || order.contact_id !== recipient.contact_id
    || order.id !== meta.order_id || order.deleted_at
    || order.sale_origin !== 'crm_inbox' || meta.source !== CRM_CAMPAIGN_SALE_SOURCE) return false;
  if (timestamp(meta.sent_at) !== send || send >= inbound || inbound > created) return false;
  if (inbound - send > 72 * 60 * 60 * 1000) return false;
  if (created - inbound > CRM_CAMPAIGN_SALE_WINDOW_DAYS * 86400000) return false;
  return true;
}

export function summarizeCrmCampaignSales(
  campaignId: string,
  recipients: CampaignSaleRecipient[],
  orders: CampaignSaleOrder[],
  evidence: CampaignSaleEvidence[],
): CampaignSaleSummary {
  const sent = recipients.filter(r => r.campaign_id === campaignId && r.status === 'sent'
    && Boolean(r.sent_at) && Boolean(r.conversation_id));
  const contacts = new Set(sent.map(r => r.contact_id));
  const recipientById = new Map(sent.map(r => [r.id, r]));
  const linkedOrderIds = new Set<string>();
  const tracedOrders: CampaignSaleOrder[] = [];
  const valid = orders.filter(o => o.contact_id && contacts.has(o.contact_id)
    && !o.deleted_at && o.status !== 'cancelado');
  for (const order of valid) {
    const found = evidence.some(event => {
      const recipient = recipientById.get(event.event_metadata?.recipient_id ?? '');
      return Boolean(recipient && isCrmCampaignOrderTraceValid({
        campaignId, recipient: recipient!, order, event,
      }));
    });
    if (found && !linkedOrderIds.has(order.id)) {
      tracedOrders.push(order);
      linkedOrderIds.add(order.id);
    }
  }
  const unrelatedOrders = valid.filter(order => {
    if (linkedOrderIds.has(order.id)) return false;
    const created = timestamp(order.created_at);
    return created !== null && sent.some(recipient => {
      const at = timestamp(recipient.sent_at);
      return recipient.contact_id === order.contact_id && at !== null
        && created > at && created - at <= CRM_CAMPAIGN_SALE_WINDOW_DAYS * 86400000;
    });
  });
  const amount = (o: CampaignSaleOrder) => Number.isFinite(Number(o.total_value))
    ? Math.max(0, Number(o.total_value)) : 0;
  const paid = tracedOrders.filter(o => o.payment_status === 'pago');
  return {
    sentContacts: contacts.size,
    tracedOrders,
    unrelatedOrders,
    tracedOrderValue: tracedOrders.reduce((total, o) => total + amount(o), 0),
    paidStatusOrderCount: paid.length,
    paidStatusOrderValue: paid.reduce((total, o) => total + amount(o), 0),
    sourceNote: 'Vínculo de origem da venda na Inbox, não prova de causalidade. Status pago não equivale a conciliação bancária.',
  };
}
