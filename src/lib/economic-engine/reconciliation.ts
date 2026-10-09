export type ReconciliationStatus = 'pending' | 'partial' | 'reconciled' | 'inconclusive';

export type EconomicReconciliationInput = {
  predictedRepasse: number | null;
  orderGross: number | null;
  settlementOrderGross: number | null;
  settlementOrderFee: number | null;
  settlementOrderNet: number | null;
  settlementGross: number | null;
  settlementFee: number | null;
  settlementNet: number | null;
  settlementOrderCount: number | null;
  financialGrossRealized: number | null;
  financialConciliated: boolean;
  financialAttributionComplete: boolean;
};

export type EconomicReconciliationResult = {
  status: ReconciliationStatus;
  observedNet: number | null;
  financialNet: number | null;
  predictedVsObservedDelta: number | null;
  predictedVsFinancialDelta: number | null;
  observedVsFinancialDelta: number | null;
  pending: string[];
  notes: string[];
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const known = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export function reconcileEconomicPrediction(
  input: EconomicReconciliationInput,
): EconomicReconciliationResult {
  const pending: string[] = [];
  const notes: string[] = [];

  let observedNet: number | null = null;

  const orderLevelNetIsAllocated = known(input.settlementOrderNet) && (
    (known(input.settlementOrderFee) && Math.abs(input.settlementOrderFee) > 0.0001) ||
    (
      known(input.settlementOrderGross) &&
      Math.abs(input.settlementOrderNet - input.settlementOrderGross) > 0.0001
    )
  );

  if (orderLevelNetIsAllocated) {
    observedNet = round2(input.settlementOrderNet!);
  } else if (
    input.settlementOrderCount === 1 &&
    known(input.settlementNet)
  ) {
    observedNet = round2(input.settlementNet);
    notes.push('Settlement com um único Pedido: líquido agregado é atribuível ao Pedido.');
  } else if (known(input.settlementOrderGross) || known(input.settlementGross)) {
    pending.push('observed_net_allocation');
    notes.push('Taxa/líquido do settlement não é atribuível ao Pedido sem regra explícita de alocação.');
  } else {
    pending.push('observed_external');
  }

  let financialNet: number | null = null;

  if (input.financialConciliated && input.financialAttributionComplete) {
    if (input.settlementOrderCount === 1 && known(input.settlementNet)) {
      financialNet = round2(input.settlementNet);
    } else if (orderLevelNetIsAllocated) {
      financialNet = round2(input.settlementOrderNet!);
    } else {
      pending.push('financial_net_allocation');
      if (known(input.financialGrossRealized)) {
        notes.push(
          'Financeiro possui valor realizado bruto do Pedido, mas o líquido econômico não é atribuível sem alocação da taxa.',
        );
      }
    }
  } else {
    if (!input.financialConciliated) pending.push('financial_reconciliation');
    if (!input.financialAttributionComplete) {
      pending.push('financial_attribution');
      notes.push('O valor financeiro realizado não está integralmente atribuível ao Pedido selecionado.');
    }
  }

  if (!known(input.predictedRepasse)) {
    pending.push('predicted_repasse');
  }

  const predictedVsObservedDelta =
    known(input.predictedRepasse) && known(observedNet)
      ? round2(observedNet - input.predictedRepasse)
      : null;

  const predictedVsFinancialDelta =
    known(input.predictedRepasse) && known(financialNet)
      ? round2(financialNet - input.predictedRepasse)
      : null;

  const observedVsFinancialDelta =
    known(observedNet) && known(financialNet)
      ? round2(financialNet - observedNet)
      : null;

  let status: ReconciliationStatus = 'pending';

  if (known(input.predictedRepasse) && known(observedNet) && known(financialNet)) {
    status = 'reconciled';
  } else if (
    known(input.predictedRepasse) &&
    (
      known(observedNet) ||
      known(financialNet) ||
      known(input.financialGrossRealized) ||
      known(input.orderGross)
    )
  ) {
    status = 'partial';
  } else if (
    known(input.orderGross) ||
    known(input.settlementGross) ||
    known(input.financialGrossRealized)
  ) {
    status = 'inconclusive';
  }

  return {
    status,
    observedNet,
    financialNet,
    predictedVsObservedDelta,
    predictedVsFinancialDelta,
    observedVsFinancialDelta,
    pending: [...new Set(pending)],
    notes,
  };
}
