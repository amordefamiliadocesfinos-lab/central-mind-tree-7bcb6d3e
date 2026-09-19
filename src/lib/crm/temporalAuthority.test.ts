import { describe, expect, it } from 'vitest';
import {
  classifyTemporalFact,
  evaluateTemporalAuthority,
  getTemporalInvalidations,
  type TemporalSchedule,
} from './temporalAuthority';

const waitingSchedules: TemporalSchedule[] = [
  { kind: 'return_at', dependency: 'waiting_customer', scheduledAt: '2026-09-20T10:00:00Z' },
  { kind: 'next_action', dependency: 'waiting_customer', scheduledAt: '2026-09-20T10:00:00Z' },
  { kind: 'crm_next_action', dependency: 'waiting_customer', scheduledAt: '2026-09-20T10:00:00Z' },
  { kind: 'follow_up_cycle', dependency: 'conversation_context' },
  { kind: 'crm_reactivation', dependency: 'independent', scheduledAt: '2026-10-20T10:00:00Z' },
];

describe('F4-A — autoridade temporal canônica', () => {
  it('inbound novo invalida retorno antigo, reavalia próxima ação e zera follow-up', () => {
    const fact = classifyTemporalFact({ direction: 'inbound', occurredAt: '2026-09-19T12:00:00Z' });
    const result = getTemporalInvalidations(fact, waitingSchedules);
    expect(result.invalidateReturnAt).toBe(true);
    expect(result.reassessNextAction).toBe(true);
    expect(result.resetFollowUpCycle).toBe(true);
  });

  it('inbound novo preserva reativação comercial independente', () => {
    const fact = classifyTemporalFact({ eventCode: 'customer_replied' });
    const result = getTemporalInvalidations(fact, waitingSchedules);
    expect(result.preserveReactivation).toBe(true);
  });

  it('passagem do tempo mantém obrigação válida', () => {
    const fact = classifyTemporalFact({ eventCode: 'time_elapsed' });
    expect(evaluateTemporalAuthority(fact, waitingSchedules[0]).decision).toBe('keep');
    expect(evaluateTemporalAuthority(fact, waitingSchedules[1]).decision).toBe('keep');
  });

  it('reagendamento não conta como encerramento de follow-up', () => {
    const fact = classifyTemporalFact({ eventCode: 'next_action_rescheduled' });
    expect(evaluateTemporalAuthority(fact, waitingSchedules[3]).decision).toBe('keep');
  });

  it('Resultado canônico reavalia somente programação dependente', () => {
    const fact = classifyTemporalFact({ isCanonicalResult: true });
    expect(evaluateTemporalAuthority(fact, waitingSchedules[1]).decision).toBe('requires_reassessment');
    expect(evaluateTemporalAuthority(fact, waitingSchedules[4]).decision).toBe('preserve_reactivation');
  });

  it('desfecho operacional invalida programação dependente e encerra ciclo', () => {
    const fact = classifyTemporalFact({ eventCode: 'sale_won' });
    expect(evaluateTemporalAuthority(fact, waitingSchedules[0]).decision).toBe('invalidate');
    expect(evaluateTemporalAuthority(fact, waitingSchedules[3]).decision).toBe('reset_cycle');
  });

  it('não depende de texto livre para classificar fato', () => {
    const fact = classifyTemporalFact({ eventCode: 'mensagem qualquer que parece importante' });
    expect(fact.kind).toBe('unknown');
    expect(fact.isNewFact).toBe(false);
  });

  it('outbound não apaga programação automaticamente', () => {
    const fact = classifyTemporalFact({ direction: 'outbound' });
    expect(evaluateTemporalAuthority(fact, waitingSchedules[0]).decision).toBe('keep');
    expect(evaluateTemporalAuthority(fact, waitingSchedules[1]).decision).toBe('keep');
  });
});
