/** Shared arithmetic for the Purchase UI. The database RPC remains sovereign
 * for every physical validation and movement. */
export const PURCHASE_RECEIPT_EPSILON = 0.000001;

export type PurchaseOrderReceivingStatus =
  | 'rascunho'
  | 'confirmado'
  | 'em_transito'
  | 'parcialmente_recebido'
  | 'recebido'
  | 'cancelado';

export interface PurchaseReceivingLine {
  orderedPurchaseQty: number;
  receivedPurchaseQty: number;
}

export function suggestedOperationalReceiptQty(
  receivedPurchaseQty: number,
  conversionFactor: number,
) {
  return receivedPurchaseQty * conversionFactor;
}

export function exceedsOrderedPurchaseQty(
  orderedPurchaseQty: number,
  alreadyReceivedPurchaseQty: number,
  incomingPurchaseQty: number,
) {
  return alreadyReceivedPurchaseQty + incomingPurchaseQty > orderedPurchaseQty + PURCHASE_RECEIPT_EPSILON;
}

/** Derives transit/partial/received state from confirmed receipt quantities. */
export function derivePurchaseOrderReceivingStatus(
  currentStatus: PurchaseOrderReceivingStatus,
  lines: PurchaseReceivingLine[],
): PurchaseOrderReceivingStatus {
  if (currentStatus === 'cancelado' || lines.length === 0) return currentStatus;

  const hasReceipt = lines.some(line => line.receivedPurchaseQty > PURCHASE_RECEIPT_EPSILON);
  if (!hasReceipt) return currentStatus;

  const allReceived = lines.every(
    line => line.receivedPurchaseQty >= line.orderedPurchaseQty - PURCHASE_RECEIPT_EPSILON,
  );
  return allReceived ? 'recebido' : 'parcialmente_recebido';
}

export function assertReceiptPreconditions(input: {
  purchaseOrderStatus: PurchaseOrderReceivingStatus;
  receiptStatus: 'draft' | 'confirmed' | 'cancelled';
  lines: Array<{
    orderedPurchaseQty: number;
    alreadyReceivedPurchaseQty: number;
    incomingPurchaseQty: number;
    operationalReceivedQty: number;
    variationMode: 'sem_variacao' | 'variacoes_fisicas';
    variantId: string | null;
  }>;
}) {
  if (input.receiptStatus === 'cancelled') throw new Error('Recebimento cancelado não pode ser confirmado.');
  if (input.purchaseOrderStatus === 'cancelado') throw new Error('Pedido de compra cancelado não pode receber material.');
  if (!['confirmado', 'em_transito', 'parcialmente_recebido'].includes(input.purchaseOrderStatus)) {
    throw new Error('Pedido de compra precisa estar confirmado ou em trânsito para receber material.');
  }
  if (!input.lines.length) throw new Error('Recebimento precisa ter ao menos um item.');

  for (const line of input.lines) {
    if (line.incomingPurchaseQty <= 0 || line.operationalReceivedQty <= 0) {
      throw new Error('Quantidades recebidas precisam ser maiores que zero.');
    }
    if (line.variationMode === 'variacoes_fisicas' && !line.variantId) {
      throw new Error('Produto Mestre exige variante física para recebimento.');
    }
    if (line.variationMode === 'sem_variacao' && line.variantId) {
      throw new Error('Produto simples não aceita variante física para recebimento.');
    }
    if (exceedsOrderedPurchaseQty(line.orderedPurchaseQty, line.alreadyReceivedPurchaseQty, line.incomingPurchaseQty)) {
      throw new Error('Recebimento excede a quantidade pedida.');
    }
  }
}
