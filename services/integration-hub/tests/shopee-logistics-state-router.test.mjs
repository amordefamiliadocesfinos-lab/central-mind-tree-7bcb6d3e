import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyShopeeLogistics } from '../src/shopee-logistics-state-router.mjs';

const base = (order_status, logistics_status, invoice_data) => ({
  order_sn: '261027TEST0001', order_status,
  package_list: [{ package_number: 'PKG123', logistics_status }],
  ...(invoice_data === undefined ? {} : { invoice_data }),
});
const classify = (order, opts = {}) => classifyShopeeLogistics(order, {
  fiscalMode: 'cpf_no_invoice_step', ...opts,
});

test('prepared and unprepared orders take distinct read-only paths', () => {
  assert.equal(classify(base('READY_TO_SHIP', 'LOGISTICS_READY')).state, 'AGUARDANDO_ORGANIZACAO');
  assert.equal(classify(base('READY_TO_SHIP', 'LOGISTICS_PICKUP_RETRY')).state, 'AGUARDANDO_ORGANIZACAO');
  assert.equal(classify(base('READY_TO_SHIP', 'LOGISTICS_REQUEST_CREATED')).state, 'ENVIO_JA_ORGANIZADO');
});

test('shipped orders are not routed to preparation regardless of package', () => {
  assert.equal(classify(base('SHIPPED', 'LOGISTICS_PICKUP_DONE')).state, 'EXPEDIDO');
  assert.equal(classify(base('READY_TO_SHIP', 'LOGISTICS_PICKUP_DONE')).state, 'EXPEDIDO');
  assert.equal(classify(base('COMPLETED', 'LOGISTICS_DELIVERY_DONE')).state, 'EXPEDIDO');
});

test('cancelled, unpaid and deleted orders are blocked', () => {
  assert.equal(classify(base('CANCELLED', 'LOGISTICS_READY')).state, 'BLOQUEADO');
  assert.equal(classify(base('UNPAID', 'LOGISTICS_READY')).state, 'BLOQUEADO');
  assert.equal(classify(base('READY_TO_SHIP', 'LOGISTICS_READY'), { deleted: true }).reason, 'historically_deleted');
  assert.equal(classify({ ...base('READY_TO_SHIP', 'LOGISTICS_READY'), deleted_at: '2026-10-26' }).state, 'BLOQUEADO');
});

test('unknown, missing or multiple packages fail closed', () => {
  assert.equal(classify({ ...base('READY_TO_SHIP', 'LOGISTICS_READY'), package_list: [] }).state, 'INDETERMINADO');
  assert.equal(classify({ ...base('READY_TO_SHIP', 'LOGISTICS_READY'), package_list: [{}, {}] }).state, 'INDETERMINADO');
  assert.equal(classify(base('READY_TO_SHIP', 'MYSTERY')).state, 'INDETERMINADO');
  assert.equal(classify({ ...base('READY_TO_SHIP', 'LOGISTICS_READY'), package_list: [{ logistics_status: 'LOGISTICS_READY' }] }).state, 'INDETERMINADO');
});

test('fiscal modes apply existing preflight rules and do not imply tax exemption', () => {
  assert.equal(classify(base('READY_TO_SHIP', 'LOGISTICS_READY'), { fiscalMode: 'pj_shopee_issuer' }).state, 'BLOQUEADO');
  assert.equal(classify(base('READY_TO_SHIP', 'LOGISTICS_READY', { status: 'valid' }), { fiscalMode: 'pj_shopee_issuer' }).state, 'AGUARDANDO_ORGANIZACAO');
  assert.equal(classify(base('READY_TO_SHIP', 'LOGISTICS_READY', { status: 'pending' })).state, 'BLOQUEADO');
});

test('classification never authorizes shipping, document creation or inventory changes', () => {
  for (const order of [
    base('READY_TO_SHIP', 'LOGISTICS_READY'),
    base('READY_TO_SHIP', 'LOGISTICS_REQUEST_CREATED'),
    base('SHIPPED', 'LOGISTICS_PICKUP_DONE'),
    base('CANCELLED', 'LOGISTICS_READY'),
    base('READY_TO_SHIP', 'UNKNOWN'),
  ]) {
    const outcome = classify(order);
    assert.equal(outcome.auto_arrangement_authorized, false);
    assert.equal(outcome.create_shipping_document_authorized, false);
    assert.equal(outcome.inventory_mutation_authorized, false);
  }
});
