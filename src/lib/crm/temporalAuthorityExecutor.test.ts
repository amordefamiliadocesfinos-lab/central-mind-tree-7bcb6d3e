import { describe, expect, it, vi } from 'vitest';
import { executeTemporalAuthority, type TemporalAuthorityPersistence } from './temporalAuthorityExecutor';
import type { TemporalInvalidations } from './temporalAuthority';

function invalidations(overrides: Partial<TemporalInvalidations> = {}): TemporalInvalidations {
  return {
    invalidateReturnAt: false,
    invalidateNextAction: false,
    invalidateCrmNextActionTask: false,
    resetFollowUpCycle: false,
    preserveReactivation: false,
    reassessNextAction: false,
    ...overrides,
  };
}

function persistenceMock(): TemporalAuthorityPersistence {
  return {
    clearConversationReturn: vi.fn().mockResolvedValue(undefined),
    clearContactNextAction: vi.fn().mockResolvedValue(undefined),
    clearCrmNextActionTask: vi.fn().mockResolvedValue(undefined),
  };
}

describe('F4-B1 — executor granular da autoridade temporal', () => {
  it('invalida somente return_at quando esta é a única invalidação física', async () => {
    const persistence = persistenceMock();
    const result = await executeTemporalAuthority({
      contactId: 'contact-1',
      conversationId: 'conversation-1',
      invalidations: invalidations({
        invalidateReturnAt: true,
        resetFollowUpCycle: true,
        preserveReactivation: true,
        reassessNextAction: true,
      }),
    }, persistence);

    expect(persistence.clearConversationReturn).toHaveBeenCalledWith('conversation-1', 'contact-1');
    expect(persistence.clearContactNextAction).not.toHaveBeenCalled();
    expect(persistence.clearCrmNextActionTask).not.toHaveBeenCalled();
    expect(result.followUpCycleResetByBoundary).toBe(true);
    expect(result.nextActionRequiresReassessment).toBe(true);
    expect(result.reactivationPreserved).toBe(true);
  });

  it('reavaliação não apaga intenção nem tarefa de próxima ação', async () => {
    const persistence = persistenceMock();
    const result = await executeTemporalAuthority({
      contactId: 'contact-1',
      invalidations: invalidations({ reassessNextAction: true }),
    }, persistence);

    expect(persistence.clearContactNextAction).not.toHaveBeenCalled();
    expect(persistence.clearCrmNextActionTask).not.toHaveBeenCalled();
    expect(result.nextActionRequiresReassessment).toBe(true);
  });

  it('invalida intenção e tarefa separadamente quando F4-A autoriza ambas', async () => {
    const persistence = persistenceMock();
    const result = await executeTemporalAuthority({
      contactId: 'contact-1',
      invalidations: invalidations({
        invalidateNextAction: true,
        invalidateCrmNextActionTask: true,
      }),
    }, persistence);

    expect(persistence.clearContactNextAction).toHaveBeenCalledWith('contact-1');
    expect(persistence.clearCrmNextActionTask).toHaveBeenCalledWith('contact-1');
    expect(result.nextActionInvalidated).toBe(true);
    expect(result.crmNextActionTaskInvalidated).toBe(true);
  });

  it('não limpa retorno sem conversationId para evitar efeito amplo por contato', async () => {
    const persistence = persistenceMock();
    const result = await executeTemporalAuthority({
      contactId: 'contact-1',
      invalidations: invalidations({ invalidateReturnAt: true }),
    }, persistence);

    expect(persistence.clearConversationReturn).not.toHaveBeenCalled();
    expect(result.returnAtInvalidated).toBe(false);
  });

  it('preservação de reativação não dispara persistência', async () => {
    const persistence = persistenceMock();
    const result = await executeTemporalAuthority({
      contactId: 'contact-1',
      invalidations: invalidations({ preserveReactivation: true }),
    }, persistence);

    expect(persistence.clearConversationReturn).not.toHaveBeenCalled();
    expect(persistence.clearContactNextAction).not.toHaveBeenCalled();
    expect(persistence.clearCrmNextActionTask).not.toHaveBeenCalled();
    expect(result.reactivationPreserved).toBe(true);
  });
});
