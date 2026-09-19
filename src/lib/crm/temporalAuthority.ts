export type TemporalFactKind =
  | 'customer_inbound'
  | 'canonical_result'
  | 'responsibility_changed'
  | 'sale_won'
  | 'sale_lost'
  | 'post_sale_completed'
  | 'reactivation_completed'
  | 'operator_outbound'
  | 'rescheduled'
  | 'time_elapsed'
  | 'unknown';

export type TemporalScheduleKind =
  | 'return_at'
  | 'next_action'
  | 'crm_next_action'
  | 'follow_up_cycle'
  | 'crm_reactivation';

export type TemporalDependency = 'waiting_customer' | 'conversation_context' | 'independent';

export interface TemporalFactInput {
  eventCode?: string | null;
  direction?: 'inbound' | 'outbound' | null;
  isCanonicalResult?: boolean;
  changesResponsibility?: boolean;
  occurredAt?: string | null;
}

export interface TemporalFact {
  kind: TemporalFactKind;
  occurredAt: string | null;
  isNewFact: boolean;
}

export interface TemporalSchedule {
  kind: TemporalScheduleKind;
  dependency: TemporalDependency;
  scheduledAt?: string | null;
}

export type TemporalAuthorityDecision =
  | 'keep'
  | 'invalidate'
  | 'reset_cycle'
  | 'requires_reassessment'
  | 'preserve_reactivation';

export interface TemporalAuthorityEvaluation {
  schedule: TemporalScheduleKind;
  decision: TemporalAuthorityDecision;
  reason: string;
}

export interface TemporalInvalidations {
  invalidateReturnAt: boolean;
  invalidateNextAction: boolean;
  invalidateCrmNextActionTask: boolean;
  resetFollowUpCycle: boolean;
  preserveReactivation: boolean;
  reassessNextAction: boolean;
}

const RESET_EVENT_CODES = new Map<string, TemporalFactKind>([
  ['customer_replied', 'customer_inbound'],
  ['sale_won', 'sale_won'],
  ['sale_lost', 'sale_lost'],
  ['post_sale_completed', 'post_sale_completed'],
  ['reactivation_completed', 'reactivation_completed'],
]);

/** Classifica fatos por sinais estruturados; nunca por texto livre. */
export function classifyTemporalFact(input: TemporalFactInput): TemporalFact {
  const occurredAt = input.occurredAt ?? null;
  if (input.direction === 'inbound') return { kind: 'customer_inbound', occurredAt, isNewFact: true };
  if (input.isCanonicalResult) return { kind: 'canonical_result', occurredAt, isNewFact: true };
  if (input.changesResponsibility) return { kind: 'responsibility_changed', occurredAt, isNewFact: true };
  if (input.eventCode && RESET_EVENT_CODES.has(input.eventCode)) {
    return { kind: RESET_EVENT_CODES.get(input.eventCode)!, occurredAt, isNewFact: true };
  }
  if (input.eventCode === 'next_action_rescheduled') return { kind: 'rescheduled', occurredAt, isNewFact: true };
  if (input.eventCode === 'time_elapsed') return { kind: 'time_elapsed', occurredAt, isNewFact: false };
  if (input.direction === 'outbound') return { kind: 'operator_outbound', occurredAt, isNewFact: true };
  return { kind: 'unknown', occurredAt, isNewFact: false };
}

/**
 * Decide somente autoridade semântica. Persistência pertence à camada executora.
 * `crm_reactivation` é obrigação independente e fica fora da limpeza genérica.
 */
export function evaluateTemporalAuthority(
  fact: TemporalFact,
  schedule: TemporalSchedule,
): TemporalAuthorityEvaluation {
  if (schedule.kind === 'crm_reactivation') {
    return {
      schedule: schedule.kind,
      decision: 'preserve_reactivation',
      reason: 'Reativação comercial é obrigação independente da programação operacional da conversa.',
    };
  }

  if (!fact.isNewFact || fact.kind === 'time_elapsed') {
    return { schedule: schedule.kind, decision: 'keep', reason: 'Passagem do tempo não invalida programação existente.' };
  }

  if (fact.kind === 'rescheduled') {
    return { schedule: schedule.kind, decision: 'keep', reason: 'Reagendamento substitui a representação executável sem encerrar o ciclo por si só.' };
  }

  if (fact.kind === 'operator_outbound') {
    return { schedule: schedule.kind, decision: 'keep', reason: 'Outbound do operador não limpa programação genericamente.' };
  }

  if (fact.kind === 'customer_inbound') {
    if (schedule.kind === 'follow_up_cycle') {
      return { schedule: schedule.kind, decision: 'reset_cycle', reason: 'Inbound real encerra o ciclo anterior de follow-up.' };
    }
    if (schedule.kind === 'return_at' && schedule.dependency !== 'independent') {
      return { schedule: schedule.kind, decision: 'invalidate', reason: 'A resposta do cliente torna obsoleto o retorno criado para aguardar essa resposta.' };
    }
    if ((schedule.kind === 'next_action' || schedule.kind === 'crm_next_action') && schedule.dependency === 'waiting_customer') {
      return { schedule: schedule.kind, decision: 'requires_reassessment', reason: 'A próxima ação dependia da resposta agora recebida e precisa ser reavaliada.' };
    }
    return { schedule: schedule.kind, decision: 'keep', reason: 'O novo inbound não invalida esta obrigação independente do contexto anterior.' };
  }

  if (fact.kind === 'canonical_result' || fact.kind === 'responsibility_changed') {
    if (schedule.kind === 'follow_up_cycle') {
      return { schedule: schedule.kind, decision: 'reset_cycle', reason: 'Mudança de responsabilidade encerra o ciclo anterior de follow-up.' };
    }
    if (schedule.dependency === 'independent') {
      return { schedule: schedule.kind, decision: 'keep', reason: 'A obrigação é independente do contexto redefinido.' };
    }
    return { schedule: schedule.kind, decision: 'requires_reassessment', reason: 'O novo fato redefiniu o contexto; a programação dependente deve ser reavaliada.' };
  }

  if (fact.kind === 'sale_won' || fact.kind === 'sale_lost' || fact.kind === 'post_sale_completed' || fact.kind === 'reactivation_completed') {
    if (schedule.kind === 'follow_up_cycle') {
      return { schedule: schedule.kind, decision: 'reset_cycle', reason: 'O desfecho encerra o ciclo operacional anterior.' };
    }
    if (schedule.dependency !== 'independent') {
      return { schedule: schedule.kind, decision: 'invalidate', reason: 'O desfecho torna incompatível a programação operacional anterior.' };
    }
  }

  return { schedule: schedule.kind, decision: 'keep', reason: 'Nenhuma incompatibilidade temporal foi identificada.' };
}

/** Agrega decisões puras em efeitos semânticos; não executa persistência. */
export function getTemporalInvalidations(
  fact: TemporalFact,
  schedules: TemporalSchedule[],
): TemporalInvalidations {
  const evaluations = schedules.map((schedule) => evaluateTemporalAuthority(fact, schedule));
  const decisionFor = (kind: TemporalScheduleKind) => evaluations.find((item) => item.schedule === kind)?.decision;
  const nextActionDecision = decisionFor('next_action');
  const taskDecision = decisionFor('crm_next_action');

  return {
    invalidateReturnAt: decisionFor('return_at') === 'invalidate',
    invalidateNextAction: nextActionDecision === 'invalidate',
    invalidateCrmNextActionTask: taskDecision === 'invalidate',
    resetFollowUpCycle: decisionFor('follow_up_cycle') === 'reset_cycle',
    preserveReactivation: decisionFor('crm_reactivation') === 'preserve_reactivation',
    reassessNextAction: nextActionDecision === 'requires_reassessment' || taskDecision === 'requires_reassessment',
  };
}
