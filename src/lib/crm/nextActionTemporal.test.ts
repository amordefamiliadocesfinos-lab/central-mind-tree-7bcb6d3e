import { describe, expect, it } from 'vitest';
import { classifyTemporalFact, evaluateTemporalAuthority } from './temporalAuthority';
import { describeCrmNextActionChange } from './nextAction';

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

  it('descreve mudança apenas de data como reagendamento, sem repetir o mesmo título', () => {
    const description = describeCrmNextActionChange({
      previousTitle: 'Retomar contato',
      previousDueAt: '2026-10-09T12:00:00.000Z',
      nextTitle: 'Retomar contato',
      nextDueAt: '2026-10-19T03:00:00.000Z',
    });
    expect(description).toBe('Próxima ação reagendada: Retomar contato · 09/10/2026 → 19/10/2026');
  });

  it('preserva descrição de substituição quando a ação realmente muda', () => {
    const description = describeCrmNextActionChange({
      previousTitle: 'Verificar resposta no WhatsApp',
      previousDueAt: '2026-10-11T12:00:00.000Z',
      nextTitle: 'Retomar contato',
      nextDueAt: '2026-10-19T03:00:00.000Z',
    });
    expect(description).toBe('Próxima ação substituída: Verificar resposta no WhatsApp → Retomar contato');
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
