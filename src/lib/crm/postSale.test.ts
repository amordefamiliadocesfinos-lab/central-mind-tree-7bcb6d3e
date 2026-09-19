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

  it('considera atendido quando há Resultado pós-venda posterior à entrega', () => {
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
