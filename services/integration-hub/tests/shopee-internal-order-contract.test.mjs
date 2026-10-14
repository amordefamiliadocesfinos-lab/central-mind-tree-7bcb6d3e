import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyShopeeInternalOrderContract,
  SHOPEE_INTERNAL_ORDER_CONTRACT,
} from '../src/shopee-internal-order-contract.mjs';

const CHANNEL_ACCOUNT_ID = '8a8ad166-0317-4597-8be6-e43fb46b4d1b';
const ACCOUNT = 'SHOPEE VIVIANE';

function readyProjection(overrides = {}) {
  return {
    orderSn: '261014HX0XSUQU',
    externalStatus: 'READY_TO_SHIP',
    projectionStatus: 'ready',
    blockers: [],
    duplicateStatus: 'new',
    candidate: {
      orderNumber: '261014HX0XSUQU',
      channel: 'shopee',
      channelAccountId: CHANNEL_ACCOUNT_ID,
      marketplaceAccount: ACCOUNT,
      orderDate: '2026-10-14',
      totalValue: 39.9,
      paymentMethod: 'Pix',
      internalStatus: null,
      operationalStatus: null,
      orderType: null,
      stockEvent: null,
      financialAction: null,
      crmAction: null,
      marketplaceMetadata: {
        marketplace: 'shopee',
        source: 'shopee_open_platform',
        environment: 'live',
        externalStatus: 'READY_TO_SHIP',
      },
      items: [{
        productId: '92088a70-8cc0-40ef-a39d-564603df6866',
        variantId: null,
        quantity: 1000,
        commercialQuantity: 1,
        physicalMultiplier: 1000,
        unitPrice: 39.9,
        externalItemKey: 'code:SH-002-006|variation:1 kg',
        itemId: '58261505740',
        modelId: '149554569657',
        mappingId: 'dbc15870-e45a-4fe5-a86b-114208d1b5ed',
        compositionPosition: 0,
      }],
    },
    ...overrides,
  };
}

test('defines the exact initial internal state for a new Shopee API order', () => {
  const result = applyShopeeInternalOrderContract(readyProjection());
  assert.equal(result.contractStatus, 'ready');
  assert.equal(result.writerAuthorized, false);
  assert.equal(result.operationalWrites, false);
  assert.equal(result.order.status, 'pendente');
  assert.equal(result.order.operationalStatus, 'todo');
  assert.equal(result.order.orderType, 'stock');
  assert.equal(result.order.paymentStatus, 'pendente');
  assert.equal(result.order.saleOrigin, 'shopee_open_platform');
});

test('keeps external Shopee status as metadata only', () => {
  const result = applyShopeeInternalOrderContract(readyProjection());
  assert.equal(result.order.marketplaceMetadata.externalStatus, 'READY_TO_SHIP');
  assert.equal(result.order.status, 'pendente');
  assert.equal(result.order.operationalStatus, 'todo');
});

test('creates no stock, finance, CRM, contact or production side effect', () => {
  const result = applyShopeeInternalOrderContract(readyProjection());
  assert.deepEqual(result.effects, {
    stockAction: null,
    financialAction: null,
    crmAction: null,
    contactAction: null,
    productionOrderAction: null,
    separationAction: 'create_todo_record_with_order',
  });
  assert.equal(result.policies.stock, 'internal_physical_fulfillment_only');
  assert.equal(result.policies.stockEvent, 'shipped');
  assert.equal(result.policies.stockExecutor, 'finalize_order_separation');
  assert.equal(result.policies.finance, 'deferred_marketplace_settlement');
});

test('does not treat marketplace payment as an internal paid financial fact', () => {
  const projection = readyProjection();
  projection.candidate.paymentMethod = 'Credit Card';
  projection.candidate.marketplaceMetadata.externalStatus = 'PROCESSED';
  const result = applyShopeeInternalOrderContract(projection);
  assert.equal(result.order.paymentStatus, 'pendente');
  assert.equal(result.effects.financialAction, null);
});

test('preserves physical/commercial item identity', () => {
  const item = applyShopeeInternalOrderContract(readyProjection()).items[0];
  assert.equal(item.quantity, 1000);
  assert.equal(item.commercialQuantity, 1);
  assert.equal(item.physicalMultiplier, 1000);
  assert.equal(item.itemId, '58261505740');
  assert.equal(item.modelId, '149554569657');
  assert.equal(item.mappingId, 'dbc15870-e45a-4fe5-a86b-114208d1b5ed');
});

test('derives stable account-scoped idempotency identity', () => {
  const result = applyShopeeInternalOrderContract(readyProjection());
  assert.equal(result.idempotency.key, `${CHANNEL_ACCOUNT_ID}:261014HX0XSUQU`);
  assert.deepEqual(result.idempotency.duplicateIdentity, {
    channel: 'shopee',
    channelAccountId: CHANNEL_ACCOUNT_ID,
    orderNumber: '261014HX0XSUQU',
  });
});

test('rejects blocked projection orders', () => {
  assert.throws(
    () => applyShopeeInternalOrderContract(readyProjection({
      projectionStatus: 'blocked',
      blockers: ['already_imported'],
    })),
    /only ready Shopee projection orders/,
  );
});

test('rejects invalid item quantities', () => {
  const projection = readyProjection();
  projection.candidate.items[0].quantity = 0;
  assert.throws(
    () => applyShopeeInternalOrderContract(projection),
    /physical quantity must be positive/,
  );
});

test('contract freezes stock change to internal finalization, not external status', () => {
  assert.deepEqual(SHOPEE_INTERNAL_ORDER_CONTRACT.initialState, {
    status: 'pendente',
    operationalStatus: 'todo',
    orderType: 'stock',
    paymentStatus: 'pendente',
  });
  assert.equal(SHOPEE_INTERNAL_ORDER_CONTRACT.policies.stockEvent, 'shipped');
  assert.equal(SHOPEE_INTERNAL_ORDER_CONTRACT.policies.stockExecutor, 'finalize_order_separation');
  assert.equal(SHOPEE_INTERNAL_ORDER_CONTRACT.externalStatusControlsInternalState, false);
  assert.equal(SHOPEE_INTERNAL_ORDER_CONTRACT.writerAuthorized, false);
  assert.equal(SHOPEE_INTERNAL_ORDER_CONTRACT.operationalWrites, false);
});
