import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildShopeeOrderCreateRequest,
  SHOPEE_ORDER_WRITER_CONTRACT,
} from '../src/shopee-order-writer.mjs';

function readyContract() {
  return {
    contractStatus: 'ready',
    operationalWrites: false,
    writerAuthorized: false,
    order: {
      orderNumber: '261014HX0XSUQU',
      channel: 'shopee',
      channelAccountId: '8a8ad166-0317-4597-8be6-e43fb46b4d1b',
      marketplaceAccount: 'SHOPEE VIVIANE',
      status: 'pendente',
      operationalStatus: 'todo',
      orderType: 'stock',
      paymentStatus: 'pendente',
      orderDate: '2026-10-14',
      totalValue: 39.9,
      paymentMethod: 'Pix',
      saleOrigin: 'shopee_open_platform',
      marketplaceMetadata: {
        externalStatus: 'READY_TO_SHIP',
      },
    },
    effects: {
      stockAction: null,
      financialAction: null,
      crmAction: null,
      contactAction: null,
      productionOrderAction: null,
      separationAction: 'create_todo_record_with_order',
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
  };
}

test('builds the exact narrow Core Bridge writer payload', () => {
  const request = buildShopeeOrderCreateRequest(readyContract());
  assert.deepEqual(request, {
    channel_account_id: '8a8ad166-0317-4597-8be6-e43fb46b4d1b',
    marketplace_account: 'SHOPEE VIVIANE',
    order_number: '261014HX0XSUQU',
    order_date: '2026-10-14',
    total_value: 39.9,
    payment_method: 'Pix',
    external_status: 'READY_TO_SHIP',
    buyer_message: null,
    items: [{
      product_id: '92088a70-8cc0-40ef-a39d-564603df6866',
      variant_id: null,
      quantity: 1000,
      commercial_quantity: 1,
      physical_multiplier: 1000,
      unit_price: 39.9,
      external_item_key: 'code:SH-002-006|variation:1 kg',
      item_id: '58261505740',
      model_id: '149554569657',
      mapping_id: 'dbc15870-e45a-4fe5-a86b-114208d1b5ed',
      composition_position: 0,
    }],
  });
  for (const forbidden of [
    'status',
    'operational_status',
    'order_type',
    'payment_status',
    'stock_event',
    'financial_action',
    'crm_action',
    'contact_id',
  ]) {
    assert.equal(request[forbidden], undefined);
  }
});

test('rejects any drift in the frozen internal initial state', () => {
  for (const mutate of [
    (c) => { c.order.status = 'enviado'; },
    (c) => { c.order.operationalStatus = 'finalized'; },
    (c) => { c.order.orderType = 'production'; },
    (c) => { c.order.paymentStatus = 'pago'; },
    (c) => { c.order.saleOrigin = 'operacoes'; },
  ]) {
    const contract = readyContract();
    mutate(contract);
    assert.throws(() => buildShopeeOrderCreateRequest(contract), /initial state diverged/);
  }
});

test('rejects side-effect drift before any Core Bridge call can be built', () => {
  for (const key of ['stockAction', 'financialAction', 'crmAction', 'contactAction', 'productionOrderAction', 'separationAction']) {
    const contract = readyContract();
    contract.effects[key] = 'invalid';
    assert.throws(() => buildShopeeOrderCreateRequest(contract), /side-effect policy diverged/);
  }
});

test('rejects non-ready contracts, flag drift and empty items', () => {
  for (const mutate of [
    c => { c.contractStatus = 'blocked'; },
    c => { c.operationalWrites = true; },
    c => { c.writerAuthorized = true; },
    c => { c.items = []; },
  ]) {
    const c = readyContract(); mutate(c);
    assert.throws(() => buildShopeeOrderCreateRequest(c), TypeError);
  }
});

test('writer scope is only Pedido + items + Separação TODO', () => {
  assert.deepEqual(SHOPEE_ORDER_WRITER_CONTRACT.writes, [
    'orders',
    'order_items',
    'order_separation',
  ]);
  assert.equal(SHOPEE_ORDER_WRITER_CONTRACT.initialSeparationStatus, 'todo');
  assert.equal(SHOPEE_ORDER_WRITER_CONTRACT.idempotency, 'channel_account_id+order_number');
  for (const table of [
    'inventory',
    'inventory_movements',
    'financial_entries',
    'financial_movements',
    'contacts',
    'service_conversations',
    'production_orders',
  ]) {
    assert.ok(SHOPEE_ORDER_WRITER_CONTRACT.prohibitedWrites.includes(table));
  }
});
