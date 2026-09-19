import { calculateRepurchaseSignal, hasFutureCrmReactivation, type RepurchaseOrder } from './repurchase';
import type { CrmAiContext } from './aiContext';

const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const at = new Date('2026-09-10T12:00:00.000Z');
const order = (date: string, id: string, products = ['p1']): RepurchaseOrder => ({ id, orderDate: date, status: 'concluido', paymentStatus: 'pago', productIds: products });
const context = (message = '', overrides: Partial<CrmAiContext> = {}): CrmAiContext => ({
  generatedAt: at.toISOString(), contact: { id: 'c1', name: 'Cliente', stage: null, origin: null, optOut: false, temperature: null },
  conversation: null, messages: message ? [{ direction: 'inbound', sender: 'customer', content: message, createdAt: at.toISOString() }] : [],
  history: [], lastResult: null, lastResultAt: null, nextAction: null, tasks: [],
  purchases: { paidOrdersCount: 0, lifetimeValue: null, lastOrders: [] }, tags: [], campaign: null, liveContext: null,
  catalogs: { results: [], nextActions: [] }, limits: { messages: 8, historyEvents: 4, tasks: 3, orders: 2 }, ...overrides,
});

const monthly = [order('2026-05-10', 'o1'), order('2026-06-09', 'o2'), order('2026-07-10', 'o3'), order('2026-08-09', 'o4')];
assert(calculateRepurchaseSignal(context(), [order('2026-08-01', 'o1')], at).status === 'none', 'A: uma compra não basta.');
assert(calculateRepurchaseSignal(context(), monthly.slice(0, 2), at).status === 'none', 'B: duas compras não bastam.');
assert(calculateRepurchaseSignal(context(), monthly, at).status === 'probable', 'C: padrão mensal deve ser provável.');
assert(calculateRepurchaseSignal(context(), [order('2026-01-01', 'o1'), order('2026-02-15', 'o2'), order('2026-06-20', 'o3'), order('2026-08-01', 'o4'), order('2026-08-30', 'o5')], at).status === 'none', 'D: intervalos irregulares bloqueiam sugestão.');
assert(calculateRepurchaseSignal(context('Quero fazer outro pedido'), monthly, at).status === 'explicit', 'E: intenção concreta é explícita.');
assert(calculateRepurchaseSignal(context('', { lastResult: { code: 'CRM-RES-026', label: 'Experiência positiva', description: '' } }), monthly, at).status === 'probable', 'F: pós-venda não bloqueia padrão independente de recompra.');
assert(calculateRepurchaseSignal(context(), monthly, at).likelyProducts.includes('p1'), 'K: produto repetido é evidência real.');
assert(calculateRepurchaseSignal(context('', { contact: { id: 'c1', name: null, stage: null, origin: null, optOut: true, temperature: null } }), monthly, at).status === 'none', 'G: opt-out bloqueia sugestão.');
assert(calculateRepurchaseSignal(context('', { campaign: { campaignId: 'm1', campaignName: 'Campanha', recipientId: 'r1', sentAt: '2026-09-09T00:00:00.000Z', responded: false } }), monthly, at).status === 'none', 'H: campanha sem resposta não prova recompra.');
assert(calculateRepurchaseSignal(context('Quero comprar novamente', { campaign: { campaignId: 'm1', campaignName: 'Campanha', recipientId: 'r1', sentAt: '2026-09-09T00:00:00.000Z', responded: true } }), monthly, at).status === 'explicit', 'I: resposta de campanha com intenção é explícita.');
assert(calculateRepurchaseSignal(context(), monthly.map(item => ({ ...item, productIds: [] })), at).likelyProducts.length === 0, 'L: sem evidência de produto não inventa item.');
assert(hasFutureCrmReactivation(context('', { tasks: [{ id: 't1', title: 'Reativação', source: 'crm_reactivation', dueAt: '2026-09-20T09:00:00.000Z' }] }), at), 'J: reativação futura é detectada.');
console.log('repurchase.test: OK');
