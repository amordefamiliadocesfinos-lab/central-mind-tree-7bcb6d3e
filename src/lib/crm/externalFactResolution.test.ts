import { describe, expect, it } from 'vitest';
import type { CrmNewFact } from './canonical/types';
import { buildExternalFactApplication } from './externalFactResolution';

const fact = (eventType: CrmNewFact['eventType']): CrmNewFact => ({
  source: 'integration',
  eventType,
  timestamp: '2026-09-21T12:00:00Z',
  contactId: 'contact-1',
  conversationId: 'conversation-1',
  externalId: 'external-1',
});

describe('F5-B1b — resolução de fato externo pelo motor canônico', () => {
  it.each([
    ['payment_informed', 'CRM-RES-019'],
    ['payment_confirmed', 'CRM-RES-020'],
    ['order_confirmed', 'CRM-RES-021'],
    ['post_sale_issue', 'CRM-RES-024'],
    ['delivery_confirmed', 'CRM-RES-023'],
  ] as const)('resolve %s para %s', (eventType, expected) => {
    const plan = buildExternalFactApplication(fact(eventType), {
      currentStage: 'negociacao',
      currentNextActionDate: '2026-09-22T12:00:00Z',
      currentReturnAt: '2026-09-22T12:00:00Z',
      conversationStatus: 'open',
      attendanceState: 'em_atendimento',
      needsReply: false,
    });

    expect(plan.resultCode).toBe(expected);
    expect(plan.scheduledFor).toBeNull();
  });

  it('não inventa programação temporal para fato externo', () => {
    const plan = buildExternalFactApplication(fact('delivery_confirmed'));
    expect(plan.scheduledFor).toBeNull();
  });
});
