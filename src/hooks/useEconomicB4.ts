import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  buildB4Components,
  calculateB4FundingSummary,
  type B4CostSource,
  type B4LogisticsMode,
} from '@/lib/economic-engine/b4';
import { composeEconomicResult } from '@/lib/economic-engine/composer';
import { ORDER_LOGISTICS_EXPENSE_MARKER } from '@/lib/financial/orderLogisticsExpense';

const db = supabase as any;

type OrderLogisticsRow = {
  id: string;
  operational_destination: string | null;
  logistics_mode: string | null;
  shipping_amount: number | null;
  operational_destination_details: Record<string, unknown> | null;
};

type FinancialEntryRow = {
  id: string;
  value: number | null;
  value_paid: number | null;
  payment_date: string | null;
  is_conciliated: boolean;
  conciliated_at: string | null;
  created_at: string;
};

type DeliveryStopRow = {
  id: string;
  route_id: string;
  order_id: string | null;
};

export type EconomicB4Scenario = {
  mode: B4LogisticsMode | null;
  logisticsCost: number | null;
  customerFreightPaid: number | null;
  channelFreightSubsidy: number | null;
};

function asMode(value: unknown): B4LogisticsMode | null {
  const allowed = new Set<B4LogisticsMode>([
    'retirada_fabrica',
    'entrega_propria',
    'uber_entrega',
    'transportadora',
    'correios',
    'marketplace_logistica',
    'academia_ponto_logistico',
    'outro',
  ]);
  return typeof value === 'string' && allowed.has(value as B4LogisticsMode)
    ? value as B4LogisticsMode
    : null;
}

function nonNegative(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function useEconomicB4(
  orderId: string | null,
  scenario: EconomicB4Scenario,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderLogisticsRow | null>(null);
  const [financialEntry, setFinancialEntry] = useState<FinancialEntryRow | null>(null);
  const [routeId, setRouteId] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      setFinancialEntry(null);
      setRouteId(null);
      setError(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      const [orderResult, entryResult, stopResult] = await Promise.all([
        db.from('orders')
          .select('id,operational_destination,logistics_mode,shipping_amount,operational_destination_details')
          .eq('id', orderId)
          .single(),
        db.from('financial_entries')
          .select('id,value,value_paid,payment_date,is_conciliated,conciliated_at,created_at')
          .eq('order_id', orderId)
          .eq('type', 'pagar')
          .ilike('notes', '%' + ORDER_LOGISTICS_EXPENSE_MARKER + '%')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
        db.from('delivery_stops')
          .select('id,route_id,order_id')
          .eq('order_id', orderId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const firstError = orderResult.error || entryResult.error || stopResult.error;
      if (firstError) {
        setError(firstError.message || 'Não foi possível resolver o B4 do pedido.');
        setLoading(false);
        return;
      }

      setOrder(orderResult.data as OrderLogisticsRow);
      setFinancialEntry((entryResult.data ?? null) as FinancialEntryRow | null);
      setRouteId(((stopResult.data ?? null) as DeliveryStopRow | null)?.route_id ?? null);
      setLoading(false);
    };

    void load();
    return () => { cancelled = true; };
  }, [orderId]);

  const result = useMemo(() => {
    const realMode = asMode(order?.operational_destination);
    const mode = orderId ? realMode : scenario.mode;

    let logisticsCost = orderId
      ? nonNegative(financialEntry?.value)
      : nonNegative(scenario.logisticsCost);

    let source: B4CostSource = orderId
      ? financialEntry
        ? 'financial_entry'
        : mode === 'retirada_fabrica'
          ? 'zero_confirmed'
          : 'missing'
      : mode === 'retirada_fabrica' && (logisticsCost === null || logisticsCost === 0)
        ? 'zero_confirmed'
        : logisticsCost !== null
          ? 'manual_simulation'
          : 'missing';

    if (mode === 'retirada_fabrica' && logisticsCost === null) {
      logisticsCost = 0;
    }

    const customerFreightPaid = orderId
      ? nonNegative(order?.shipping_amount)
      : nonNegative(scenario.customerFreightPaid);

    const channelFreightSubsidy = orderId
      ? null
      : nonNegative(scenario.channelFreightSubsidy);

    const components = buildB4Components({
      mode,
      logisticsCost,
      source,
      sourceId: financialEntry?.id ?? orderId,
      sourceEntity: financialEntry ? 'financial_entries' : orderId ? 'orders' : 'scenario',
      observedAt: financialEntry?.payment_date ?? financialEntry?.created_at ?? null,
      isPaid: Number(financialEntry?.value_paid ?? 0) > 0,
      isConciliated: financialEntry?.is_conciliated ?? false,
      orderId,
      routeId,
      customerFreightPaid,
      channelFreightSubsidy,
      notes: orderId && order?.logistics_mode
        ? 'Modalidade operacional: ' + order.logistics_mode
        : null,
    });

    const composition = composeEconomicResult({ components });
    const funding = calculateB4FundingSummary({
      mode,
      logisticsCost,
      source,
      customerFreightPaid,
      channelFreightSubsidy,
    });

    return {
      mode,
      logisticsCost,
      components,
      composition,
      funding,
      routeId,
      operationalLogisticsMode: order?.logistics_mode ?? null,
      source,
    };
  }, [orderId, order, financialEntry, routeId, scenario]);

  return { loading, error, result };
}
