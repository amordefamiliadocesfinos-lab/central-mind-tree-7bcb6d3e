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

for (const field of ['orderNumber', 'channelAccountId', 'marketplaceAccount', 'orderDate']) {
  test(`rejects missing ${field}`, () => {
    const p = readyProjection();
    p.candidate[field] = null;
    assert.throws(() => applyShopeeInternalOrderContract(p), new RegExp(`${field} is required`));
  });
}

test('rejects ready projections with blockers and malformed blocker evidence', () => {
  for (const blockers of [['already_imported'], 'already_imported', null, {}]) {
    assert.throws(() => applyShopeeInternalOrderContract(readyProjection({ blockers })), /cannot contain blockers/);
  }
});

test('rejects absent candidate, empty items and missing product', () => {
  assert.throws(() => applyShopeeInternalOrderContract(readyProjection({ candidate: null })), /candidate is required/);
  const p = readyProjection();
  p.candidate.items = [];
  assert.throws(() => applyShopeeInternalOrderContract(p), /at least one/);
  const noProduct = readyProjection();
  noProduct.candidate.items[0].productId = null;
  assert.throws(() => applyShopeeInternalOrderContract(noProduct), /productId is required/);
});

for (const field of ['quantity', 'commercialQuantity', 'physicalMultiplier']) {
  test(`rejects nonpositive and nonnumeric ${field}`, () => {
    for (const value of [0, -1, Infinity, NaN, null, undefined, '', ' ', true, false, [], {}, 'invalid']) {
      const p = readyProjection();
      p.candidate.items[0][field] = value;
      assert.throws(() => applyShopeeInternalOrderContract(p), /must be positive/);
    }
  });
}

test('invalid prices and missing totals stay null rather than inventing zero', () => {
  for (const value of [null, undefined, '', ' ', true, false, [], {}, -1, NaN, Infinity, 'invalid']) {
    const p = readyProjection();
    p.candidate.items[0].unitPrice = value;
    p.candidate.totalValue = value;
    const result = applyShopeeInternalOrderContract(p);
    assert.equal(result.items[0].unitPrice, null);
    assert.equal(result.order.totalValue, null);
  }
  const free = readyProjection();
  free.candidate.items[0].unitPrice = 0;
  assert.equal(applyShopeeInternalOrderContract(free).items[0].unitPrice, 0);
});

test('every external status remains metadata while internal states and effects stay fixed', () => {
  for (const status of ['READY_TO_SHIP', 'PROCESSED', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'UNPAID', null]) {
    const p = readyProjection();
    p.externalStatus = status;
    p.candidate.marketplaceMetadata.externalStatus = status;
    const result = applyShopeeInternalOrderContract(p);
    assert.equal(result.order.marketplaceMetadata.externalStatus, status);
    assert.deepEqual([result.order.status, result.order.operationalStatus, result.order.orderType, result.order.paymentStatus], ['pendente', 'todo', 'stock', 'pendente']);
    assert.deepEqual([result.order.contactId, result.order.customerName, result.order.customerContact], [null, null, null]);
    for (const key of ['stockAction', 'financialAction', 'crmAction', 'contactAction', 'productionOrderAction']) assert.equal(result.effects[key], null);
    assert.equal(result.effects.separationAction, 'create_todo_record_with_order');
  }
});

test('same external order in another account has a distinct stable identity', () => {
  const first = applyShopeeInternalOrderContract(readyProjection());
  const p = readyProjection();
  p.candidate.channelAccountId = 'other-account';
  p.candidate.marketplaceAccount = 'OTHER ACCOUNT';
  const second = applyShopeeInternalOrderContract(p);
  assert.notEqual(first.idempotency.key, second.idempotency.key);
  assert.equal(first.order.orderNumber, second.order.orderNumber);
  assert.equal(second.idempotency.key, applyShopeeInternalOrderContract(p).idempotency.key);
});

test('preserves all item contract fields without manufacturing presentation or mutating inputs', () => {
  const p = readyProjection();
  const before = JSON.stringify(p);
  const result = applyShopeeInternalOrderContract(p);
  assert.deepEqual(result.items[0], p.candidate.items[0]);
  assert.equal(JSON.stringify(p), before);
  assert.equal(Object.keys(result.items[0]).some(k => /presentation/i.test(k)), false);
});


test('keeps buyer note separate from editable internal notes', () => {
  const projection = readyProjection();
  projection.candidate.buyerMessage = 'Favor embalar com cuidado';
  const result = applyShopeeInternalOrderContract(projection);
  assert.equal(result.order.marketplaceMetadata.buyerMessage, 'Favor embalar com cuidado');
  assert.equal(result.order.customerName, null);
  assert.equal(result.effects.stockAction, null);
});
