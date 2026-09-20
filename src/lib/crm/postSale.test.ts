import { describe, expect, it } from 'vitest';
import { calculatePostSaleEligibility } from './postSale';

describe('calculatePostSaleEligibility', () => {
  const now = new Date('2026-09-19T12:00:00-03:00');

  it('abre sinal somente para pedido finalizado com entrega já atingida', () => {
    const signal = calculatePostSaleEligibility([
      { id: 'order-1', deliveryDate: '2026-09-18', operationalStatus: 'finalized', status: 'concluido' },
    ], [], now);

    expect(signal.eligible).toBe(true);
    expect(signal.orderId).toBe('order-1');
  });

  it('não abre sinal para entrega futura', () => {
    const signal = calculatePostSaleEligibility([
      { id: 'order-1', deliveryDate: '2026-09-23', operationalStatus: 'finalized', status: 'concluido' },
    ], [], now);

    expect(signal.eligible).toBe(false);
    expect(signal.orderId).toBeNull();
  });

  it('não abre sinal para pedido ainda em preparação', () => {
    const signal = calculatePostSaleEligibility([
      { id: 'order-1', deliveryDate: '2026-09-18', operationalStatus: 'preparing', status: 'pendente' },
    ], [], now);

    expect(signal.eligible).toBe(false);
  });

  it('considera atendido quando Resultado identificado pertence ao mesmo pedido', () => {
    const signal = calculatePostSaleEligibility([
      { id: 'order-1', deliveryDate: '2026-09-18', operationalStatus: 'finalized', status: 'concluido' },
    ], [
      { interactionDate: '2026-09-18T15:00:00-03:00', resultCode: 'CRM-RES-026', postSaleOrderId: 'order-1' },
    ], now);

    expect(signal.eligible).toBe(false);
    expect(signal.orderId).toBe('order-1');
  });

  it('não deixa Resultado identificado de outro pedido encerrar o pedido atual', () => {
    const signal = calculatePostSaleEligibility([
      { id: 'order-b', deliveryDate: '2026-09-11', operationalStatus: 'finalized', status: 'concluido' },
      { id: 'order-a', deliveryDate: '2026-09-10', operationalStatus: 'finalized', status: 'concluido' },
    ], [
      { interactionDate: '2026-09-12T10:00:00-03:00', resultCode: 'CRM-RES-026', postSaleOrderId: 'order-a' },
    ], now);

    expect(signal.eligible).toBe(true);
    expect(signal.orderId).toBe('order-b');
  });

  it('preserva fallback temporal para Resultado legado sem identidade do pedido', () => {
    const signal = calculatePostSaleEligibility([
      { id: 'order-1', deliveryDate: '2026-09-18', operationalStatus: 'finalized', status: 'concluido' },
    ], [
      { interactionDate: '2026-09-18T15:00:00-03:00', resultCode: 'CRM-RES-026' },
    ], now);

    expect(signal.eligible).toBe(false);
    expect(signal.orderId).toBe('order-1');
  });

  it('não deixa um pós-venda antigo cobrir uma entrega nova', () => {
    const signal = calculatePostSaleEligibility([
      { id: 'order-new', deliveryDate: '2026-09-18', operationalStatus: 'finalized', status: 'concluido' },
      { id: 'order-old', deliveryDate: '2026-08-10', operationalStatus: 'finalized', status: 'concluido' },
    ], [
      { interactionDate: '2026-08-12T10:00:00-03:00', resultCode: 'CRM-RES-026' },
    ], now);

    expect(signal.eligible).toBe(true);
    expect(signal.orderId).toBe('order-new');
  });
});
