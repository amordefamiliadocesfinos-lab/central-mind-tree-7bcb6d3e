import { describe, expect, it } from 'vitest';
import { classifyTemporalFact, evaluateTemporalAuthority } from './temporalAuthority';

describe('F4-D — reagendamento da Próxima Ação', () => {
  it('classifica reagendamento por evento estruturado e preserva a obrigação', () => {
    const fact = classifyTemporalFact({ eventCode: 'next_action_rescheduled' });
    const decision = evaluateTemporalAuthority(fact, {
      kind: 'next_action',
      dependency: 'conversation_context',
      scheduledAt: '2026-09-20T12:00:00Z',
    });

    expect(fact.kind).toBe('rescheduled');
    expect(fact.isNewFact).toBe(true);
    expect(decision.decision).toBe('keep');
  });

  it('reagendamento não encerra o ciclo de follow-up', () => {
    const fact = classifyTemporalFact({ eventCode: 'next_action_rescheduled' });
    const decision = evaluateTemporalAuthority(fact, {
      kind: 'follow_up_cycle',
      dependency: 'conversation_context',
    });

    expect(decision.decision).toBe('keep');
  });

  it('reagendamento preserva reativação independente', () => {
    const fact = classifyTemporalFact({ eventCode: 'next_action_rescheduled' });
    const decision = evaluateTemporalAuthority(fact, {
      kind: 'crm_reactivation',
      dependency: 'independent',
      scheduledAt: '2026-10-20T12:00:00Z',
    });

    expect(decision.decision).toBe('preserve_reactivation');
  });
});
