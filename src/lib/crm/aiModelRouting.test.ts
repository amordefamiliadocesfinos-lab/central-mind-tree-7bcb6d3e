import { getCrmAiEscalationReasons } from './aiModelRouting';
import type { CrmAiContext } from './aiContext';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`CRM-IA-REV-02: ${message}`);
}

function context(content: string): CrmAiContext {
  return {
    generatedAt: new Date().toISOString(),
    contact: { id: 'c1', name: 'Cliente', stage: null, origin: null, optOut: false, temperature: null },
    conversation: null,
    messages: [{ direction: 'inbound', sender: 'customer', content, createdAt: new Date().toISOString() }],
    history: [], lastResult: null, lastResultAt: null, nextAction: null, tasks: [],
    purchases: { paidOrdersCount: 0, lifetimeValue: null, lastOrders: [] }, tags: [], campaign: null, liveContext: null,
    catalogs: { results: [], nextActions: [] }, limits: { messages: 8, historyEvents: 4, tasks: 3, orders: 2 },
  };
}

assert(getCrmAiEscalationReasons(context('Quero 2 unidades.')).length === 0, 'caso simples deve permanecer no Flash.');
assert(getCrmAiEscalationReasons(context('Quero 2 caixas e 30 unidades.')).includes('multiple_products_or_quantities'), 'múltiplos produtos/quantidades devem escalar.');
assert(getCrmAiEscalationReasons(context('Amanhã te retorno.')).includes('relative_date'), 'data relativa deve escalar.');
assert(getCrmAiEscalationReasons(context('Quero saber mais.'), { confidence: 0.4 }).includes('low_confidence'), 'baixa confiança deve escalar.');

console.log('aiModelRouting.test: OK');
