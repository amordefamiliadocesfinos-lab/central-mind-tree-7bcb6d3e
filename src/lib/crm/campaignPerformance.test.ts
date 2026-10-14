import { consolidateCampaignPerformance, type CampaignPerformance } from './campaignPerformance';
import type { CampaignSaleOrder, CampaignSaleSummary } from './campaignSales';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('CRM F5-D: ' + message);
}
const order = (id: string, value: number, status: string = 'pendente'): CampaignSaleOrder => ({
  id, contact_id: 'contact', order_number: id, created_at: '2026-10-14T10:00:00Z',
  deleted_at: null, sale_origin: 'crm_inbox', status: 'concluido',
  payment_status: status, total_value: value,
});
const sales = (tracedOrders: CampaignSaleOrder[], unrelatedOrders: CampaignSaleOrder[] = []): CampaignSaleSummary => ({
  sentContacts: 2, tracedOrders, unrelatedOrders,
  tracedOrderValue: tracedOrders.reduce((sum, o) => sum + (o.total_value ?? 0), 0),
  paidStatusOrderCount: tracedOrders.filter(o => o.payment_status === 'pago').length,
  paidStatusOrderValue: tracedOrders.filter(o => o.payment_status === 'pago').reduce((sum,o)=>sum + (o.total_value ?? 0),0),
  sourceNote: 'Fonte oficial.',
});
const base = (id: string, data: Partial<CampaignPerformance>): CampaignPerformance => ({
  campaignId: id, selectedAtCreation: 10, sent: 0, responded: 0,
  pending: 0, excluded: 0, failed: 0, skipped: 0, sales: sales([]), ...data,
});
const noData = consolidateCampaignPerformance([base('draft', { pending: 8, excluded: 2 })]);
assert(noData.campaigns === 1 && noData.recipientSends === 0 && noData.responseSignalRate === null
  && noData.tracedOrders === 0, 'rascunho sem envio não tem taxa estimada nem conversão');
const paid = order('one', 195.50, 'pago');
const pending = order('two', 310.40);
const unrelated = order('third', 500);
const a = base('a', {
  sent: 3, responded: 2, pending: 2, failed: 1,
  sales: sales([paid, pending], [unrelated]),
});
const b = base('b', {
  sent: 2, responded: 1, excluded: 1, skipped: 1,
  sales: sales([paid], [unrelated]),
});
const total = consolidateCampaignPerformance([a, b]);
assert(total.campaigns === 2 && total.campaignsWithSends === 2, 'duas campanhas com envio');
assert(total.recipientSends === 5 && total.responseSignals === 3
  && total.responseSignalRate === 60, 'respostas têm denominador de envio, não contatos selecionados');
assert(total.failed === 1 && total.pending === 2 && total.skipped === 1
  && total.excluded === 1, 'status lidos separadamente');
assert(total.ambiguousOrderLinks === 1, 'mesmo pedido em campanhas distintas vira ambiguidade');
assert(total.tracedOrders === 1 && total.tracedOrderValue === 310.40,
  'pedido conflitante não é atribuído nem somado duas vezes');
assert(total.paidStatusOrders === 0 && total.paidStatusOrderValue === 0,
  'pedido pago com vínculo ambíguo não é receita rastreada');
assert(total.unlinkedOrderOccurrences === 2, 'pedidos sem vínculo são ocorrências, não conversões');
const independent = consolidateCampaignPerformance([
  base('a', { sent: 2, responded: 1, sales: sales([paid]) }),
  base('b', { sent: 3, responded: 2, sales: sales([pending]) }),
]);
assert(independent.tracedOrders === 2 && independent.tracedOrderValue === 505.9
  && independent.paidStatusOrders === 1 && independent.paidStatusOrderValue === 195.50,
  'pedido e status pago distinguem valor nominal de recebimento conciliado');
let error = false;
try { consolidateCampaignPerformance([base('a', {}), base('a', {})]); }
catch { error = true; }
assert(error, 'não duplicar campanha na consolidação');
error = false;
try { consolidateCampaignPerformance([base('a', { sent: 1, responded: 2 })]); }
catch { error = true; }
assert(error, 'respostas acima de enviados invalidam métricas');
console.log('campaignPerformance.test: OK');
