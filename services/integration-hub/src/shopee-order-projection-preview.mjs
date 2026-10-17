function nullableText(value) {
  const normalized = String(value ?? '').trim();
  return normalized === '' ? null : normalized;
}

function finiteNumber(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function finitePositive(value) {
  const parsed = finiteNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function dateOnly(value) {
  const normalized = nullableText(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function lineUnitPrice(item) {
  const discounted = finiteNumber(item?.discountedUnitPrice);
  if (discounted !== null && discounted >= 0) return discounted;
  const original = finiteNumber(item?.originalUnitPrice);
  if (original !== null && original >= 0) return original;
  return null;
}

function buildProjectionLines(item) {
  if (item?.mappingStatus !== 'recognized' || !Array.isArray(item.components) || item.components.length === 0) {
    return [];
  }

  const commercialUnitPrice = lineUnitPrice(item);
  return item.components.map((component, index) => ({
    productId: nullableText(component.productId),
    variantId: nullableText(component.variantId),
    quantity: finitePositive(component.physicalQuantity),
    physicalQuantity: finitePositive(component.physicalQuantity),
    commercialQuantity: finitePositive(component.commercialQuantity),
    physicalMultiplier: finitePositive(component.physicalMultiplier),
    unitPrice: index === 0 ? commercialUnitPrice : 0,
    externalItemKey: nullableText(item.externalItemKey),
    itemId: nullableText(item.itemId),
    modelId: nullableText(item.modelId),
    mappingId: nullableText(item.mappingId),
    compositionPosition: Number.isFinite(Number(component.position)) ? Number(component.position) : index,
  }));
}

function buildBlockers(normalizedOrder, mappingOrder, duplicate) {
  const blockers = [];
  if (!nullableText(normalizedOrder?.orderSn)) blockers.push('missing_order_sn');
  if (!dateOnly(normalizedOrder?.createdAt)) blockers.push('missing_order_date');
  if (duplicate) blockers.push('already_imported');

  const normalizedItems = Array.isArray(normalizedOrder?.items) ? normalizedOrder.items : [];
  const mappedItems = Array.isArray(mappingOrder?.items) ? mappingOrder.items : [];

  if (normalizedItems.length === 0) blockers.push('no_items');
  if (normalizedItems.length !== mappedItems.length) blockers.push('mapping_item_count_mismatch');

  for (let index = 0; index < mappedItems.length; index += 1) {
    const item = mappedItems[index];
    const quantity = finitePositive(item?.quantity);
    if (!quantity) blockers.push(`item_${index}:invalid_commercial_quantity`);

    if (item?.mappingStatus !== 'recognized') {
      blockers.push(`item_${index}:mapping_${item?.mappingStatus ?? 'missing'}`);
      continue;
    }

    if (!Array.isArray(item.components) || item.components.length === 0) {
      blockers.push(`item_${index}:missing_components`);
      continue;
    }

    for (let componentIndex = 0; componentIndex < item.components.length; componentIndex += 1) {
      const component = item.components[componentIndex];
      if (!nullableText(component?.productId)) blockers.push(`item_${index}:component_${componentIndex}:missing_product`);
      if (!finitePositive(component?.physicalMultiplier)) blockers.push(`item_${index}:component_${componentIndex}:invalid_multiplier`);
      if (!finitePositive(component?.commercialQuantity) || finitePositive(component.commercialQuantity) !== quantity) {
        blockers.push(`item_${index}:invalid_commercial_quantity`);
      }
      const physicalQuantity = finitePositive(component?.physicalQuantity);
      const expectedQuantity = quantity * finitePositive(component?.physicalMultiplier);
      if (!physicalQuantity || !Number.isFinite(expectedQuantity) || physicalQuantity !== expectedQuantity) {
        blockers.push(`item_${index}:component_${componentIndex}:invalid_physical_quantity`);
      }
    }
  }

  return [...new Set(blockers)];
}

export function buildShopeeOrderProjectionPreview(
  normalizedPayload,
  mappingPreview,
  {
    marketplaceAccount,
    existingExternalOrderIds = new Set(),
  } = {},
) {
  if (!normalizedPayload || !Array.isArray(normalizedPayload.orders)) {
    throw new TypeError('normalized Shopee order payload is required');
  }
  if (!mappingPreview || !Array.isArray(mappingPreview.orders)) {
    throw new TypeError('Shopee mapping preview is required');
  }

  const account = nullableText(marketplaceAccount ?? mappingPreview.marketplaceAccount);
  if (!account) throw new TypeError('marketplaceAccount is required');

  const mappingByOrderSn = new Map(
    mappingPreview.orders.map((order) => [nullableText(order?.orderSn), order]),
  );

  const existing = existingExternalOrderIds instanceof Set
    ? existingExternalOrderIds
    : new Set(existingExternalOrderIds ?? []);

  const orders = normalizedPayload.orders.map((normalizedOrder) => {
    const orderSn = nullableText(normalizedOrder.orderSn);
    const mappingOrder = mappingByOrderSn.get(orderSn) ?? { orderSn, items: [] };
    const duplicate = orderSn ? existing.has(orderSn) : false;
    const blockers = buildBlockers(normalizedOrder, mappingOrder, duplicate);
    const lines = (mappingOrder.items ?? []).flatMap(buildProjectionLines);

    return {
      orderSn,
      externalStatus: nullableText(normalizedOrder.externalStatus),
      projectionStatus: blockers.length === 0 ? 'ready' : 'blocked',
      blockers,
      duplicateStatus: duplicate ? 'already_imported' : 'new',
      candidate: {
        orderNumber: orderSn,
        channel: 'shopee',
        channelAccountId: nullableText(normalizedPayload.channelAccountId),
        marketplaceAccount: account,
        orderDate: dateOnly(normalizedOrder.createdAt),
        totalValue: finiteNumber(normalizedOrder.totalAmount),
        paymentMethod: nullableText(normalizedOrder.paymentMethod),
        buyerMessage: nullableText(normalizedOrder.buyerMessage),
        internalStatus: null,
        operationalStatus: null,
        orderType: null,
        stockEvent: null,
        financialAction: null,
        crmAction: null,
        marketplaceMetadata: {
          marketplace: 'shopee',
          externalStatus: nullableText(normalizedOrder.externalStatus),
          source: normalizedPayload.source,
          environment: normalizedPayload.environment,
        },
        items: lines,
      },
    };
  });

  return {
    schemaVersion: 1,
    source: normalizedPayload.source,
    environment: normalizedPayload.environment,
    channelAccountId: nullableText(normalizedPayload.channelAccountId),
    marketplaceAccount: account,
    operationalWrites: false,
    writeReady: false,
    requiresInternalContract: true,
    readyCount: orders.filter((order) => order.projectionStatus === 'ready').length,
    blockedCount: orders.filter((order) => order.projectionStatus === 'blocked').length,
    orders,
  };
}

export const SHOPEE_ORDER_PROJECTION_PREVIEW_CONTRACT = Object.freeze({
  operationalWrites: false,
  writeReady: false,
  requiresInternalContract: true,
  externalStatusDoesNotSetInternalStatus: true,
  stockEvent: null,
  financialAction: null,
  crmAction: null,
  projectionStatuses: ['ready', 'blocked'],
});
