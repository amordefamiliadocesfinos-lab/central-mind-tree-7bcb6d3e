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
  for (const forbiddenKey of ['recipient_address', 'buyer_username', 'buyer_cpf_id', 'dropshipper_phone']) {
    assert.equal(serialized.includes(forbiddenKey), false);
  }
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
