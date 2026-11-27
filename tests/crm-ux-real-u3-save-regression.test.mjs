import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/crm/InboxSaleDialog.tsx', 'utf8');

test('CRM U3: bloqueio síncrono contra duplo envio preserva request key', () => {
  assert.match(source, /if \(saveInFlightRef\.current\) return;/);
  assert.match(source, /saveInFlightRef\.current = true;/);
  assert.match(source, /saveInFlightRef\.current = false;/);
  assert.match(source, /sale_request_key: saleRequestKeyRef\.current/);
});

test('CRM U3: custo secundário falho não transforma venda confirmada em falha de pedido', () => {
  const start = source.indexOf('if (registerLogisticsCost) {\n        try {');
  const end = source.indexOf('const documentResults', start);
  assert.ok(start >= 0 && end > start, 'custo logístico deve ser isolado após a confirmação do Pedido');
  const block = source.slice(start, end);
  assert.match(block, /await upsertOrderLogisticsExpense/);
  assert.match(block, /catch \(logisticsError\)/);
  assert.match(block, /Venda registrada, mas o custo logístico não foi confirmado/);
  assert.match(source.slice(end), /toast\.success\(result\.already_registered/);
});

test('CRM U3: progresso distingue Pedido de finalização secundária', () => {
  assert.match(source, /setSavePhase\('order'\)/);
  assert.match(source, /setSavePhase\('extras'\)/);
  assert.match(source, /Registrando pedido\.\.\./);
  assert.match(source, /Finalizando documentos e custos\.\.\./);
});
