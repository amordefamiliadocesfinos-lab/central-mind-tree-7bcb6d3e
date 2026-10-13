import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildShopeeOrderProjectionPreview,
  SHOPEE_ORDER_PROJECTION_PREVIEW_CONTRACT,
} from '../src/shopee-order-projection-preview.mjs';

const CHANNEL_ACCOUNT_ID = '8a8ad166-0317-4597-8be6-e43fb46b4d1b';
const ACCOUNT = 'SHOPEE VIVIANE';

function normalizedPayload() {
  return {
    source: 'shopee_open_platform',
    environment: 'live',
    channelAccountId: CHANNEL_ACCOUNT_ID,
    orders: [
      {
        orderSn: 'ORDER-ALFAJOR',
        externalStatus: 'READY_TO_SHIP',
        createdAt: '2026-10-13T20:00:00.000Z',
        totalAmount: 59.9,
        paymentMethod: 'Credit Card',
        items: [{
          itemId: '23298665306',
          modelId: '0',
          itemName: 'Alfajor 60g - Kit com 6 UNI. | SH-002-015',
          modelName: null,
          quantity: 2,
          originalUnitPrice: 29.95,
          discountedUnitPrice: 29.95,
        }],
      },
      {
        orderSn: 'ORDER-GLUCODRY',
        externalStatus: 'PROCESSED',
        createdAt: '2026-10-14T01:00:00.000Z',
        totalAmount: 39.9,
        paymentMethod: 'Pix',
        items: [{
          itemId: '58261505740',
          modelId: '149554569657',
          itemName: 'Glucose de Milho desidratada em Pó | SH-002-006',
          modelName: '1 Kg',
          quantity: 1,
          originalUnitPrice: 39.9,
          discountedUnitPrice: 39.9,
        }],
      },
    ],
  };
}

function mappingPreview() {
  return {
    source: 'shopee_open_platform',
    environment: 'live',
    channelAccountId: CHANNEL_ACCOUNT_ID,
    marketplaceAccount: ACCOUNT,
    operationalWrites: false,
    orders: [
      {
        orderSn: 'ORDER-ALFAJOR',
        externalStatus: 'READY_TO_SHIP',
        items: [{
          itemId: '23298665306',
          modelId: '0',
          quantity: 2,
          externalItemKey: 'code:SH-002-015|variation:',
          mappingStatus: 'recognized',
          mappingId: 'map-alfajor',
          components: [
            {
              productId: 'alfajor',
              variantId: 'branco',
              physicalMultiplier: 3,
              commercialQuantity: 2,
              physicalQuantity: 6,
              position: 0,
            },
            {
              productId: 'alfajor',
              variantId: 'meio-amargo',
              physicalMultiplier: 3,
              commercialQuantity: 2,
              physicalQuantity: 6,
              position: 1,
            },
          ],
          discountedUnitPrice: 29.95,
          originalUnitPrice: 29.95,
        }],
      },
      {
        orderSn: 'ORDER-GLUCODRY',
        externalStatus: 'PROCESSED',
        items: [{
          itemId: '58261505740',
          modelId: '149554569657',
          quantity: 1,
          externalItemKey: 'code:SH-002-006|variation:1 kg',
          mappingStatus: 'recognized',
          mappingId: 'map-glucodry',
          components: [{
            productId: 'glucodry',
            variantId: null,
            physicalMultiplier: 1000,
            commercialQuantity: 1,
            physicalQuantity: 1000,
            position: 0,
          }],
          discountedUnitPrice: 39.9,
          originalUnitPrice: 39.9,
        }],
      },
    ],
  };
}

test('builds ready internal order candidates without assigning internal status or operational effects', () => {
  const preview = buildShopeeOrderProjectionPreview(normalizedPayload(), mappingPreview(), {
    marketplaceAccount: ACCOUNT,
  });

  assert.equal(preview.readyCount, 2);
  assert.equal(preview.blockedCount, 0);
  assert.equal(preview.writeReady, false);
  assert.equal(preview.requiresInternalContract, true);

  for (const order of preview.orders) {
    assert.equal(order.projectionStatus, 'ready');
    assert.equal(order.candidate.channel, 'shopee');
    assert.equal(order.candidate.marketplaceAccount, ACCOUNT);
    assert.equal(order.candidate.internalStatus, null);
    assert.equal(order.candidate.operationalStatus, null);
    assert.equal(order.candidate.orderType, null);
    assert.equal(order.candidate.stockEvent, null);
    assert.equal(order.candidate.financialAction, null);
    assert.equal(order.candidate.crmAction, null);
    assert.equal(order.candidate.marketplaceMetadata.externalStatus, order.externalStatus);
  }
});

test('expands mapping composition into physical candidate lines while preserving commercial quantity', () => {
  const preview = buildShopeeOrderProjectionPreview(normalizedPayload(), mappingPreview(), {
    marketplaceAccount: ACCOUNT,
  });
  const alfajor = preview.orders[0].candidate.items;

  assert.equal(alfajor.length, 2);
  assert.equal(alfajor[0].quantity, 6);
  assert.equal(alfajor[1].quantity, 6);
  assert.equal(alfajor[0].commercialQuantity, 2);
  assert.equal(alfajor[1].commercialQuantity, 2);
  assert.equal(alfajor[0].unitPrice, 29.95);
  assert.equal(alfajor[1].unitPrice, 0);
  assert.equal(alfajor[0].itemId, '23298665306');
  assert.equal(alfajor[0].modelId, '0');
});

test('blocks duplicate external orders without mutating the candidate payload', () => {
  const preview = buildShopeeOrderProjectionPreview(normalizedPayload(), mappingPreview(), {
    marketplaceAccount: ACCOUNT,
    existingExternalOrderIds: new Set(['ORDER-ALFAJOR']),
  });

  assert.equal(preview.orders[0].projectionStatus, 'blocked');
  assert.equal(preview.orders[0].duplicateStatus, 'already_imported');
  assert.deepEqual(preview.orders[0].blockers, ['already_imported']);
  assert.equal(preview.orders[1].projectionStatus, 'ready');
});

test('blocks unresolved mapping instead of inventing an internal product', () => {
  const mappings = mappingPreview();
  mappings.orders[0].items[0] = {
    ...mappings.orders[0].items[0],
    mappingStatus: 'needs_mapping',
    components: [],
  };

  const preview = buildShopeeOrderProjectionPreview(normalizedPayload(), mappings, {
    marketplaceAccount: ACCOUNT,
  });

  assert.equal(preview.orders[0].projectionStatus, 'blocked');
  assert.deepEqual(preview.orders[0].blockers, ['item_0:mapping_needs_mapping']);
  assert.equal(preview.orders[0].candidate.items.length, 0);
});

test('blocks invalid physical composition', () => {
  const mappings = mappingPreview();
  mappings.orders[1].items[0].components[0].physicalQuantity = 0;

  const preview = buildShopeeOrderProjectionPreview(normalizedPayload(), mappings, {
    marketplaceAccount: ACCOUNT,
  });

  assert.equal(preview.orders[1].projectionStatus, 'blocked');
  assert.ok(preview.orders[1].blockers.includes('item_0:component_0:invalid_physical_quantity'));
});

test('does not map external Shopee status to internal order status', () => {
  const preview = buildShopeeOrderProjectionPreview(normalizedPayload(), mappingPreview(), {
    marketplaceAccount: ACCOUNT,
  });

  assert.equal(preview.orders[0].externalStatus, 'READY_TO_SHIP');
  assert.equal(preview.orders[0].candidate.internalStatus, null);
  assert.equal(preview.orders[0].candidate.operationalStatus, null);
});

test('blocks a candidate with no valid order date', () => {
  const normalized = normalizedPayload();
  normalized.orders[0].createdAt = null;
  const preview = buildShopeeOrderProjectionPreview(normalized, mappingPreview(), {
    marketplaceAccount: ACCOUNT,
  });

  assert.equal(preview.orders[0].projectionStatus, 'blocked');
  assert.ok(preview.orders[0].blockers.includes('missing_order_date'));
});

test('contract is preview-only and side-effect free by design', () => {
  assert.deepEqual(SHOPEE_ORDER_PROJECTION_PREVIEW_CONTRACT, {
    operationalWrites: false,
    writeReady: false,
    requiresInternalContract: true,
    externalStatusDoesNotSetInternalStatus: true,
    stockEvent: null,
    financialAction: null,
    crmAction: null,
    projectionStatuses: ['ready', 'blocked'],
  });
});
