import { buildCrmAiContext, buildCrmAiRequestContext, deriveLastCanonicalResult, CRM_AI_CONTEXT_LIMITS, CRM_AI_LIVE_MEMORY_LIMITS, type CrmAiContextSources } from './aiContext';
import type { CrmContactLiveContext } from './liveContext';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FRENTE 4.1 — contexto de IA do CRM: ${message}`);
}

const baseContact = {
  id: 'c1', name: 'Amor', funnel_status: 'negociacao', origem_lead: 'whatsapp',
  temperatura_lead: 'quente', commercial_opt_out: false, paid_orders_count: 2,
  lifetime_value: 300, next_action_text: 'Conferir pagamento', next_action_date: '2026-09-01T12:00:00.000Z',
};

function sources(overrides: Partial<CrmAiContextSources> = {}): CrmAiContextSources {
  return {
    loadContact: async () => baseContact,
    loadConversation: async () => ({ id: 'conv1', attendance_state: 'aguardando_cliente', status: 'open', needs_reply: true, return_at: null, last_inbound_at: '2026-08-30T10:00:00.000Z', last_outbound_at: '2026-08-30T11:00:00.000Z' }),
    loadMessages: async () => [{ content: 'oi', sender: 'contact', direction: 'inbound', created_at: '2026-08-30T10:00:00.000Z' }],
    loadHistory: async () => [{ event_type: 'contact', event_code: 'CRM-EVT', description: 'Resultado: Pagamento informado', interaction_date: '2026-08-30T10:05:00.000Z', event_metadata: { result_code: 'CRM-RES-019', next_action_code: 'CRM-PA-013' } }],
    loadTasks: async () => [{ id: 't1', title: 'Conferir pagamento', due_date: '2026-09-01T12:00:00.000Z', source: 'crm_next_action', status: 'pendente' }],
    loadOrders: async () => [{ id: 'o1', order_number: '100', status: 'concluido', payment_status: 'pago', total_value: 150, order_date: '2026-08-01' }],
    loadTags: async () => [{ tag: { name: 'VIP' } }],
    loadCampaign: async () => null,
    ...overrides,
  };
}

async function run() {
  // A. contato com conversa e histórico completo
  const full = await buildCrmAiContext('c1', 'conv1', sources());
  assert(full.contact.name === 'Amor' && full.conversation?.id === 'conv1', 'contato e conversa devem ser incluídos.');
  assert(full.lastResult?.code === 'CRM-RES-019', 'último Resultado canônico deve ser derivado do contact_history.');
  assert(full.nextAction?.code === 'CRM-PA-013' && full.nextAction.dueAt === '2026-09-01T12:00:00.000Z', 'Próxima Ação oficial deve vir da fonte canônica com prazo da tarefa oficial.');
  assert(full.catalogs.results.length === 33 && full.catalogs.nextActions.length === 19, 'catálogos canônicos devem ser serializados sem duplicação.');
  assert(full.tags.join() === 'VIP', 'tags devem ser incluídas.');

  // B. contato sem compras
  const noPurchase = await buildCrmAiContext('c1', null, sources({
    loadContact: async () => ({ ...baseContact, paid_orders_count: 0, lifetime_value: null }),
    loadOrders: async () => [],
  }));
  assert(noPurchase.purchases.paidOrdersCount === 0 && noPurchase.purchases.lastOrders.length === 0, 'contato sem compras deve retornar zero pedidos.');

  // C. contato sem tarefa
  const noTask = await buildCrmAiContext('c1', null, sources({ loadTasks: async () => [] }));
  assert(noTask.tasks.length === 0 && noTask.nextAction?.dueAt === '2026-09-01T12:00:00.000Z', 'sem tarefa, o prazo oficial vem do contato.');

  // D. contato com campanha
  const campaign = { campaignId: 'k1', campaignName: 'Teste', recipientId: 'r1', sentAt: '2026-08-29T10:00:00.000Z', responded: true };
  const withCampaign = await buildCrmAiContext('c1', 'conv1', sources({ loadCampaign: async () => campaign }));
  assert(withCampaign.campaign?.campaignName === 'Teste', 'contexto de campanha deve ser incluído quando existir.');

  // E. contato com opt-out
  const optOut = await buildCrmAiContext('c1', null, sources({ loadContact: async () => ({ ...baseContact, commercial_opt_out: true }) }));
  assert(optOut.contact.optOut === true, 'opt-out deve ser refletido no contexto.');

  // F. conversa muito longa → somente últimas 15 mensagens
  const many = Array.from({ length: 400 }, (_, i) => ({ content: `m${i}`, sender: 'contact', direction: 'inbound', created_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString() })).reverse();
  const long = await buildCrmAiContext('c1', 'conv1', sources({ loadMessages: async () => many }));
  assert(long.messages.length === CRM_AI_CONTEXT_LIMITS.messages, 'somente as últimas 15 mensagens devem ser mantidas.');
  assert(long.messages[0].content === 'm385' && long.messages[14].content === 'm399', 'as mensagens devem ficar em ordem cronológica.');

  // IA-07.3: memória válida reduz somente a janela histórica enviada; fatos
  // atuais (incluindo tarefa e opt-out) continuam vindos de fontes canônicas.
  const liveContext: CrmContactLiveContext = {
    contactId: 'c1', summary: 'Cliente recorrente; prefere chocolate branco.',
    memory: { preferences: ['chocolate branco'] }, sourceEventAt: '2026-08-30T10:00:00.000Z',
    updatedAt: '2026-08-30T10:00:00.000Z', version: 1,
  };
  const withLiveMemory = await buildCrmAiContext('c1', 'conv1', sources({
    loadLiveContext: async () => liveContext,
    loadMessages: async (_conversationId, limit) => many.slice(0, limit),
    loadHistory: async (_contactId, limit) => Array.from({ length: limit }, (_, index) => ({
      event_type: 'contact', event_code: 'CRM-EVT', description: `evento ${index}`,
      interaction_date: `2026-08-30T10:0${index}:00.000Z`, event_metadata: index === 0 ? { result_code: 'CRM-RES-019' } : {},
    })),
    loadOrders: async (_contactId, limit) => Array.from({ length: limit }, (_, index) => ({
      id: `o${index}`, order_number: String(index), status: 'concluido', payment_status: 'pago', total_value: 10, order_date: '2026-08-01',
    })),
  }));
  assert(withLiveMemory.limits === CRM_AI_LIVE_MEMORY_LIMITS, 'memória válida deve usar janela histórica reduzida.');
  assert(withLiveMemory.messages.length === CRM_AI_LIVE_MEMORY_LIMITS.messages, 'janela recente deve ser reduzida com memória válida.');
  assert(withLiveMemory.history.length === CRM_AI_LIVE_MEMORY_LIMITS.historyEvents, 'eventos antigos devem ceder espaço à memória viva.');
  assert(withLiveMemory.tasks[0]?.source === 'crm_next_action' && withLiveMemory.contact.optOut === false, 'fatos canônicos atuais devem permanecer diretos.');

  // IA-REV-02: o compilador de transporte mantém fatos/tarefa oficiais e
  // limita memória viva exagerada antes de chegar ao modelo.
  const largeLive = {
    ...liveContext,
    summary: 'x'.repeat(5000),
    memory: { preferences: Array.from({ length: 30 }, (_, i) => `preferência ${i} ${'x'.repeat(300)}`) },
  } as CrmContactLiveContext;
  const compiled = buildCrmAiRequestContext({ ...withLiveMemory, liveContext: largeLive }, 'reply');
  assert(compiled.liveContext?.summary?.length === 900, 'compilador deve limitar o resumo da memória viva.');
  assert(compiled.liveContext?.memory.preferences?.length === 6, 'compilador deve limitar listas da memória viva.');
  assert(compiled.tasks[0]?.source === 'crm_next_action' && compiled.nextAction?.code === 'CRM-PA-013', 'tarefa e Próxima Ação oficiais devem seguir explícitas no contexto.');

  // G. nenhum efeito colateral: apenas leituras
  const calls: string[] = [];
  const base = sources();
  const spy = (name: string, fn: any) => async (...args: any[]) => { calls.push(name); return fn(...args); };
  await buildCrmAiContext('c1', 'conv1', {
    loadContact: spy('contact', base.loadContact), loadConversation: spy('conversation', base.loadConversation),
    loadMessages: spy('messages', base.loadMessages), loadHistory: spy('history', base.loadHistory),
    loadTasks: spy('tasks', base.loadTasks), loadOrders: spy('orders', base.loadOrders),
    loadTags: spy('tags', base.loadTags), loadCampaign: spy('campaign', base.loadCampaign),
  });
  assert(calls.length === 8 && new Set(calls).size === 8, 'apenas as oito leituras previstas devem ocorrer, sem escrita.');

  // Derivação do último Resultado
  const derived = deriveLastCanonicalResult([
    { event_metadata: { source: 'nota' }, interaction_date: '2026-08-30T12:00:00.000Z' },
    { event_metadata: { result_code: 'CRM-RES-020' }, interaction_date: '2026-08-30T11:00:00.000Z' },
    { event_metadata: { result_code: 'CRM-RES-001' }, interaction_date: '2026-08-29T11:00:00.000Z' },
  ]);
  assert(derived.result?.code === 'CRM-RES-020', 'o Resultado mais recente válido deve prevalecer.');
  assert(deriveLastCanonicalResult([{ event_metadata: {}, interaction_date: 'x' }]).result === null, 'sem result_code o último Resultado deve ser null.');
}

run().then(() => console.log('aiContext.test: OK'));
