const INITIAL_STATE = Object.freeze({
  status: 'pendente',
  operationalStatus: 'todo',
  orderType: 'stock',
  paymentStatus: 'pendente',
});

const POLICIES = Object.freeze({
  stock: 'internal_physical_fulfillment_only',
  stockEvent: 'shipped',
  stockExecutor: 'finalize_order_separation',
  finance: 'deferred_marketplace_settlement',
  crm: 'none',
  contact: 'none',
  productionOrder: 'none',
  logistics: 'unresolved_until_logistics_fact',
});

function nullableText(value) {
  const normalized = String(value ?? '').trim();
  return normalized === '' ? null : normalized;
}

function finiteNumber(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function finiteNonNegative(value) {
  const parsed = finiteNumber(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

function assertReadyProjection(order) {
  if (!order || typeof order !== 'object') throw new TypeError('projection order is required');
  if (order.projectionStatus !== 'ready') {
    throw new TypeError('only ready Shopee projection orders can enter the internal order contract');
  }
  if (!order.candidate || typeof order.candidate !== 'object') {
    throw new TypeError('projection candidate is required');
  }
  if (!Array.isArray(order.blockers) || order.blockers.length > 0) {
    throw new TypeError('ready projection cannot contain blockers');
  }
}

function normalizeLine(line, index) {
  const productId = nullableText(line?.productId);
  const quantity = finiteNumber(line?.quantity);
  const commercialQuantity = finiteNumber(line?.commercialQuantity);
  const physicalMultiplier = finiteNumber(line?.physicalMultiplier);

  if (!productId) throw new TypeError(`item_${index}: productId is required`);
  if (!Number.isFinite(quantity) || quantity <= 0) throw new TypeError(`item_${index}: physical quantity must be positive`);
  if (!Number.isFinite(commercialQuantity) || commercialQuantity <= 0) throw new TypeError(`item_${index}: commercial quantity must be positive`);
  if (!Number.isFinite(physicalMultiplier) || physicalMultiplier <= 0) throw new TypeError(`item_${index}: physical multiplier must be positive`);

  return {
    productId,
    variantId: nullableText(line?.variantId),
    quantity,
    commercialQuantity,
    physicalMultiplier,
    unitPrice: finiteNonNegative(line?.unitPrice),
    externalItemKey: nullableText(line?.externalItemKey),
    itemId: nullableText(line?.itemId),
    modelId: nullableText(line?.modelId),
    mappingId: nullableText(line?.mappingId),
    compositionPosition: Number.isFinite(Number(line?.compositionPosition))
      ? Number(line.compositionPosition)
      : index,
  };
}

export function applyShopeeInternalOrderContract(projectionOrder, {
  channelAccountId,
  marketplaceAccount,
} = {}) {
  assertReadyProjection(projectionOrder);
  const candidate = projectionOrder.candidate;

  const orderNumber = nullableText(candidate.orderNumber);
  const accountId = nullableText(channelAccountId ?? candidate.channelAccountId);
  const accountName = nullableText(marketplaceAccount ?? candidate.marketplaceAccount);
  const orderDate = nullableText(candidate.orderDate);

  if (!orderNumber) throw new TypeError('orderNumber is required');
  if (!accountId) throw new TypeError('channelAccountId is required');
  if (!accountName) throw new TypeError('marketplaceAccount is required');
  if (!orderDate) throw new TypeError('orderDate is required');

  const items = Array.isArray(candidate.items)
    ? candidate.items.map(normalizeLine)
    : [];
  if (items.length === 0) throw new TypeError('at least one internal order item is required');

  const externalStatus = nullableText(
    candidate?.marketplaceMetadata?.externalStatus ?? projectionOrder.externalStatus,
  );

  return {
    schemaVersion: 1,
    contractStatus: 'ready',
    operationalWrites: false,
    writerAuthorized: false,
    idempotency: {
      domain: 'shopee_order',
      key: `${accountId}:${orderNumber}`,
      duplicateIdentity: {
        channel: 'shopee',
        channelAccountId: accountId,
        orderNumber,
      },
    },
    order: {
      orderNumber,
      channel: 'shopee',
      channelAccountId: accountId,
      marketplaceAccount: accountName,
      status: INITIAL_STATE.status,
      operationalStatus: INITIAL_STATE.operationalStatus,
      orderType: INITIAL_STATE.orderType,
      paymentStatus: INITIAL_STATE.paymentStatus,
      orderDate,
      totalValue: finiteNonNegative(candidate.totalValue),
      paymentMethod: nullableText(candidate.paymentMethod),
      contactId: null,
      customerName: null,
      customerContact: null,
      operationalDestination: null,
      logisticsMode: null,
      saleOrigin: 'shopee_open_platform',
      marketplaceMetadata: {
        marketplace: 'shopee',
        source: nullableText(candidate?.marketplaceMetadata?.source) ?? 'shopee_open_platform',
        environment: nullableText(candidate?.marketplaceMetadata?.environment) ?? 'live',
        externalStatus,
        buyerMessage: nullableText(candidate.buyerMessage),
      },
    },
    items,
    effects: {
      stockAction: null,
      financialAction: null,
      crmAction: null,
      contactAction: null,
      productionOrderAction: null,
      separationAction: 'create_todo_record_with_order',
    },
    policies: { ...POLICIES },
  };
}

export const SHOPEE_INTERNAL_ORDER_CONTRACT = Object.freeze({
  initialState: INITIAL_STATE,
  policies: POLICIES,
  writerAuthorized: false,
  operationalWrites: false,
  externalStatusControlsInternalState: false,
});
