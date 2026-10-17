import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildShopeeOrderSafePreview,
  normalizeShopeeOrderDetailPayload,
  normalizeShopeeOrderRawSnapshot,
  SHOPEE_ORDER_NORMALIZATION_CONTRACT,
} from '../src/shopee-order-normalizer.mjs';

const PAYLOAD = {
  error: '',
  message: '',
  request_id: 'req-detail-safe',
  response: {
    order_list: [{
      order_sn: '260101ABC',
      order_status: 'READY_TO_SHIP',
      create_time: 1760270400,
      update_time: 1760274000,
      pay_time: 1760271000,
      ship_by_date: 1760356800,
      currency: 'BRL',
      total_amount: 159.9,
      payment_method: 'Credit Card',
      shipping_carrier: 'Shopee Xpress',
      recipient_address: {
        name: 'PII MUST NOT LEAK',
        phone: '000000000',
        full_address: 'PII MUST NOT LEAK',
      },
      package_list: [{ package_number: 'PKG-1' }],
      item_list: [{
        item_id: 21798187490,
        model_id: 987654321,
        item_sku: 'TRUFA-40',
        model_sku: 'BRIG-30',
        item_name: 'Trufa 40g',
        model_name: 'Brigadeiro 30un',
        model_quantity_purchased: 2,
        model_original_price: 89.9,
        model_discounted_price: 79.95,
        weight: 1.2,
      }],
      buyer_username: 'PII MUST NOT LEAK',
      buyer_cpf_id: 'PII MUST NOT LEAK',
      dropshipper_phone: 'PII MUST NOT LEAK',
    }],
  },
};

test('normalizes real Shopee order identifiers/status/items without operational projection', () => {
  const result = normalizeShopeeOrderDetailPayload(PAYLOAD, {
    channelAccountId: '8a8ad166-0317-4597-8be6-e43fb46b4d1b',
    observedAt: '2026-10-13T20:00:00.000Z',
    externalEntityId: '260101ABC',
  });

  assert.equal(result.source, 'shopee_open_platform');
  assert.equal(result.environment, 'live');
  assert.equal(result.piiSuppressed, true);
  assert.equal(result.orderCount, 1);
  assert.equal(result.orders[0].orderSn, '260101ABC');
  assert.equal(result.orders[0].externalStatus, 'READY_TO_SHIP');
  assert.equal(result.orders[0].items[0].itemId, '21798187490');
  assert.equal(result.orders[0].items[0].modelId, '987654321');
  assert.equal(result.orders[0].items[0].quantity, 2);
  const order = result.orders[0];
  assert.equal(order.createdAt, new Date(PAYLOAD.response.order_list[0].create_time * 1000).toISOString());
  assert.equal(order.updatedAt, new Date(PAYLOAD.response.order_list[0].update_time * 1000).toISOString());
  assert.equal(order.paidAt, new Date(PAYLOAD.response.order_list[0].pay_time * 1000).toISOString());
  assert.equal(order.shipByDate, new Date(PAYLOAD.response.order_list[0].ship_by_date * 1000).toISOString());
  assert.equal(order.currency, 'BRL');
  assert.equal(order.totalAmount, 159.9);
  assert.equal(order.paymentMethod, 'Credit Card');
  assert.equal(order.shippingCarrier, 'Shopee Xpress');
  assert.equal(order.packageCount, 1);
  assert.equal(order.itemCount, 1);
  assert.equal(order.items[0].itemName, 'Trufa 40g');
  assert.equal(order.items[0].modelName, 'Brigadeiro 30un');
  assert.equal(order.items[0].originalUnitPrice, 89.9);
  assert.equal(order.items[0].discountedUnitPrice, 79.95);
  assert.equal(order.items[0].weight, 1.2);
  assert.deepEqual(result.orders[0].items[0].identityEvidence, {
    itemId: '21798187490',
    modelId: '987654321',
    itemSku: 'TRUFA-40',
    modelSku: 'BRIG-30',
  });

  for (const forbidden of ['order_id', 'product_id', 'variant_id', 'inventory', 'financial_entry_id', 'contact_id']) {
    assert.equal(result.orders[0][forbidden], undefined);
    assert.equal(result.orders[0].items[0][forbidden], undefined);
  }
});

test('safe preview suppresses buyer/recipient PII while preserving mapping evidence', () => {
  const preview = buildShopeeOrderSafePreview(normalizeShopeeOrderDetailPayload(PAYLOAD));
  const serialized = JSON.stringify(preview);

  assert.equal(preview.orders[0].recipientAddressAvailable, true);
  assert.equal(preview.orders[0].items[0].itemId, '21798187490');
  assert.equal(preview.orders[0].items[0].modelId, '987654321');
  assert.equal(serialized.includes('PII MUST NOT LEAK'), false);
  assert.equal(serialized.includes('000000000'), false);
  for (const forbiddenKey of ['recipient_address', 'buyer_username', 'buyer_cpf_id', 'dropshipper_phone']) {
    assert.equal(serialized.includes(forbiddenKey), false);
  }
});

test('complete preview serialization excludes unique synthetic PII and nested original payload', () => {
  const payload = structuredClone(PAYLOAD);
  const order = payload.response.order_list[0];
  const secrets = ['synthetic-name-private', 'synthetic-phone-private', 'synthetic-address-private',
    'synthetic-buyer-private', 'synthetic-cpf-private', 'synthetic-dropship-private'];
  order.recipient_address = { name: secrets[0], phone: secrets[1], full_address: secrets[2] };
  order.buyer_username = secrets[3]; order.buyer_cpf_id = secrets[4]; order.dropshipper_phone = secrets[5];
  const normalized = normalizeShopeeOrderDetailPayload(payload);
  normalized.orders[0].items[0].identityEvidence.phone = secrets[1];
  normalized.orders[0].payload = payload;
  const serialized = JSON.stringify(buildShopeeOrderSafePreview(normalized));
  for (const value of secrets) assert.equal(serialized.includes(value), false);
  for (const key of ['recipient_address', 'buyer_username', 'buyer_cpf_id', 'dropshipper_phone', 'phone', 'full_address', 'payload']) {
    assert.equal(serialized.includes(`"${key}"`), false);
  }
});

test('missing lists and external model identity remain absent without invented values', () => {
  assert.equal(normalizeShopeeOrderDetailPayload({}).orderCount, 0);
  const order = normalizeShopeeOrderDetailPayload({ response: { order_list: [{}] } }).orders[0];
  assert.equal(order.itemCount, 0); assert.equal(order.packageCount, 0);
  const item = normalizeShopeeOrderDetailPayload({ response: { order_list: [{ item_list: [{}] }] } }).orders[0].items[0];
  assert.equal(item.modelId, null); assert.equal(item.quantity, null); assert.equal(item.weight, null);
});

for (const invalid of [undefined, null, '', '   ', 'invalid', true, [], {}, Infinity]) {
  test(`invalid number and timestamp normalize to null (${String(invalid)})`, () => {
    const order = normalizeShopeeOrderDetailPayload({ response: { order_list: [{
      create_time: invalid, total_amount: invalid, item_list: [{ model_original_price: invalid }],
    }] } }).orders[0];
    assert.equal(order.createdAt, null); assert.equal(order.totalAmount, null);
    assert.equal(order.items[0].originalUnitPrice, null);
  });
}

test('out-of-range timestamp is null and string identities retain all digits', () => {
  const payload = { response: { order_list: [{ create_time: 1e100, item_list: [{
    item_id: '900719925474099312345', model_id: '900719925474099312346',
  }] }] } };
  const normalized = normalizeShopeeOrderDetailPayload(payload);
  assert.equal(normalized.orders[0].createdAt, null);
  const preview = buildShopeeOrderSafePreview(normalized);
  assert.equal(preview.orders[0].items[0].itemId, '900719925474099312345');
  assert.equal(preview.orders[0].items[0].modelId, '900719925474099312346');
});

test('normalization and preview do not mutate their inputs or retain raw references', () => {
  const payload = structuredClone(PAYLOAD); const original = JSON.stringify(payload);
  const normalized = normalizeShopeeOrderDetailPayload(payload);
  const before = JSON.stringify(normalized);
  const preview = buildShopeeOrderSafePreview(normalized);
  preview.orders[0].items[0].identityEvidence.itemId = 'changed-preview-only';
  assert.equal(JSON.stringify(payload), original);
  assert.equal(JSON.stringify(normalized), before);
});

test('normalizes only the canonical live order-detail Raw Snapshot contract', () => {
  const snapshot = {
    source: 'shopee_open_platform',
    environment: 'live',
    external_entity_type: 'order',
    endpoint: '/api/v2/order/get_order_detail',
    channel_account_id: '8a8ad166-0317-4597-8be6-e43fb46b4d1b',
    external_entity_id: '260101ABC',
    observed_at: '2026-10-13T20:00:00.000Z',
    payload: PAYLOAD,
  };

  const normalized = normalizeShopeeOrderRawSnapshot(snapshot);
  assert.equal(normalized.channelAccountId, snapshot.channel_account_id);
  assert.equal(normalized.externalEntityId, '260101ABC');

  for (const [key, value] of [
    ['source', 'shopee'],
    ['environment', 'sandbox'],
    ['external_entity_type', 'order_list'],
    ['endpoint', '/api/v2/order/get_order_list'],
  ]) {
    assert.throws(
      () => normalizeShopeeOrderRawSnapshot({ ...snapshot, [key]: value }),
      TypeError,
    );
  }
});

test('contract remains read-only and PII-suppressed', () => {
  assert.deepEqual(SHOPEE_ORDER_NORMALIZATION_CONTRACT, {
    source: 'shopee_open_platform',
    environment: 'live',
    detailEndpoint: '/api/v2/order/get_order_detail',
    operationalWrites: false,
    piiSuppressed: true,
  });
});


test('buyer message is captured for the internal projection, but omitted from safe diagnostics', () => {
  const payload = structuredClone(PAYLOAD);
  payload.response.order_list[0].message_to_seller = 'Separar o pedido com cuidado';
  const normalized = normalizeShopeeOrderDetailPayload(payload);
  assert.equal(normalized.orders[0].buyerMessage, 'Separar o pedido com cuidado');
  assert.equal(JSON.stringify(buildShopeeOrderSafePreview(normalized)).includes('Separar o pedido com cuidado'), false);
});
