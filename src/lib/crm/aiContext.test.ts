import { describe, it, expect, vi } from 'vitest';
import { buildCrmAiContext, deriveLastCanonicalResult, CRM_AI_CONTEXT_LIMITS, type CrmAiContextSources } from './aiContext';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const baseContact = {
  id: 'c1', name: 'Amor', funnel_status: 'negociacao', origem_lead: 'whatsapp',
  temperatura_lead: 'quente', commercial_opt_out: false, paid_orders_count: 2,
  lifetime_value: 300, next_action_text: 'Conferir pagamento', next_action_date: '2026-09-01T12:00:00Z',
};

function sources(overrides: Partial<CrmAiContextSources> = {}): CrmAiContextSources {
  return {
    loadContact: async () => baseContact,
    loadConversation: async () => ({ id: 'conv1', attendance_state: 'aguardando_cliente', status: 'open', needs_reply: true, return_at: null, last_inbound_at: '2026-08-30T10:00:00Z', last_outbound_at: '2026-08-30T11:00:00Z' }),
    loadMessages: async () => [{ content: 'oi', sender: 'contact', direction: 'inbound', created_at: '2026-08-30T10:00:00Z' }],
    loadHistory: async () => [{ event_type: 'contact', event_code: 'x', description: 'Resultado: Pagamento informado', interaction_date: '2026-08-30T10:05:00Z', event_metadata: { result_code: 'CRM-RES-019', next_action_code: 'CRM-PA-013' } }],
    loadTasks: async () => [{ id: 't1', title: 'Conferir pagamento', due_date: '2026-09-01T12:00:00Z', source: 'crm_next_action', status: 'pendente' }],
    loadOrders: async () => [{ id: 'o1', order_number: '100', status: 'concluido', payment_status: 'pago', total_value: 150, order_date: '2026-08-01' }],
    loadTags: async () => [{ tag: { name: 'VIP' } }],
    loadCampaign: async () => null,
    ...overrides,
  };
}

describe('buildCrmAiContext', () => {
  it('A. monta contexto completo com conversa e histórico', async () => {
    const ctx = await buildCrmAiContext('c1', 'conv1', sources());
    expect(ctx.contact.name).toBe('Amor');
    expect(ctx.conversation?.id).toBe('conv1');
    expect(ctx.lastResult?.code).toBe('CRM-RES-019');
    expect(ctx.nextAction).toEqual({ code: 'CRM-PA-013', label: 'Conferir pagamento', description: expect.any(String), dueAt: '2026-09-01T12:00:00Z' });
    expect(ctx.catalogs.results).toHaveLength(33);
    expect(ctx.catalogs.nextActions).toHaveLength(19);
    expect(ctx.tags).toEqual(['VIP']);
  });

  it('B. contato sem compras', async () => {
    const ctx = await buildCrmAiContext('c1', null, sources({
      loadContact: async () => ({ ...baseContact, paid_orders_count: 0, lifetime_value: null }),
      loadOrders: async () => [],
    }));
    expect(ctx.purchases).toEqual({ paidOrdersCount: 0, lifetimeValue: null, lastOrders: [] });
  });

  it('C. contato sem tarefa', async () => {
    const ctx = await buildCrmAiContext('c1', null, sources({ loadTasks: async () => [] }));
    expect(ctx.tasks).toEqual([]);
    expect(ctx.nextAction?.dueAt).toBe('2026-09-01T12:00:00Z');
  });

  it('D. contato com campanha', async () => {
    const campaign = { campaignId: 'k1', campaignName: 'Teste', recipientId: 'r1', sentAt: '2026-08-29T10:00:00Z', responded: true };
    const ctx = await buildCrmAiContext('c1', 'conv1', sources({ loadCampaign: async () => campaign }));
    expect(ctx.campaign).toEqual(campaign);
  });

  it('E. contato com opt-out', async () => {
    const ctx = await buildCrmAiContext('c1', null, sources({ loadContact: async () => ({ ...baseContact, commercial_opt_out: true }) }));
    expect(ctx.contact.optOut).toBe(true);
  });

  it('F. conversa longa retorna somente as últimas 15 mensagens em ordem cronológica', async () => {
    const many = Array.from({ length: 400 }, (_, i) => ({ content: `m${i}`, sender: 'contact', direction: 'inbound', created_at: new Date(2026, 0, 1, 0, i).toISOString() })).reverse();
    const ctx = await buildCrmAiContext('c1', 'conv1', sources({ loadMessages: async () => many }));
    expect(ctx.messages).toHaveLength(CRM_AI_CONTEXT_LIMITS.messages);
    expect(ctx.messages[0].content).toBe('m385');
    expect(ctx.messages[14].content).toBe('m399');
  });

  it('G. nenhum efeito colateral: apenas leituras são executadas', async () => {
    const calls: string[] = [];
    const spy = (name: string, fn: any) => async (...args: any[]) => { calls.push(name); return fn(...args); };
    const base = sources();
    await buildCrmAiContext('c1', 'conv1', {
      loadContact: spy('contact', base.loadContact), loadConversation: spy('conversation', base.loadConversation),
      loadMessages: spy('messages', base.loadMessages), loadHistory: spy('history', base.loadHistory),
      loadTasks: spy('tasks', base.loadTasks), loadOrders: spy('orders', base.loadOrders),
      loadTags: spy('tags', base.loadTags), loadCampaign: spy('campaign', base.loadCampaign),
    });
    expect(new Set(calls)).toEqual(new Set(['contact', 'conversation', 'messages', 'history', 'tasks', 'orders', 'tags', 'campaign']));
  });
});

describe('deriveLastCanonicalResult', () => {
  it('ignora eventos sem result_code e usa o mais recente válido', () => {
    const derived = deriveLastCanonicalResult([
      { event_metadata: { source: 'nota' }, interaction_date: '2026-08-30T12:00:00Z' },
      { event_metadata: { result_code: 'CRM-RES-020' }, interaction_date: '2026-08-30T11:00:00Z' },
      { event_metadata: { result_code: 'CRM-RES-001' }, interaction_date: '2026-08-29T11:00:00Z' },
    ]);
    expect(derived.result?.code).toBe('CRM-RES-020');
    expect(derived.at).toBe('2026-08-30T11:00:00Z');
  });

  it('retorna null quando não há Resultado canônico', () => {
    expect(deriveLastCanonicalResult([{ event_metadata: {}, interaction_date: 'x' }]).result).toBeNull();
  });
});
