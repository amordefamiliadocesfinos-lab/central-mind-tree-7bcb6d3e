import { createLiveShopeeOrder } from './core-bridge.mjs';

function exactInitialState(contract) {
  const order = contract?.order;
  return order?.channel === 'shopee'
    && order?.status === 'pendente'
    && order?.operationalStatus === 'todo'
    && order?.orderType === 'stock'
    && order?.paymentStatus === 'pendente'
    && order?.saleOrigin === 'shopee_open_platform';
}

export function buildShopeeOrderCreateRequest(contract) {
  if (!contract || contract.contractStatus !== 'ready') {
    throw new TypeError('ready Shopee internal order contract is required');
  }
  if (contract.operationalWrites !== false || contract.writerAuthorized !== false) {
    throw new TypeError('F6-H contract flags are invalid');
  }
  if (!exactInitialState(contract)) {
    throw new TypeError('Shopee internal initial state diverged');
  }
  if (contract.effects?.stockAction !== null
    || contract.effects?.financialAction !== null
    || contract.effects?.crmAction !== null
    || contract.effects?.contactAction !== null
    || contract.effects?.productionOrderAction !== null
    || contract.effects?.separationAction !== 'create_todo_record_with_order') {
    throw new TypeError('Shopee contract side-effect policy diverged');
  }
  if (!Array.isArray(contract.items) || contract.items.length === 0) {
    throw new TypeError('Shopee contract items are required');
  }

  return {
    channel_account_id: contract.order.channelAccountId,
    marketplace_account: contract.order.marketplaceAccount,
    order_number: contract.order.orderNumber,
    order_date: contract.order.orderDate,
    total_value: contract.order.totalValue,
    payment_method: contract.order.paymentMethod,
    external_status: contract.order.marketplaceMetadata?.externalStatus ?? null,
    buyer_message: contract.order.marketplaceMetadata?.buyerMessage ?? null,
    items: contract.items.map((item) => ({
      product_id: item.productId,
      variant_id: item.variantId,
      quantity: item.quantity,
      commercial_quantity: item.commercialQuantity,
      physical_multiplier: item.physicalMultiplier,
      unit_price: item.unitPrice,
      external_item_key: item.externalItemKey,
      item_id: item.itemId,
      model_id: item.modelId,
      mapping_id: item.mappingId,
      ...(item.commercialPresentationId ? { commercial_presentation_id: item.commercialPresentationId } : {}),
      composition_position: item.compositionPosition,
    })),
  };
}

export async function persistShopeeOrderContract(contract, options = {}) {
  const request = buildShopeeOrderCreateRequest(contract);
  return createLiveShopeeOrder({ ...request, ...(options.verifyExisting ? { verify_existing: true } : {}) }, options);
}

export const SHOPEE_ORDER_WRITER_CONTRACT = Object.freeze({
  writes: Object.freeze(['orders', 'order_items', 'order_separation']),
  prohibitedWrites: Object.freeze([
    'inventory',
    'inventory_movements',
    'financial_entries',
    'financial_movements',
    'contacts',
    'service_conversations',
    'production_orders',
  ]),
  initialSeparationStatus: 'todo',
  idempotency: 'channel_account_id+order_number',
});
