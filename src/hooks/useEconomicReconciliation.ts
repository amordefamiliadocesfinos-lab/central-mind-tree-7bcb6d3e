import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { reconcileEconomicPrediction } from '@/lib/economic-engine/reconciliation';

export type EconomicPredictionSnapshotRecord = {
  id: string;
  snapshot_key: string;
  engine_key: string;
  engine_version: string;
  rule_version_id: string | null;
  rule_version: string | null;
  marketplace: string;
  channel_account_id: string | null;
  marketplace_product_mapping_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  commercial_presentation_id: string | null;
  effective_at: string;
  confidence: 'high' | 'medium' | 'low';
  input_snapshot: Record<string, any>;
  result_snapshot: Record<string, any>;
  evidence_snapshot: Record<string, any>;
  pending_snapshot: any[];
  created_at: string;
};

export type ReconciliationOrderCandidate = {
  id: string;
  order_number: string | null;
  total_value: number | null;
  order_date: string;
  marketplace_account: string | null;
  channel_account_id: string | null;
  items: Array<{
    product_id: string;
    variant_id: string | null;
    quantity: number;
    unit_price: number | null;
    commercial_quantity: number | null;
    commercial_conversion_factor: number | null;
    commercial_presentation_id: string | null;
  }>;
};

export type ReconciliationSaveResult = {
  reconciliationId: string;
  status: 'pending' | 'partial' | 'reconciled' | 'inconclusive';
  comparison: ReturnType<typeof reconcileEconomicPrediction>;
};

const db = supabase as any;

function numeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function useEconomicReconciliation() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listSnapshots = useCallback(async (channelAccountId: string | null, productId: string | null) => {
    setLoading(true);
    setError(null);

    let query = db
      .from('economic_prediction_snapshots')
      .select('*')
      .eq('engine_key', 'shopee-economic-v2')
      .eq('marketplace', 'shopee')
      .order('created_at', { ascending: false })
      .limit(25);

    if (channelAccountId) query = query.eq('channel_account_id', channelAccountId);
    if (productId) query = query.eq('product_id', productId);

    const { data, error: queryError } = await query;
    setLoading(false);

    if (queryError) {
      setError(queryError.message || 'Não foi possível carregar snapshots econômicos.');
      return [];
    }

    return (data ?? []) as EconomicPredictionSnapshotRecord[];
  }, []);

  const listCandidateOrders = useCallback(async (snapshot: EconomicPredictionSnapshotRecord) => {
    setLoading(true);
    setError(null);

    let query = db
      .from('orders')
      .select('id,order_number,total_value,order_date,marketplace_account,channel_account_id,order_items(product_id,variant_id,quantity,unit_price,commercial_quantity,commercial_conversion_factor,commercial_presentation_id)')
      .eq('channel', 'shopee')
      .is('deleted_at', null)
      .order('order_date', { ascending: false })
      .limit(100);

    if (snapshot.channel_account_id) query = query.eq('channel_account_id', snapshot.channel_account_id);

    const { data, error: queryError } = await query;
    setLoading(false);

    if (queryError) {
      setError(queryError.message || 'Não foi possível carregar Pedidos Shopee para reconciliação.');
      return [];
    }

    const rows = (data ?? []) as any[];
    return rows.flatMap((order): ReconciliationOrderCandidate[] => {
      const items = (order.order_items ?? []) as ReconciliationOrderCandidate['items'];
      const matches = items.some((item) =>
        (!snapshot.product_id || item.product_id === snapshot.product_id) &&
        (!snapshot.variant_id || item.variant_id === snapshot.variant_id),
      );
      if (!matches) return [];
      return [{
        id: order.id,
        order_number: order.order_number,
        total_value: numeric(order.total_value),
        order_date: order.order_date,
        marketplace_account: order.marketplace_account,
        channel_account_id: order.channel_account_id,
        items,
      }];
    });
  }, []);

  const reconcileSnapshotWithOrder = useCallback(async (
    snapshot: EconomicPredictionSnapshotRecord,
    order: ReconciliationOrderCandidate,
  ): Promise<ReconciliationSaveResult | null> => {
    setSaving(true);
    setError(null);

    try {
      const { data: settlementLinks, error: settlementError } = await db
        .from('marketplace_settlement_orders')
        .select('id,settlement_id,order_id,gross_value,fee_value,net_value,created_at,settlement:marketplace_settlements(id,marketplace,marketplace_account,channel_account_id,settlement_date,gross_value,fee_value,net_value,status)')
        .eq('order_id', order.id);
      if (settlementError) throw settlementError;

      const normalizedLinks = (settlementLinks ?? []) as any[];
      normalizedLinks.sort((a, b) => {
        const dateA = a.settlement?.settlement_date ?? a.created_at ?? '';
        const dateB = b.settlement?.settlement_date ?? b.created_at ?? '';
        return dateB.localeCompare(dateA);
      });
      const settlementLink = normalizedLinks[0] ?? null;

      let settlementOrderCount: number | null = null;
      if (settlementLink?.settlement_id) {
        const { data: settlementOrders, error: settlementCountError } = await db
          .from('marketplace_settlement_orders')
          .select('id')
          .eq('settlement_id', settlementLink.settlement_id);
        if (settlementCountError) throw settlementCountError;
        settlementOrderCount = (settlementOrders ?? []).length;
      }

      const { data: directEntries, error: directEntriesError } = await db
        .from('financial_entries')
        .select('id,value,value_paid,is_conciliated,conciliated_at,payment_date,order_id,lifecycle_status')
        .eq('type', 'receber')
        .eq('order_id', order.id);
      if (directEntriesError) throw directEntriesError;

      const { data: linkedRows, error: linkedRowsError } = await db
        .from('financial_order_links')
        .select('allocated_value,financial_entry:financial_entries(id,value,value_paid,is_conciliated,conciliated_at,payment_date,order_id,lifecycle_status)')
        .eq('order_id', order.id);
      if (linkedRowsError) throw linkedRowsError;

      const entriesById = new Map<string, any>();
      for (const entry of directEntries ?? []) entriesById.set(entry.id, entry);
      for (const row of linkedRows ?? []) {
        const entry = row.financial_entry;
        if (entry?.id) entriesById.set(entry.id, entry);
      }
      const financialEntries = [...entriesById.values()];
      const financialGrossRealized = financialEntries.length > 0
        ? financialEntries.reduce((sum, entry) => sum + Number(entry.value_paid || 0), 0)
        : null;
      const financialConciliated = financialEntries.length > 0 &&
        financialEntries.every((entry) => Boolean(entry.is_conciliated));

      const settlement = settlementLink?.settlement ?? null;
      const predictedRepasse = numeric(snapshot.result_snapshot?.repasse);

      const comparison = reconcileEconomicPrediction({
        predictedRepasse,
        orderGross: numeric(order.total_value),
        settlementOrderGross: numeric(settlementLink?.gross_value),
        settlementOrderFee: numeric(settlementLink?.fee_value),
        settlementOrderNet: numeric(settlementLink?.net_value),
        settlementGross: numeric(settlement?.gross_value),
        settlementFee: numeric(settlement?.fee_value),
        settlementNet: numeric(settlement?.net_value),
        settlementOrderCount,
        financialGrossRealized,
        financialConciliated,
      });

      const pending = [...comparison.pending];
      if (normalizedLinks.length > 1) pending.push('multiple_settlements');

      const observedSnapshot = {
        order: { id: order.id, orderNumber: order.order_number, orderDate: order.order_date, grossValue: numeric(order.total_value), marketplaceAccount: order.marketplace_account },
        settlement: settlement ? {
          id: settlement.id, settlementDate: settlement.settlement_date, grossValue: numeric(settlement.gross_value),
          feeValue: numeric(settlement.fee_value), netValue: numeric(settlement.net_value), status: settlement.status, orderCount: settlementOrderCount,
        } : null,
        settlementOrder: settlementLink ? { id: settlementLink.id, grossValue: numeric(settlementLink.gross_value), feeValue: numeric(settlementLink.fee_value), netValue: numeric(settlementLink.net_value) } : null,
        settlementLinkCountForOrder: normalizedLinks.length,
      };

      const financialSnapshot = {
        entries: financialEntries.map((entry) => ({
          id: entry.id, value: numeric(entry.value), valuePaid: numeric(entry.value_paid), isConciliated: Boolean(entry.is_conciliated),
          conciliatedAt: entry.conciliated_at, paymentDate: entry.payment_date, lifecycleStatus: entry.lifecycle_status,
        })),
        grossRealized: financialGrossRealized,
        allEntriesConciliated: financialConciliated,
      };

      const comparisonSnapshot = {
        predictedRepasse, observedNet: comparison.observedNet, financialNet: comparison.financialNet,
        predictedVsObservedDelta: comparison.predictedVsObservedDelta, predictedVsFinancialDelta: comparison.predictedVsFinancialDelta,
        observedVsFinancialDelta: comparison.observedVsFinancialDelta, notes: comparison.notes,
      };

      const primaryFinancialEntryId = financialEntries.length === 1 ? financialEntries[0].id : null;
      const { data: reconciliationId, error: rpcError } = await db.rpc('create_economic_prediction_reconciliation', {
        p_prediction_snapshot_id: snapshot.id,
        p_status: comparison.status,
        p_order_id: order.id,
        p_marketplace_settlement_id: settlement?.id ?? null,
        p_financial_entry_id: primaryFinancialEntryId,
        p_observed_snapshot: observedSnapshot,
        p_financial_snapshot: financialSnapshot,
        p_comparison_snapshot: comparisonSnapshot,
        p_pending_snapshot: [...new Set(pending)],
        p_notes: normalizedLinks.length > 1
          ? 'Pedido possui múltiplos settlements; a reconciliação usa o settlement mais recente e mantém a multiplicidade como pendência.'
          : null,
      });
      if (rpcError) throw rpcError;

      setSaving(false);
      return { reconciliationId: String(reconciliationId), status: comparison.status, comparison };
    } catch (caught: any) {
      setSaving(false);
      setError(caught?.message || 'Não foi possível reconciliar a previsão econômica.');
      return null;
    }
  }, []);

  return { loading, saving, error, listSnapshots, listCandidateOrders, reconcileSnapshotWithOrder };
}