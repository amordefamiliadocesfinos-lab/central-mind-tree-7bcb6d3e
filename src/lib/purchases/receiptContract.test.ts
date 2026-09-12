import {
  assertReceiptPreconditions,
  derivePurchaseOrderReceivingStatus,
  exceedsOrderedPurchaseQty,
  suggestedOperationalReceiptQty,
} from './receiptContract';

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function rejects(fn: () => void, message: string) {
  try {
    fn();
  } catch {
    return;
  }
  throw new Error(message);
}

// A/B: simples e conversão exata.
expect(suggestedOperationalReceiptQty(10, 1) === 10, 'produto simples deve sugerir 10 un');
expect(suggestedOperationalReceiptQty(2, 20_000) === 40_000, '2 sacos devem sugerir 40.000 g');

// C: parcial e total posterior.
expect(
  derivePurchaseOrderReceivingStatus('confirmado', [{ orderedPurchaseQty: 10, receivedPurchaseQty: 6 }]) === 'parcialmente_recebido',
  '6 de 10 deve permanecer parcialmente recebido',
);
expect(
  derivePurchaseOrderReceivingStatus('parcialmente_recebido', [{ orderedPurchaseQty: 10, receivedPurchaseQty: 10 }]) === 'recebido',
  '10 de 10 deve finalizar como recebido',
);

// D: o operador pode confirmar o número físico real, diferente da sugestão aproximada.
expect(suggestedOperationalReceiptQty(1, 880) === 880, 'fator aproximado deve somente sugerir 880');
assertReceiptPreconditions({
  purchaseOrderStatus: 'confirmado',
  receiptStatus: 'draft',
  lines: [{ orderedPurchaseQty: 1, alreadyReceivedPurchaseQty: 0, incomingPurchaseQty: 1, operationalReceivedQty: 872, variationMode: 'sem_variacao', variantId: null }],
});

// E/F/G/H/I/J: pré-validação deve impedir duplicidade lógica, excesso,
// identidades inválidas, estados cancelados e qualquer lote inválido.
expect(!exceedsOrderedPurchaseQty(10, 0, 10), 'recebimento exato não pode exceder pedido');
expect(exceedsOrderedPurchaseQty(10, 6, 5), 'recebimento adicional acima do saldo deve bloquear');
rejects(() => assertReceiptPreconditions({ purchaseOrderStatus: 'confirmado', receiptStatus: 'draft', lines: [{ orderedPurchaseQty: 1, alreadyReceivedPurchaseQty: 0, incomingPurchaseQty: 1, operationalReceivedQty: 1, variationMode: 'variacoes_fisicas', variantId: null }] }), 'mestre sem variante deveria bloquear');
rejects(() => assertReceiptPreconditions({ purchaseOrderStatus: 'cancelado', receiptStatus: 'draft', lines: [{ orderedPurchaseQty: 1, alreadyReceivedPurchaseQty: 0, incomingPurchaseQty: 1, operationalReceivedQty: 1, variationMode: 'sem_variacao', variantId: null }] }), 'pedido cancelado deveria bloquear');
rejects(() => assertReceiptPreconditions({ purchaseOrderStatus: 'confirmado', receiptStatus: 'cancelled', lines: [{ orderedPurchaseQty: 1, alreadyReceivedPurchaseQty: 0, incomingPurchaseQty: 1, operationalReceivedQty: 1, variationMode: 'sem_variacao', variantId: null }] }), 'receipt cancelado deveria bloquear');
rejects(() => assertReceiptPreconditions({ purchaseOrderStatus: 'confirmado', receiptStatus: 'draft', lines: [
  { orderedPurchaseQty: 2, alreadyReceivedPurchaseQty: 0, incomingPurchaseQty: 2, operationalReceivedQty: 2, variationMode: 'sem_variacao', variantId: null },
  { orderedPurchaseQty: 2, alreadyReceivedPurchaseQty: 1, incomingPurchaseQty: 2, operationalReceivedQty: 2, variationMode: 'sem_variacao', variantId: null },
] }), 'falha de uma linha deve reprovar o lote inteiro antes da confirmação');
