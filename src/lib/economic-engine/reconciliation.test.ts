import { reconcileEconomicPrediction } from './reconciliation';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('economic-engine/reconciliation.test: ' + message);
}

function equal(actual: unknown, expected: unknown, message: string) {
  assert(Object.is(actual, expected), message + ': esperado ' + String(expected) + ', recebido ' + String(actual));
}

const singleOrder = reconcileEconomicPrediction({
  predictedRepasse: 64.73,
  orderGross: 97.85,
  settlementOrderGross: 97.85,
  settlementOrderFee: 0,
  settlementOrderNet: 97.85,
  settlementGross: 97.85,
  settlementFee: 33.12,
  settlementNet: 64.73,
  settlementOrderCount: 1,
  financialGrossRealized: 97.85,
  financialConciliated: true,
  financialAttributionComplete: true,
});
equal(singleOrder.status, 'reconciled', 'settlement de um Pedido deve permitir reconciliação completa');
equal(singleOrder.observedNet, 64.73, 'líquido externo deve vir do settlement único');
equal(singleOrder.financialNet, 64.73, 'líquido financeiro atribuível deve coincidir com settlement único');
equal(singleOrder.predictedVsFinancialDelta, 0, 'previsão igual ao real deve ter delta zero');

const multiOrderWithoutAllocation = reconcileEconomicPrediction({
  predictedRepasse: 64.73,
  orderGross: 97.85,
  settlementOrderGross: 97.85,
  settlementOrderFee: 0,
  settlementOrderNet: 97.85,
  settlementGross: 300,
  settlementFee: 50,
  settlementNet: 250,
  settlementOrderCount: 3,
  financialGrossRealized: 97.85,
  financialConciliated: true,
  financialAttributionComplete: true,
});
equal(multiOrderWithoutAllocation.status, 'partial', 'settlement multi-Pedido sem rateio deve ser parcial');
equal(multiOrderWithoutAllocation.observedNet, null, 'não deve inventar líquido por Pedido');
equal(multiOrderWithoutAllocation.financialNet, null, 'não deve inventar líquido financeiro por Pedido');
assert(multiOrderWithoutAllocation.pending.includes('observed_net_allocation'), 'deve explicitar rateio externo pendente');
assert(multiOrderWithoutAllocation.pending.includes('financial_net_allocation'), 'deve explicitar rateio financeiro pendente');

const allocatedOrder = reconcileEconomicPrediction({
  predictedRepasse: 64.73,
  orderGross: 97.85,
  settlementOrderGross: 97.85,
  settlementOrderFee: 33.1,
  settlementOrderNet: 64.75,
  settlementGross: 300,
  settlementFee: 50,
  settlementNet: 250,
  settlementOrderCount: 3,
  financialGrossRealized: 97.85,
  financialConciliated: true,
  financialAttributionComplete: true,
});
equal(allocatedOrder.status, 'reconciled', 'líquido explicitamente alocado por Pedido deve reconciliar');
equal(allocatedOrder.observedNet, 64.75, 'deve preservar líquido alocado');
equal(allocatedOrder.predictedVsObservedDelta, 0.02, 'delta deve ser arredondado a centavos');

const noFinancial = reconcileEconomicPrediction({
  predictedRepasse: 64.73,
  orderGross: 97.85,
  settlementOrderGross: 97.85,
  settlementOrderFee: 33.12,
  settlementOrderNet: 64.73,
  settlementGross: 97.85,
  settlementFee: 33.12,
  settlementNet: 64.73,
  settlementOrderCount: 1,
  financialGrossRealized: null,
  financialConciliated: false,
  financialAttributionComplete: true,
});
equal(noFinancial.status, 'partial', 'observado externo sem conciliação financeira deve ser parcial');
assert(noFinancial.pending.includes('financial_reconciliation'), 'financeiro pendente deve ser explícito');

console.log('economic-engine/reconciliation.test: OK');


const incompleteFinancialAttribution = reconcileEconomicPrediction({
  predictedRepasse: 64.73,
  orderGross: 97.85,
  settlementOrderGross: 97.85,
  settlementOrderFee: 33.12,
  settlementOrderNet: 64.73,
  settlementGross: 97.85,
  settlementFee: 33.12,
  settlementNet: 64.73,
  settlementOrderCount: 1,
  financialGrossRealized: 97.85,
  financialConciliated: true,
  financialAttributionComplete: false,
});
equal(incompleteFinancialAttribution.status, 'partial', 'atribuição financeira incompleta deve impedir reconciliação total');
equal(incompleteFinancialAttribution.financialNet, null, 'líquido financeiro não pode ser inventado');
assert(incompleteFinancialAttribution.pending.includes('financial_attribution'), 'atribuição financeira deve ficar pendente');
