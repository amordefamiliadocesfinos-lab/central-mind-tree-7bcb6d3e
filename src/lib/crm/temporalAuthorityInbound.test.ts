import { describe, expect, it, vi } from 'vitest';
import { applyInboundTemporalAuthority } from '../../../supabase/functions/_shared/crm/temporal-authority-inbound.ts';

function supabaseMock() {
  const eqContact = vi.fn().mockResolvedValue({ error: null });
  const eqConversation = vi.fn().mockReturnValue({ eq: eqContact });
  const update = vi.fn().mockReturnValue({ eq: eqConversation });
  const from = vi.fn().mockReturnValue({ update });
  return { client: { from }, from, update, eqConversation, eqContact };
}

describe('F4-B2 — adaptador temporal de inbound', () => {
  it('limpa somente return_at da conversa identificada e preserva reavaliação sem exclusão', async () => {
    const mock = supabaseMock();
    const result = await applyInboundTemporalAuthority(mock.client, {
      contactId: 'contact-1',
      conversationId: 'conversation-1',
      occurredAt: '2026-09-19T20:00:00Z',
    });

    expect(mock.from).toHaveBeenCalledWith('service_conversations');
    expect(mock.update).toHaveBeenCalledWith({ return_at: null });
    expect(mock.eqConversation).toHaveBeenCalledWith('id', 'conversation-1');
    expect(mock.eqContact).toHaveBeenCalledWith('contact_id', 'contact-1');
    expect(result.returnAtInvalidated).toBe(true);
    expect(result.nextActionRequiresReassessment).toBe(true);
    expect(result.followUpCycleResetByBoundary).toBe(true);
    expect(result.reactivationPreserved).toBe(true);
  });

  it('não executa limpeza ampla quando inbound não possui contato inequívoco', async () => {
    const mock = supabaseMock();
    const result = await applyInboundTemporalAuthority(mock.client, {
      contactId: null,
      conversationId: 'conversation-1',
      occurredAt: '2026-09-19T20:00:00Z',
    });

    expect(mock.from).not.toHaveBeenCalled();
    expect(result.returnAtInvalidated).toBe(false);
    expect(result.nextActionRequiresReassessment).toBe(true);
  });
});
