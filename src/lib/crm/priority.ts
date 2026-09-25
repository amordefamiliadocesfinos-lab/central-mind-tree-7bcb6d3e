import { parseISO } from 'date-fns';

export type CrmPriorityLevel = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

export type CrmPriorityReason =
  | 'needs_reply'
  | 'pending_result'
  | 'return_overdue'
  | 'next_action_overdue'
  | 'return_today'
  | 'next_action_today'
  | 'reactivation_overdue'
  | 'reactivation_today'
  | 'follow_up_urgent'
  | 'cooling'
  | 'normal'
  | 'future'
  | 'waiting_customer'
  | 'resolved';


export interface CrmPriorityInput {
  needs_reply?: boolean | null;
  status?: string | null;
  attendance_state?: string | null;
  return_at?: string | null;
  next_action_date?: string | null;
  /** Obrigação de recompra futura: não substitui Próxima Ação nem return_at. */
  reactivation_at?: string | null;
  /** Compatibilidade temporária: nunca vence a data canônica quando ela existe. */
  next_contact_date?: string | null;
  ultimo_contato?: string | null;
  last_inbound_at?: string | null;
  last_outbound_at?: string | null;
  last_message_at?: string | null;
  /** Momento do último Resultado canônico registrado para o contato. */
  last_result_at?: string | null;

  /** Momento em que o estado atual do atendimento foi registrado. */
  attendance_state_updated_at?: string | null;
  no_response_status?: 'sem_resposta' | 'follow_up_urgente' | 'lead_esfriando' | null;
  is_lead_or_quote?: boolean;
}

export interface CrmPriority {
  level: CrmPriorityLevel;
  reason: CrmPriorityReason;
  label: string;
  sortAt: number;
  /** Conversas resolvidas e ações futuras não pertencem à fila imediata. */
  operational: boolean;
}

const LABELS: Record<CrmPriorityReason, string> = {
  needs_reply: 'Precisa responder',
  pending_result: 'Registrar resultado',
  return_overdue: 'Retorno vencido',

  next_action_overdue: 'Ação atrasada',
  return_today: 'Retorno hoje',
  next_action_today: 'Ação hoje',
  reactivation_overdue: 'Reativação comercial atrasada',
  reactivation_today: 'Reativação comercial',
  follow_up_urgent: 'Follow-up urgente',
  cooling: 'Esfriando',
  normal: 'Fila normal',
  future: 'Ação futura',
  waiting_customer: 'Aguardando cliente',
  resolved: 'Conversa resolvida',
};

function asTime(value?: string | null) {
  if (!value) return null;
  const time = parseISO(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function dayBounds(now: Date) {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

function result(level: CrmPriorityLevel, reason: CrmPriorityReason, sortAt: number, operational = true): CrmPriority {
  return { level, reason, label: LABELS[reason], sortAt, operational };
}

/**
 * Representações equivalentes, já existentes no sistema, do estado
 * "aguardando cliente/resposta". Centralizadas para produzir o mesmo
 * comportamento na fila, independente da origem do dado.
 */
const WAITING_CUSTOMER_STATES = new Set([
  'aguardando_cliente',
  'aguardando_resposta',
  'retornar_em',
  'awaiting_response',
  'waiting_customer',
]);

export function isWaitingCustomerState(state?: string | null): boolean {
  if (!state) return false;
  const normalized = state
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return WAITING_CUSTOMER_STATES.has(normalized);
}

/**
 * Motor único, puro e determinístico para prioridade do CRM.
 * Não grava dados e não escolhe responsável; apenas explica a próxima atenção.
 */
export function getCrmPriority(input: CrmPriorityInput, now = new Date()): CrmPriority {
  const lastMessageAt = asTime(input.last_message_at) ?? 0;
  const lastInboundAt = asTime(input.last_inbound_at);
  const lastOutboundAt = asTime(input.last_outbound_at);
  const waitingStateAt = asTime(input.attendance_state_updated_at);
  const { start, end } = dayBounds(now);

  const returnAt = asTime(input.return_at);
  // Próxima Ação canônica (next_action_date) representa obrigação oficial.
  // next_contact_date é apenas compatibilidade legada e pode ser descartada
  // quando ficou anterior a um novo estado de espera.
  const canonicalNextActionAt = asTime(input.next_action_date);
  const legacyNextContactAt = asTime(input.next_contact_date);
  const nextActionAt = canonicalNextActionAt ?? legacyNextContactAt;
  const reactivationAt = asTime(input.reactivation_at);
  const reactivationOverdue = reactivationAt !== null && reactivationAt < start;
  const reactivationToday = reactivationAt !== null && reactivationAt >= start && reactivationAt < end;

  const waitingState = isWaitingCustomerState(input.attendance_state);
  const waitingBoundary = Math.max(waitingStateAt ?? 0, lastOutboundAt ?? 0);
  // Uma entrada só é nova quando ocorreu depois do envio/registro que colocou
  // o atendimento em espera. A igualdade com updated_at é válida porque a
  // própria entrada atualiza a conversa; igualdade só com last_message_at não é.
  const clientRepliedAfterWaiting = waitingState
    && lastInboundAt !== null
    && lastInboundAt > (lastOutboundAt ?? 0)
    && (waitingStateAt !== null
      ? lastInboundAt >= waitingStateAt
      : lastInboundAt > lastMessageAt);
  const waitingCustomer = waitingState && !clientRepliedAfterWaiting;

  const validReturn = returnAt !== null
    && (lastInboundAt === null || lastInboundAt <= returnAt)
    && (!waitingCustomer || returnAt >= waitingBoundary);
  // Uma obrigação canônica pendente não pode ser escondida pela Inbox como
  // "resíduo". Se ficou obsoleta, o writer deve concluí-la/substituí-la.
  // Somente a data legada continua sujeita ao corte pelo início da espera.
  const validNextAction = nextActionAt !== null
    && (canonicalNextActionAt !== null || !waitingCustomer || nextActionAt >= waitingBoundary);

  // Regra soberana da fila: marcadores antigos não mantêm uma conversa em
  // Prioridade enquanto a iniciativa está com o cliente. Somente uma entrada
  // nova ou um compromisso realmente vencido após o início da espera reativa.
  const waitingHasDueAction = waitingCustomer && (
    (validReturn && returnAt < now.getTime())
    || (validNextAction && nextActionAt < now.getTime())
  );
  // Uma mensagem nossa não conclui o atendimento enquanto a última mensagem
  // relevante do cliente ainda não recebeu um Resultado canônico: o operador
  // precisa continuar acessando a conversa para registrar o Resultado.
  const lastResultAt = asTime(input.last_result_at);
  const pendingResult = lastInboundAt !== null
    && lastInboundAt >= start - (7 * 86400000)
    && (lastResultAt === null || lastInboundAt > lastResultAt);

  // Uma reativação de recompra é a única obrigação que pode trazer de volta
  // uma conversa já resolvida. Ela nunca se apresenta como mensagem pendente.
  if (input.status === 'resolved') {
    if (reactivationOverdue) return result('P1', 'reactivation_overdue', reactivationAt!);
    if (reactivationToday) return result('P1', 'reactivation_today', reactivationAt!);
    // Pós-venda e demais próximas ações oficiais podem nascer após o
    // atendimento ser concluído. A tarefa devolve o contato à Inbox na data,
    // sem transformar a ação futura em atendimento aberto antes da hora.
    if (nextActionAt !== null && nextActionAt < start) return result('P1', 'next_action_overdue', nextActionAt);
    if (nextActionAt !== null && nextActionAt < end) return result('P1', 'next_action_today', nextActionAt);
    return result('P4', 'resolved', lastMessageAt, false);
  }

  if (input.needs_reply && !waitingCustomer) {
    return result('P0', 'needs_reply', lastInboundAt ?? lastMessageAt);
  }

  if (reactivationOverdue) return result('P1', 'reactivation_overdue', reactivationAt!);
  if (reactivationToday) return result('P1', 'reactivation_today', reactivationAt!);

  if (waitingCustomer && !waitingHasDueAction) {
    if (pendingResult) return result('P1', 'pending_result', lastInboundAt!);
    return result('P4', 'waiting_customer', validReturn ? returnAt : validNextAction ? nextActionAt : waitingBoundary || lastMessageAt, false);
  }

  // Enquanto aguardamos o cliente, datas legadas anteriores à nossa última
  // mensagem são resíduo. Uma Próxima Ação canônica pendente continua valendo
  // até o writer concluí-la ou substituí-la.
  const returnCounts = validReturn;
  const nextActionCounts = validNextAction;

  if (returnCounts && returnAt! < start) return result('P0', 'return_overdue', returnAt!);
  if (nextActionCounts && nextActionAt! < start) return result('P0', 'next_action_overdue', nextActionAt!);

  if (!waitingCustomer && input.no_response_status === 'follow_up_urgente') {
    return result('P0', 'follow_up_urgent', lastMessageAt);
  }
  if (returnCounts && returnAt! < end) return result('P1', 'return_today', returnAt!);
  if (nextActionCounts && nextActionAt! < end) return result('P1', 'next_action_today', nextActionAt!);

  // Mensagem enviada e nada vencido: a bola está com o cliente. Sai da fila
  // até haver resposta nova ou retorno/próxima ação realmente devida.
  if (waitingCustomer) {
    if (pendingResult) return result('P1', 'pending_result', lastInboundAt!);
    const sortAt = returnCounts ? returnAt! : nextActionCounts ? nextActionAt! : lastMessageAt;
    return result('P4', 'waiting_customer', sortAt, false);
  }




  const lastContactAt = asTime(input.ultimo_contato);
  const tenDaysAgo = start - (10 * 86400000);
  const hasCoolingSignal = input.no_response_status === 'lead_esfriando'
    || (input.is_lead_or_quote === true && (lastContactAt === null || lastContactAt < tenDaysAgo));
  if (hasCoolingSignal) return result('P2', 'cooling', lastContactAt ?? lastMessageAt);

  if (nextActionAt !== null && nextActionAt >= end) return result('P4', 'future', nextActionAt, false);
  return result('P3', 'normal', lastMessageAt);
}

const LEVEL_ORDER: Record<CrmPriorityLevel, number> = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };

export function compareCrmPriority(a: CrmPriorityInput, b: CrmPriorityInput, now = new Date()) {
  const priorityA = getCrmPriority(a, now);
  const priorityB = getCrmPriority(b, now);
  const levelDifference = LEVEL_ORDER[priorityA.level] - LEVEL_ORDER[priorityB.level];
  if (levelDifference !== 0) return levelDifference;
  if (priorityA.level === 'P3') return priorityB.sortAt - priorityA.sortAt;
  return priorityA.sortAt - priorityB.sortAt;
}
