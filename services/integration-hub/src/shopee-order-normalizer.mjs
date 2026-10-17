const SOURCE = 'shopee_open_platform';
const ENVIRONMENT = 'live';
const DETAIL_ENDPOINT = '/api/v2/order/get_order_detail';

function text(value) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function nullableText(value) {
  const normalized = text(value);
  return normalized === '' ? null : normalized;
}

function finiteNumber(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || text(value) === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function epochSecondsToIso(value) {
  const seconds = finiteNumber(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const date = new Date(seconds * 1000);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function itemIdentityEvidence(item) {
  return {
    itemId: nullableText(item?.item_id),
    modelId: nullableText(item?.model_id),
    itemSku: nullableText(item?.item_sku),
    modelSku: nullableText(item?.model_sku),
  };
}

function normalizeItem(item, index) {
  const evidence = itemIdentityEvidence(item);
  return {
    index,
    itemId: evidence.itemId,
    modelId: evidence.modelId,
    itemSku: evidence.itemSku,
    modelSku: evidence.modelSku,
    itemName: nullableText(item?.item_name),
    modelName: nullableText(item?.model_name),
    quantity: finiteNumber(item?.model_quantity_purchased),
    originalUnitPrice: finiteNumber(item?.model_original_price),
    discountedUnitPrice: finiteNumber(item?.model_discounted_price),
    weight: finiteNumber(item?.weight),
    identityEvidence: evidence,
  };
}

function normalizeOrder(order, index) {
  const items = array(order?.item_list).map(normalizeItem);
  const packages = array(order?.package_list);
  return {
    index,
    orderSn: nullableText(order?.order_sn),
    externalStatus: nullableText(order?.order_status),
    createdAt: epochSecondsToIso(order?.create_time),
    updatedAt: epochSecondsToIso(order?.update_time),
    paidAt: epochSecondsToIso(order?.pay_time),
    shipByDate: epochSecondsToIso(order?.ship_by_date),
    currency: nullableText(order?.currency),
    totalAmount: finiteNumber(order?.total_amount),
    buyerMessage: nullableText(order?.message_to_seller),
    paymentMethod: nullableText(order?.payment_method),
    shippingCarrier: nullableText(order?.shipping_carrier),
    packageCount: packages.length,
    itemCount: items.length,
    hasRecipientAddress: Boolean(order?.recipient_address && typeof order.recipient_address === 'object'),
    items,
  };
}

function validateEnvelope(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new TypeError('snapshot must be an object');
  }
  if (snapshot.source !== SOURCE) throw new TypeError('snapshot source must be shopee_open_platform');
  if (snapshot.environment !== ENVIRONMENT) throw new TypeError('snapshot environment must be live');
  if (snapshot.external_entity_type !== 'order') throw new TypeError('snapshot must be an order detail snapshot');
  if (snapshot.endpoint !== DETAIL_ENDPOINT) throw new TypeError('snapshot endpoint must be get_order_detail');
  if (!snapshot.payload || typeof snapshot.payload !== 'object' || Array.isArray(snapshot.payload)) {
    throw new TypeError('snapshot payload must be an object');
  }
}

export function normalizeShopeeOrderDetailPayload(payload, {
  channelAccountId = null,
  observedAt = null,
  externalEntityId = null,
} = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('payload must be an object');
  }

  const orders = array(payload?.response?.order_list).map(normalizeOrder);
  return {
    schemaVersion: 1,
    source: SOURCE,
    environment: ENVIRONMENT,
    endpoint: DETAIL_ENDPOINT,
    channelAccountId: nullableText(channelAccountId),
    externalEntityId: nullableText(externalEntityId),
    requestId: nullableText(payload?.request_id),
    observedAt: nullableText(observedAt),
    piiSuppressed: true,
    orderCount: orders.length,
    orders,
  };
}

export function normalizeShopeeOrderRawSnapshot(snapshot) {
  validateEnvelope(snapshot);
  return normalizeShopeeOrderDetailPayload(snapshot.payload, {
    channelAccountId: snapshot.channel_account_id,
    observedAt: snapshot.observed_at ?? snapshot.created_at,
    externalEntityId: snapshot.external_entity_id,
  });
}

export function buildShopeeOrderSafePreview(normalized) {
  if (!normalized || typeof normalized !== 'object' || !Array.isArray(normalized.orders)) {
    throw new TypeError('normalized Shopee order payload is required');
  }

  return {
    schemaVersion: normalized.schemaVersion,
    source: normalized.source,
    environment: normalized.environment,
    channelAccountId: normalized.channelAccountId,
    requestId: normalized.requestId,
    observedAt: normalized.observedAt,
    piiSuppressed: true,
    orders: normalized.orders.map((order) => ({
      orderSn: order.orderSn,
      externalStatus: order.externalStatus,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      paidAt: order.paidAt,
      shipByDate: order.shipByDate,
      currency: order.currency,
      totalAmount: order.totalAmount,
      shippingCarrier: order.shippingCarrier,
      paymentMethod: order.paymentMethod,
      packageCount: order.packageCount,
      itemCount: order.itemCount,
      recipientAddressAvailable: order.hasRecipientAddress === true,
      items: order.items.map((item) => ({
        itemId: item.itemId,
        modelId: item.modelId,
        itemSku: item.itemSku,
        modelSku: item.modelSku,
        itemName: item.itemName,
        modelName: item.modelName,
        quantity: item.quantity,
        originalUnitPrice: item.originalUnitPrice,
        discountedUnitPrice: item.discountedUnitPrice,
        identityEvidence: {
          itemId: item.identityEvidence?.itemId,
          modelId: item.identityEvidence?.modelId,
          itemSku: item.identityEvidence?.itemSku,
          modelSku: item.identityEvidence?.modelSku,
        },
      })),
    })),
  };
}

export const SHOPEE_ORDER_NORMALIZATION_CONTRACT = Object.freeze({
  source: SOURCE,
  environment: ENVIRONMENT,
  detailEndpoint: DETAIL_ENDPOINT,
  operationalWrites: false,
  piiSuppressed: true,
});
