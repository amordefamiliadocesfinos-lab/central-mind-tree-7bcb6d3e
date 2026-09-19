import { describe, expect, it } from 'vitest';
import { calculateRepurchaseSignal, type RepurchaseOrder } from './repurchase';
import type { CrmAiContext } from './aiContext';

const now = new Date('2026-09-10T12:00:00.000Z');
const order = (date: string, id: string): RepurchaseOrder => ({
  id,
  orderDate: date,
  status: 'concluido',
  paymentStatus: 'pago',
  productIds: ['p1'],
});

const monthly = [
  order('2026-05-10', 'o1'),
  order('2026-06-09', 'o2'),
  order('2026-07-10', 'o3'),
  order('2026-08-09', 'o4'),
];

function context(overrides: Partial<CrmAiContext> = {}): CrmAiContext {
  return {
    generatedAt: now.toISOString(),
    contact: { id: 'c1', name: 'Cliente', stage: null, origin: null, optOut: false, temperature: null },
    conversation: null,
    messages: [],
    history: [],
    lastResult: null,
    lastResultAt: null,
    nextAction: null,
    tasks: [],
    purchases: { paidOrdersCount: 4, lifetimeValue: null, lastOrders: [] },
    tags: [],
    campaign: null,
    liveContext: null,
    catalogs: { results: [], nextActions: [] },
    limits: { messages: 8, historyEvents: 4, tasks: 3, orders: 2 },
    ...overrides,
  };
}

describe('F3-H — recompra independente após pós-venda', () => {
  it('não deixa o último Resultado de pós-venda bloquear um padrão histórico já maduro', () => {
    const signal = calculateRepurchaseSignal(context({
      lastResult: { code: 'CRM-RES-026', label: 'Experiência positiva', description: '' },
      lastResultAt: '2026-08-15T12:00:00.000Z',
    }), monthly, now);

    expect(signal.status).toBe('probable');
  });

  it('continua sem sugerir recompra quando o histórico ainda não sustenta oportunidade', () => {
    const signal = calculateRepurchaseSignal(context({
      lastResult: { code: 'CRM-RES-026', label: 'Experiência positiva', description: '' },
    }), monthly.slice(0, 2), now);

    expect(signal.status).toBe('none');
  });

  it('mantém campanha sem resposta como bloqueio de evidência comercial', () => {
    const signal = calculateRepurchaseSignal(context({
      campaign: { campaignId: 'm1', campaignName: 'Campanha', recipientId: 'r1', sentAt: '2026-09-09T00:00:00.000Z', responded: false },
    }), monthly, now);

    expect(signal.status).toBe('none');
  });
});
