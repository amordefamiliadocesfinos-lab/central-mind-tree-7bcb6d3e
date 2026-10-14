/**
 * CRM F5-D — Indicadores comerciais consolidados.
 *
 * Trabalha apenas com fontes existentes:
 *   recipients/status, indícios de resposta (F3.5), pedidos com proveniência (F5-C).
 * Sem percentuais causais e sem confundir pedido pago com recebimento financeiro.
 */
import type { CampaignSaleOrder, CampaignSaleSummary } from './campaignSales';

export interface CampaignPerformance {
  campaignId: string;
  selectedAtCreation: number;
  sent: number;
  responded: number;
  pending: number;
  excluded: number;
  failed: number;
  skipped: number;
  sales: CampaignSaleSummary;
}

export interface CampaignPerformanceTotals {
  campaigns: number;
  campaignsWithSends: number;
  recipientSends: number;
  responseSignals: number;
  responseSignalRate: number | null;
  pending: number;
  excluded: number;
  failed: number;
  skipped: number;
  tracedOrders: number;
  tracedOrderValue: number;
  paidStatusOrders: number;
  paidStatusOrderValue: number;
  unlinkedOrderOccurrences: number;
  ambiguousOrderLinks: number;
}

/** Todos os valores consolidados são somas de fatos, sem rateio/estimativa. */
export function consolidateCampaignPerformance(rows: readonly CampaignPerformance[]): CampaignPerformanceTotals {
  const uniqueCampaignIds = new Set(rows.map(row => row.campaignId));
  if (uniqueCampaignIds.size !== rows.length) throw new Error('Campanha duplicada no resumo comercial.');
  for (const row of rows) {
    if (row.responded < 0 || row.sent < 0 || row.responded > row.sent
      || [row.pending, row.excluded, row.failed, row.skipped].some(value => !Number.isInteger(value) || value < 0)) {
      throw new Error('Dados inconsistentes nos destinatários ou respostas da campanha.');
    }
  }

  const orderLinks = new Map<string, { campaignIds: Set<string>; order: CampaignSaleOrder }>();
  for (const row of rows) {
    for (const order of row.sales.tracedOrders) {
      const entry = orderLinks.get(order.id) ?? { campaignIds: new Set<string>(), order };
      entry.campaignIds.add(row.campaignId);
      orderLinks.set(order.id, entry);
    }
  }
  const uniqueOrders = [...orderLinks.values()].filter(entry => entry.campaignIds.size === 1)
    .map(entry => entry.order);
  const ambiguousOrderLinks = [...orderLinks.values()].filter(entry => entry.campaignIds.size > 1).length;
  const amount = (order: CampaignSaleOrder): number => {
    const value = Number(order.total_value);
    return Number.isFinite(value) && value > 0 ? value : 0;
  };
  const paid = uniqueOrders.filter(order => order.payment_status === 'pago');
  const add = (pick: (row: CampaignPerformance) => number) =>
    rows.reduce((sum, row) => sum + pick(row), 0);
  const recipientSends = add(row => row.sent);
  const responseSignals = add(row => row.responded);
  return {
    campaigns: rows.length,
    campaignsWithSends: rows.filter(row => row.sent > 0).length,
    recipientSends,
    responseSignals,
    responseSignalRate: recipientSends > 0 ? Math.round(1000 * responseSignals / recipientSends) / 10 : null,
    pending: add(row => row.pending),
    excluded: add(row => row.excluded),
    failed: add(row => row.failed),
    skipped: add(row => row.skipped),
    tracedOrders: uniqueOrders.length,
    tracedOrderValue: uniqueOrders.reduce((sum, order) => sum + amount(order), 0),
    paidStatusOrders: paid.length,
    paidStatusOrderValue: paid.reduce((sum, order) => sum + amount(order), 0),
    // Mesmo Pedido pode aparecer em mais de uma campanha: não é conversão.
    unlinkedOrderOccurrences: add(row => row.sales.unrelatedOrders.length),
    ambiguousOrderLinks,
  };
}
