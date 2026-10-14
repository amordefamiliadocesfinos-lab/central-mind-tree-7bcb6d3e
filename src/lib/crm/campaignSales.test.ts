import {
  CRM_CAMPAIGN_SALE_EVENT, CRM_CAMPAIGN_SALE_SOURCE,
  isCrmCampaignOrderTraceValid, summarizeCrmCampaignSales,
  type CampaignSaleOrder, type CampaignSaleEvidence, type CampaignSaleRecipient,
} from './campaignSales';

function assert(ok: unknown, label: string): asserts ok {
  if (!ok) throw new Error('CRM F5-C: ' + label);
}
const campaignId = 'campaign-1';
const sentAt = '2026-10-01T10:00:00Z';
const inboundAt = '2026-10-01T11:00:00Z';
const recipient: CampaignSaleRecipient = {
  id: 'recipient-1', campaign_id: campaignId, contact_id: 'customer-1',
  conversation_id: 'conversation-1', status: 'sent', sent_at: sentAt,
};
const order: CampaignSaleOrder = {
  id: 'order-1', contact_id: 'customer-1', order_number: 'PED-001',
  created_at: '2026-10-01T12:00:00Z', deleted_at: null,
  sale_origin: 'crm_inbox', status: 'pendente', payment_status: 'pendente', total_value: 175,
};
const evidence: CampaignSaleEvidence = {
  contact_id: 'customer-1',
  event_metadata: {
    campaign_id: campaignId, recipient_id: recipient.id, conversation_id: recipient.conversation_id!,
    order_id: order.id, sent_at: sentAt, inbound_at: inboundAt, source: CRM_CAMPAIGN_SALE_SOURCE,
  },
};
assert(CRM_CAMPAIGN_SALE_EVENT === 'crm_campaign_order_link', 'evento esperado');
assert(isCrmCampaignOrderTraceValid({ campaignId, recipient, order, event: evidence }), 'cadeia válida');
assert(!isCrmCampaignOrderTraceValid({ campaignId, recipient, order: { ...order, contact_id: 'other' }, event: evidence }), 'contato estranho');
assert(!isCrmCampaignOrderTraceValid({ campaignId: 'other-campaign', recipient, order, event: evidence }), 'campanha divergente');
assert(!isCrmCampaignOrderTraceValid({ campaignId, recipient: { ...recipient, status: 'failed' }, order, event: evidence }), 'sem envio confirmado');
assert(!isCrmCampaignOrderTraceValid({ campaignId, recipient, order, event: { ...evidence, event_metadata: { ...evidence.event_metadata, recipient_id: 'other' } } }), 'recipient divergente');
assert(!isCrmCampaignOrderTraceValid({ campaignId, recipient, order, event: { ...evidence, event_metadata: { ...evidence.event_metadata, source: 'estimated_by_time' } } }), 'inferência por tempo não serve');
assert(!isCrmCampaignOrderTraceValid({ campaignId, recipient, order: { ...order, created_at: sentAt }, event: evidence }), 'pedido anterior à resposta');
assert(!isCrmCampaignOrderTraceValid({ campaignId, recipient, order: { ...order, deleted_at: '2026-10-02T00:00:00Z' }, event: evidence }), 'pedido excluído');
const afterSendOnly = { ...order, id: 'order-2', created_at: '2026-10-03T10:00:00Z', total_value: 500 };
const summary = summarizeCrmCampaignSales(campaignId, [recipient], [order, afterSendOnly], [evidence, evidence]);
assert(summary.sentContacts === 1, '50 recipients e contatos distintos não são a mesma coisa');
assert(summary.tracedOrders.length === 1 && summary.tracedOrderValue === 175, 'conversão rastreada única');
assert(summary.unrelatedOrders.length === 1 && summary.unrelatedOrders[0].id === afterSendOnly.id,
  'pedido posterior sem vínculo fica separado e não recebe atribuição');
assert(summary.paidStatusOrderValue === 0, 'pedido não pago não é receita recebida');
const paid = summarizeCrmCampaignSales(campaignId, [recipient], [{ ...order, payment_status: 'pago' }], [evidence]);
assert(paid.paidStatusOrderCount === 1 && paid.paidStatusOrderValue === 175,
  'pagamento somente pelo status explícito do Pedido, não atribuição bancária');
const otherCampaign = summarizeCrmCampaignSales('other', [recipient], [order], [evidence]);
assert(otherCampaign.tracedOrders.length === 0 && otherCampaign.unrelatedOrders.length === 0,
  'não vazar pedidos e valores entre campanhas');
console.log('campaignSales.test: OK');
