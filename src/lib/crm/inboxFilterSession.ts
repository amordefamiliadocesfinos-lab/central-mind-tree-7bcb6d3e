/**
 * CRM UX Real U4-A: preferências de filtro somente da aba atual.
 * Não guarda busca livre, dados de clientes, contatos ou Resultados.
 * Não interfere no motor canônico de prioridade.
 */
export type PersistedInboxFilter = 'priority' | 'needs_reply' | 'today' | 'overdue' | 'cooling';
export type PersistedConversationScope = 'commercial' | 'suppliers';
export type PersistedAssignmentFilter = 'all' | 'assigned' | 'unassigned';

export interface InboxFilterSession {
  inboxFilter: PersistedInboxFilter;
  conversationScope: PersistedConversationScope;
  assignmentFilter: PersistedAssignmentFilter;
  stageFilter: string;
  waitingCustomerOnly: boolean;
}

export const CRM_INBOX_FILTER_SESSION_KEY = 'crm-inbox-filters-v1';

export const DEFAULT_CRM_INBOX_FILTER_SESSION: InboxFilterSession = {
  inboxFilter: 'priority',
  conversationScope: 'commercial',
  assignmentFilter: 'all',
  stageFilter: 'all',
  waitingCustomerOnly: false,
};

const allowedInboxFilters = ['priority', 'needs_reply', 'today', 'overdue', 'cooling'] as const;
const allowedScopes = ['commercial', 'suppliers'] as const;
const allowedAssignments = ['all', 'assigned', 'unassigned'] as const;
const allowedStages = ['all', 'novo_lead', 'contato_realizado', 'proposta_enviada',
  'negociacao', 'fechado', 'pos_venda', 'cadencia', 'perdido'] as const;

function oneOf<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  return typeof value === 'string' && choices.includes(value as T) ? value as T : fallback;
}

export function decodeCrmInboxFilterSession(value: string | null): InboxFilterSession {
  if (!value) return { ...DEFAULT_CRM_INBOX_FILTER_SESSION };
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...DEFAULT_CRM_INBOX_FILTER_SESSION };
    }
    const data = parsed as Record<string, unknown>;
    return {
      inboxFilter: oneOf(data.inboxFilter, allowedInboxFilters, 'priority'),
      conversationScope: oneOf(data.conversationScope, allowedScopes, 'commercial'),
      assignmentFilter: oneOf(data.assignmentFilter, allowedAssignments, 'all'),
      stageFilter: oneOf(data.stageFilter, allowedStages, 'all'),
      waitingCustomerOnly: data.waitingCustomerOnly === true,
    };
  } catch {
    return { ...DEFAULT_CRM_INBOX_FILTER_SESSION };
  }
}

export function readCrmInboxFilterSession(): InboxFilterSession {
  if (typeof window === 'undefined') return { ...DEFAULT_CRM_INBOX_FILTER_SESSION };
  try {
    return decodeCrmInboxFilterSession(window.sessionStorage.getItem(CRM_INBOX_FILTER_SESSION_KEY));
  } catch {
    return { ...DEFAULT_CRM_INBOX_FILTER_SESSION };
  }
}

export function writeCrmInboxFilterSession(state: InboxFilterSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(CRM_INBOX_FILTER_SESSION_KEY, JSON.stringify(state));
  } catch {
    // Storage indisponível não pode impedir o uso da Inbox.
  }
}
