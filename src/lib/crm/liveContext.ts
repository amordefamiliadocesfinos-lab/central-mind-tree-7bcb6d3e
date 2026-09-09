import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

export const CRM_LIVE_CONTEXT_VERSION = 1;

export interface CrmLiveContextPurchasePattern {
  approximate_frequency_days?: number;
  recurring_product_ids?: string[];
  last_purchase_at?: string;
}

/** Memória interpretativa: nunca substitui fatos operacionais canônicos. */
export interface CrmLiveContextMemory {
  preferences?: string[];
  objections?: string[];
  interests?: string[];
  persistent_facts?: string[];
  purchase_pattern?: CrmLiveContextPurchasePattern;
}

export interface CrmContactLiveContext {
  contactId: string;
  summary: string | null;
  memory: CrmLiveContextMemory;
  sourceEventAt: string | null;
  updatedAt: string;
  version: number;
}

export type CrmLiveContextEventType =
  | 'inbound'
  | 'outbound'
  | 'result'
  | 'sale'
  | 'payment'
  | 'next_action'
  | 'reactivation'
  | 'campaign_response';

/** Dados já conhecidos pelo writer; nunca aceita fatos operacionais canônicos. */
export interface CrmLiveContextEvent {
  contactId: string;
  type: CrmLiveContextEventType;
  occurredAt: string;
  summary?: string | null;
  memory?: CrmLiveContextMemory;
}

type LiveContextRow = {
  contact_id: string;
  summary: string | null;
  memory: unknown;
  source_event_at: string | null;
  updated_at: string;
  version: number;
};

const MAX_ITEMS = 20;
const MAX_ITEM_LENGTH = 500;

function asStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim().slice(0, MAX_ITEM_LENGTH))
    .filter(Boolean);
  return items.length ? [...new Set(items)].slice(0, MAX_ITEMS) : undefined;
}

function asIsoDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return undefined;
  return value;
}

/** Remove formas inválidas sem preencher lacunas com informação inventada. */
export function normalizeCrmLiveContextMemory(value: unknown): CrmLiveContextMemory {
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const purchase = raw.purchase_pattern && typeof raw.purchase_pattern === 'object' && !Array.isArray(raw.purchase_pattern)
    ? raw.purchase_pattern as Record<string, unknown>
    : null;
  const frequency = Number(purchase?.approximate_frequency_days);
  const purchasePattern: CrmLiveContextPurchasePattern = {
    ...(Number.isFinite(frequency) && frequency > 0 ? { approximate_frequency_days: Math.round(frequency) } : {}),
    ...(asStringList(purchase?.recurring_product_ids) ? { recurring_product_ids: asStringList(purchase?.recurring_product_ids) } : {}),
    ...(asIsoDate(purchase?.last_purchase_at) ? { last_purchase_at: asIsoDate(purchase?.last_purchase_at) } : {}),
  };

  return {
    ...(asStringList(raw.preferences) ? { preferences: asStringList(raw.preferences) } : {}),
    ...(asStringList(raw.objections) ? { objections: asStringList(raw.objections) } : {}),
    ...(asStringList(raw.interests) ? { interests: asStringList(raw.interests) } : {}),
    ...(asStringList(raw.persistent_facts) ? { persistent_facts: asStringList(raw.persistent_facts) } : {}),
    ...(Object.keys(purchasePattern).length ? { purchase_pattern: purchasePattern } : {}),
  };
}

function fromRow(row: LiveContextRow): CrmContactLiveContext {
  return {
    contactId: row.contact_id,
    summary: typeof row.summary === 'string' && row.summary.trim() ? row.summary.trim() : null,
    memory: normalizeCrmLiveContextMemory(row.memory),
    sourceEventAt: row.source_event_at ?? null,
    updatedAt: row.updated_at,
    version: Number(row.version ?? CRM_LIVE_CONTEXT_VERSION),
  };
}

export function needsCrmLiveContextBootstrap(context: CrmContactLiveContext | null): boolean {
  return !context || context.version !== CRM_LIVE_CONTEXT_VERSION;
}

export async function getCrmLiveContext(contactId: string): Promise<CrmContactLiveContext | null> {
  if (!contactId) return null;
  const { data, error } = await db
    .from('crm_contact_live_context')
    .select('contact_id, summary, memory, source_event_at, updated_at, version')
    .eq('contact_id', contactId)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as LiveContextRow) : null;
}

/** Escrita centralizada apenas da memória interpretativa, sem campos canônicos. */
export async function persistCrmLiveContext(input: Omit<CrmContactLiveContext, 'updatedAt'>): Promise<CrmContactLiveContext> {
  if (!input.contactId) throw new Error('contactId é obrigatório para persistir Contexto Vivo');
  const { data, error } = await db
    .from('crm_contact_live_context')
    .upsert({
      contact_id: input.contactId,
      summary: input.summary?.trim().slice(0, 4000) || null,
      memory: normalizeCrmLiveContextMemory(input.memory),
      source_event_at: input.sourceEventAt,
      version: CRM_LIVE_CONTEXT_VERSION,
    }, { onConflict: 'contact_id' })
    .select('contact_id, summary, memory, source_event_at, updated_at, version')
    .single();
  if (error) throw error;
  return fromRow(data as LiveContextRow);
}

/**
 * Bootstrap único sob demanda. A Edge Function relê fatos canônicos, gera
 * apenas a memória interpretativa e devolve a linha persistida. Falhas ficam
 * a cargo do consumidor, para nunca bloquearem o CRM.
 */
export async function ensureCrmLiveContext(contactId: string): Promise<CrmContactLiveContext | null> {
  const existing = await getCrmLiveContext(contactId);
  if (!needsCrmLiveContextBootstrap(existing)) return existing;

  const { data, error } = await supabase.functions.invoke('crm-live-context-bootstrap', {
    body: { contact_id: contactId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.context ? fromRow(data.context as LiveContextRow) : null;
}

function mergeSummary(current: string | null, eventSummary?: string | null) {
  const addition = eventSummary?.trim().slice(0, 700);
  if (!addition) return current;
  if (current?.includes(addition)) return current;
  return [current?.trim(), addition].filter(Boolean).join('\n').slice(-4000);
}

function mergeMemory(current: CrmLiveContextMemory, patch?: CrmLiveContextMemory): CrmLiveContextMemory {
  const incoming = normalizeCrmLiveContextMemory(patch ?? {});
  const combine = (a?: string[], b?: string[]) => a || b
    ? [...new Set([...(a ?? []), ...(b ?? [])])].slice(-MAX_ITEMS)
    : undefined;
  return normalizeCrmLiveContextMemory({
    preferences: combine(current.preferences, incoming.preferences),
    objections: combine(current.objections, incoming.objections),
    interests: combine(current.interests, incoming.interests),
    persistent_facts: combine(current.persistent_facts, incoming.persistent_facts),
    purchase_pattern: {
      ...current.purchase_pattern,
      ...incoming.purchase_pattern,
    },
  });
}

/**
 * Atualizador único e monotônico: eventos repetidos ou anteriores ao último
 * processado não alteram a memória. Falhas são tratadas pelo caller como
 * auxiliares e jamais devem bloquear o writer canônico.
 */
export async function updateCrmLiveContextIncrementally(event: CrmLiveContextEvent): Promise<CrmContactLiveContext | null> {
  const occurredAt = asIsoDate(event.occurredAt);
  if (!event.contactId || !occurredAt) return null;

  const context = await ensureCrmLiveContext(event.contactId);
  if (!context) return null;
  const lastEventAt = context.sourceEventAt ? Date.parse(context.sourceEventAt) : 0;
  if (Date.parse(occurredAt) <= lastEventAt) return context;

  return persistCrmLiveContext({
    contactId: context.contactId,
    summary: mergeSummary(context.summary, event.summary),
    memory: mergeMemory(context.memory, event.memory),
    sourceEventAt: occurredAt,
    version: CRM_LIVE_CONTEXT_VERSION,
  });
}

/** Fire-and-forget seguro para ser chamado somente após o fato canônico. */
export function refreshCrmLiveContext(event: CrmLiveContextEvent) {
  void updateCrmLiveContextIncrementally(event).catch((error) => {
    console.warn('[CRM] Contexto Vivo não foi atualizado:', error);
  });
}
