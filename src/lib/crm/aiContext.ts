/**
 * FRENTE 4.1 — Inteligência Assistida CRM: contexto inteligente.
 *
 * Camada SOMENTE LEITURA. Monta o contexto mínimo de um atendimento para que,
 * em fases futuras, sugestões de IA possam ser geradas a partir de um payload
 * único e serializável. Nesta fase NÃO existe chamada de IA, nenhuma escrita,
 * nenhum efeito colateral em Inbox, Prioridade, Resultado, tarefas ou campanhas.
 */
import { supabase } from '@/integrations/supabase/client';
import { CRM_CANONICAL_RESULTS, getCanonicalResult } from './canonical/results';
import { CRM_CANONICAL_NEXT_ACTIONS, getCanonicalNextAction } from './canonical/nextActions';
import { CRM_TASK_SOURCE } from './nextAction';
import { resolveCampaignContext, type CampaignContext } from './campaignContext';
import { ensureCrmLiveContext, getCrmLiveContext, type CrmContactLiveContext } from './liveContext';

const db = supabase as any;

/** Limites fixos: o contexto é mínimo por definição. */
export interface CrmAiContextLimits {
  messages: number;
  historyEvents: number;
  tasks: number;
  orders: number;
}

/** Janela usada quando a memória interpretativa ainda não existe. */
export const CRM_AI_CONTEXT_LIMITS: CrmAiContextLimits = {
  messages: 15,
  historyEvents: 8,
  tasks: 3,
  orders: 3,
};

/**
 * Com memória válida, a IA não precisa receber a mesma história inteira
 * novamente. A janela continua suficiente para prevalecerem fatos recentes
 * (inclusive uma nova mensagem, tarefa ou Resultado).
 */
export const CRM_AI_LIVE_MEMORY_LIMITS: CrmAiContextLimits = {
  messages: 8,
  historyEvents: 4,
  tasks: 3,
  orders: 2,
};

export interface CrmAiCatalogItem {
  code: string;
  label: string;
  description: string;
}

export interface CrmAiContactSummary {
  id: string;
  name: string | null;
  stage: string | null;
  origin: string | null;
  optOut: boolean;
  temperature: string | null;
}

export interface CrmAiConversationSummary {
  id: string;
  state: string | null;
  status: string | null;
  needsReply: boolean;
  returnAt: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
}

export interface CrmAiMessage {
  direction: 'inbound' | 'outbound' | 'unknown';
  sender: string | null;
  content: string;
  createdAt: string;
}

export interface CrmAiHistoryEvent {
  eventType: string | null;
  eventCode: string | null;
  description: string | null;
  at: string;
}

export interface CrmAiTask {
  id: string;
  title: string;
  dueAt: string | null;
  source: string | null;
}

export interface CrmAiOrder {
  id: string;
  orderNumber: string | null;
  status: string | null;
  paymentStatus: string | null;
  totalValue: number | null;
  orderDate: string | null;
}

export interface CrmAiContext {
  generatedAt: string;
  contact: CrmAiContactSummary;
  conversation: CrmAiConversationSummary | null;
  messages: CrmAiMessage[];
  history: CrmAiHistoryEvent[];
  lastResult: CrmAiCatalogItem | null;
  lastResultAt: string | null;
  nextAction: (CrmAiCatalogItem & { dueAt: string | null }) | null;
  tasks: CrmAiTask[];
  purchases: { paidOrdersCount: number; lifetimeValue: number | null; lastOrders: CrmAiOrder[] };
  tags: string[];
  campaign: CampaignContext | null;
  /** Camada interpretativa adicional; nunca é fonte de fatos canônicos. */
  liveContext: CrmContactLiveContext | null;
  catalogs: { results: CrmAiCatalogItem[]; nextActions: CrmAiCatalogItem[] };
  limits: CrmAiContextLimits;
}

/** Contexto transportado para cada modo da Edge Function. */
export type CrmAiRequestContext = Omit<CrmAiContext, 'catalogs'> & {
  catalogs?: Pick<CrmAiContext['catalogs'], 'results'>;
};

/**
 * Evita transportar catálogos que o modo solicitado não consulta. Resultado
 * ainda recebe o catálogo soberano; Próxima Ação recebe candidatos explícitos
 * e Resposta não precisa de catálogo. O contexto semântico é preservado.
 */
export function buildCrmAiRequestContext(
  context: CrmAiContext,
  mode: 'result' | 'next_action' | 'reply',
): CrmAiRequestContext {
  const { catalogs, ...shared } = context;
  return mode === 'result'
    ? { ...shared, catalogs: { results: catalogs.results } }
    : shared;
}

/** Métricas locais apenas em desenvolvimento ou no preview Lovable. */
export function isCrmAiPerformanceLoggingEnabled(): boolean {
  return import.meta.env.DEV
    || (typeof window !== 'undefined' && window.location.hostname.startsWith('id-preview--'));
}

function traceAiContext(timings: Record<string, number>, context: CrmAiContext, startedAt: number) {
  // Sem persistência e sem conteúdo de mensagens: somente métricas locais no
  // console para desenvolvimento/preview.
  if (!isCrmAiPerformanceLoggingEnabled()) return;
  console.debug('[CRM IA] contexto montado', {
    contextMs: Math.round(performance.now() - startedAt),
    queriesMs: Object.fromEntries(Object.entries(timings).map(([name, value]) => [name, Math.round(value)])),
    contextBytes: JSON.stringify(context).length,
  });
}

function serializeCatalog(items: readonly { code: string; label: string; description: string }[]): CrmAiCatalogItem[] {
  return items.map(({ code, label, description }) => ({ code, label, description }));
}

/** Catálogos canônicos serializáveis, sem duplicar as fontes oficiais. */
export const CRM_AI_RESULT_CATALOG = serializeCatalog(CRM_CANONICAL_RESULTS);
export const CRM_AI_NEXT_ACTION_CATALOG = serializeCatalog(CRM_CANONICAL_NEXT_ACTIONS);

export interface CrmAiContextSources {
  loadContact(contactId: string): Promise<any | null>;
  loadConversation(contactId: string, conversationId?: string | null): Promise<any | null>;
  loadMessages(conversationId: string, limit: number): Promise<any[]>;
  loadHistory(contactId: string, limit: number): Promise<any[]>;
  loadTasks(contactId: string, limit: number): Promise<any[]>;
  loadOrders(contactId: string, limit: number): Promise<any[]>;
  loadTags(contactId: string): Promise<any[]>;
  loadCampaign(params: { contactId: string; conversationId?: string | null; lastInboundAt?: string | null }): Promise<CampaignContext | null>;
  loadLiveContext?(contactId: string): Promise<CrmContactLiveContext | null>;
}

export const defaultCrmAiContextSources: CrmAiContextSources = {
  async loadContact(contactId) {
    const { data } = await db.from('contacts')
      .select('id, name, funnel_status, origem_lead, temperatura_lead, commercial_opt_out, paid_orders_count, lifetime_value, next_action_text, next_action_date')
      .eq('id', contactId).maybeSingle();
    return data ?? null;
  },
  async loadConversation(contactId, conversationId) {
    let query = db.from('service_conversations')
      .select('id, attendance_state, status, needs_reply, return_at, last_inbound_at, last_outbound_at');
    query = conversationId
      ? query.eq('id', conversationId)
      : query.eq('contact_id', contactId).order('last_message_at', { ascending: false }).limit(1);
    const { data } = await query.maybeSingle();
    return data ?? null;
  },
  async loadMessages(conversationId, limit) {
    const { data } = await db.from('service_messages')
      .select('content, sender, direction, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return data ?? [];
  },
  async loadHistory(contactId, limit) {
    const { data } = await db.from('contact_history')
      .select('event_type, event_code, event_metadata, description, interaction_date')
      .eq('contact_id', contactId)
      .order('interaction_date', { ascending: false })
      .limit(Math.max(limit, 30));
    return data ?? [];
  },
  async loadTasks(contactId, limit) {
    const { data } = await db.from('tasks')
      .select('id, title, due_date, scheduled_date, source, status')
      .eq('contact_id', contactId)
      .is('deleted_at', null)
      .neq('status', 'concluida')
      .order('due_date', { ascending: true })
      .limit(limit);
    return data ?? [];
  },
  async loadOrders(contactId, limit) {
    const { data } = await db.from('orders')
      .select('id, order_number, status, payment_status, total_value, order_date')
      .eq('contact_id', contactId)
      .is('deleted_at', null)
      .order('order_date', { ascending: false })
      .limit(limit);
    return data ?? [];
  },
  async loadTags(contactId) {
    const { data } = await db.from('contact_tag_assignments')
      .select('tag:contact_tags(name)')
      .eq('contact_id', contactId);
    return data ?? [];
  },
  loadCampaign: resolveCampaignContext,
  loadLiveContext: getCrmLiveContext,
};

function normalizeDirection(row: any): CrmAiMessage['direction'] {
  const raw = String(row?.direction ?? row?.sender ?? '').toLowerCase();
  if (raw.includes('in') || raw === 'contact' || raw === 'customer') return 'inbound';
  if (raw.includes('out') || raw === 'agent' || raw === 'me' || raw === 'operator') return 'outbound';
  return 'unknown';
}

/**
 * Deriva o último Resultado canônico usando a convenção já utilizada pelo CRM:
 * `contact_history.event_metadata.result_code`. Nenhuma coluna nova é criada e
 * nenhum texto legado é interpretado.
 */
export function deriveLastCanonicalResult(historyRows: any[]): { result: CrmAiCatalogItem | null; at: string | null; nextActionCode: string | null } {
  for (const row of historyRows) {
    const code = row?.event_metadata?.result_code;
    const canonical = getCanonicalResult(code);
    if (canonical) {
      return {
        result: { code: canonical.code, label: canonical.label, description: canonical.description },
        at: row.interaction_date ?? null,
        nextActionCode: row?.event_metadata?.next_action_code ?? null,
      };
    }
  }
  return { result: null, at: null, nextActionCode: null };
}

export async function buildCrmAiContext(
  contactId: string,
  conversationId?: string | null,
  sources: CrmAiContextSources = defaultCrmAiContextSources,
): Promise<CrmAiContext> {
  if (!contactId) throw new Error('contactId é obrigatório para montar o contexto de IA do CRM');

  const startedAt = performance.now();
  const timings: Record<string, number> = {};
  const timed = async <T,>(name: string, operation: Promise<T>): Promise<T> => {
    const started = performance.now();
    try { return await operation; }
    finally { timings[name] = performance.now() - started; }
  };

  const [contact, conversationRow, existingLiveContext] = await Promise.all([
    timed('contact', sources.loadContact(contactId)),
    timed('conversation', sources.loadConversation(contactId, conversationId)),
    sources.loadLiveContext
      ? timed('liveContext', sources.loadLiveContext(contactId).catch(() => null))
      : Promise.resolve(null),
  ]);
  if (!contact) throw new Error('Contato não encontrado');

  const conversation: CrmAiConversationSummary | null = conversationRow ? {
    id: conversationRow.id,
    state: conversationRow.attendance_state ?? null,
    status: conversationRow.status ?? null,
    needsReply: Boolean(conversationRow.needs_reply),
    returnAt: conversationRow.return_at ?? null,
    lastInboundAt: conversationRow.last_inbound_at ?? null,
    lastOutboundAt: conversationRow.last_outbound_at ?? null,
  } : null;

  // IA-07.1: apenas no primeiro uso, tenta criar a memória interpretativa.
  // Qualquer falha é absorvida: o Assistente segue com os fatos atuais.
  let liveContext = existingLiveContext;
  if (!liveContext && sources === defaultCrmAiContextSources) {
    try {
      liveContext = await timed('liveContextBootstrap', ensureCrmLiveContext(contactId));
    } catch (error) {
      if (isCrmAiPerformanceLoggingEnabled()) console.debug('[CRM IA] Contexto Vivo indisponível', error);
    }
  }

  // Contexto Vivo é a memória histórica principal; as consultas abaixo ainda
  // preservam fatos atuais oficiais e uma janela recente de segurança.
  const limits = liveContext ? CRM_AI_LIVE_MEMORY_LIMITS : CRM_AI_CONTEXT_LIMITS;
  const [messageRows, historyRows, taskRows, orderRows, tagRows, campaign] = await Promise.all([
    conversation ? timed('messages', sources.loadMessages(conversation.id, limits.messages)) : Promise.resolve([]),
    timed('history', sources.loadHistory(contactId, limits.historyEvents)),
    timed('tasks', sources.loadTasks(contactId, limits.tasks)),
    timed('orders', sources.loadOrders(contactId, limits.orders)),
    timed('tags', sources.loadTags(contactId)),
    timed('campaign', sources.loadCampaign({ contactId, conversationId: conversation?.id ?? null, lastInboundAt: conversation?.lastInboundAt ?? null }).catch(() => null)),
  ]);

  const messages: CrmAiMessage[] = (messageRows ?? [])
    .slice(0, limits.messages)
    .map(row => ({
      direction: normalizeDirection(row),
      sender: row.sender ?? null,
      content: String(row.content ?? ''),
      createdAt: row.created_at,
    }))
    .reverse();

  const derived = deriveLastCanonicalResult(historyRows ?? []);

  const history: CrmAiHistoryEvent[] = (historyRows ?? [])
    .slice(0, limits.historyEvents)
    .map(row => ({
      eventType: row.event_type ?? null,
      eventCode: row.event_code ?? null,
      description: row.description ?? null,
      at: row.interaction_date,
    }));

  const tasks: CrmAiTask[] = (taskRows ?? []).slice(0, limits.tasks).map(row => ({
    id: row.id,
    title: row.title,
    dueAt: row.due_date ?? row.scheduled_date ?? null,
    source: row.source ?? null,
  }));

  // Próxima Ação oficial: código canônico registrado pelo próprio CRM, com o
  // prazo da tarefa oficial (source = crm_next_action) ou do contato.
  const canonicalNextAction = getCanonicalNextAction(derived.nextActionCode);
  const officialTask = tasks.find(task => task.source === CRM_TASK_SOURCE) ?? null;
  const nextAction = canonicalNextAction ? {
    code: canonicalNextAction.code,
    label: canonicalNextAction.label,
    description: canonicalNextAction.description,
    dueAt: officialTask?.dueAt ?? contact.next_action_date ?? null,
  } : null;

  const tags = (tagRows ?? [])
    .map((row: any) => row?.tag?.name ?? row?.name ?? null)
    .filter((name: unknown): name is string => typeof name === 'string' && name.length > 0);

  const context: CrmAiContext = {
    generatedAt: new Date().toISOString(),
    contact: {
      id: contact.id,
      name: contact.name ?? null,
      stage: contact.funnel_status ?? null,
      origin: contact.origem_lead ?? null,
      optOut: Boolean(contact.commercial_opt_out),
      temperature: contact.temperatura_lead ?? null,
    },
    conversation,
    messages,
    history,
    lastResult: derived.result,
    lastResultAt: derived.at,
    nextAction,
    tasks,
    purchases: {
      paidOrdersCount: Number(contact.paid_orders_count ?? 0),
      lifetimeValue: contact.lifetime_value ?? null,
      lastOrders: (orderRows ?? []).slice(0, limits.orders).map(row => ({
        id: row.id,
        orderNumber: row.order_number ?? null,
        status: row.status ?? null,
        paymentStatus: row.payment_status ?? null,
        totalValue: row.total_value ?? null,
        orderDate: row.order_date ?? null,
      })),
    },
    tags,
    campaign: campaign ?? null,
    liveContext,
    catalogs: { results: CRM_AI_RESULT_CATALOG, nextActions: CRM_AI_NEXT_ACTION_CATALOG },
    limits,
  };
  traceAiContext(timings, context, startedAt);
  return context;
}
