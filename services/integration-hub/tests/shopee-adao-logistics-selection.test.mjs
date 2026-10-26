import test from 'node:test';
import assert from 'node:assert/strict';
import { selectAdaoLogisticsOrders, ADAO_LOGISTICS_ACCOUNT } from '../src/shopee-adao-logistics-selection.mjs';

const order = (sn, logistics, status = 'READY_TO_SHIP') => ({
  order_sn: sn, order_status: status,
  package_list: [{ package_number: 'PKG123', logistics_status: logistics }],
});
const select = (orders, deletedOrderSns = new Set()) =>
  selectAdaoLogisticsOrders({
    channelAccountId: ADAO_LOGISTICS_ACCOUNT.channel_account_id,
    shopId: ADAO_LOGISTICS_ACCOUNT.shop_id, orders, deletedOrderSns,
  });

test('separates an unprepared order, prepared label, shipped and deleted without I/O', () => {
  const r = select([
    order('261027N7HVNRKQ', 'LOGISTICS_READY'),
    order('261027ABCDEF12', 'LOGISTICS_REQUEST_CREATED'),
    order('261027DJN3D920', 'LOGISTICS_PICKUP_DONE', 'SHIPPED'),
    order('261023C0CDYM5H', 'LOGISTICS_READY'),
  ], new Set(['261023C0CDYM5H']));
  assert.equal(r.ok, true);
  assert.deepEqual(r.selected.map(x => x.state), [
    'AGUARDANDO_ORGANIZACAO', 'ENVIO_JA_ORGANIZADO', 'EXPEDIDO', 'BLOQUEADO',
  ]);
  assert.ok(r.selected.every(x => !x.auto_arrangement_authorized &&
    !x.create_shipping_document_authorized && !x.inventory_mutation_authorized));
});

test('cannot select without tombstone evidence or correct account', () => {
  const orders = [order('261027ABCDEF12', 'LOGISTICS_READY')];
  assert.equal(selectAdaoLogisticsOrders({
    channelAccountId: ADAO_LOGISTICS_ACCOUNT.channel_account_id,
    shopId: ADAO_LOGISTICS_ACCOUNT.shop_id, orders,
  }).code, 'tombstone_evidence_required');
  assert.equal(selectAdaoLogisticsOrders({
    channelAccountId: 'wrong', shopId: ADAO_LOGISTICS_ACCOUNT.shop_id,
    orders, deletedOrderSns: new Set(),
  }).code, 'account_identity_mismatch');
});

test('duplicate and ambiguous orders fail closed', () => {
  const a = order('261027ABCDEF12', 'LOGISTICS_READY');
  assert.equal(select([a, a]).code, 'invalid_or_duplicate_order_identity');
  assert.equal(select([order('261027ABCDEF12', 'UNKNOWN')]).selected[0].state, 'INDETERMINADO');
  assert.equal(select([{ ...a, package_list: [] }]).selected[0].state, 'INDETERMINADO');
});

test('fiscal pendency blocks the CPF operational path', () => {
  const r = select([{ ...order('261027ABCDEF12', 'LOGISTICS_READY'), invoice_data: { status: 'pending' } }]);
  assert.equal(r.selected[0].state, 'BLOQUEADO');
});
