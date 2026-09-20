import { describe, expect, it } from 'vitest';
import type { CrmNewFact } from './canonical/types';
import { ingestExternalCrmFact } from './externalFact';

const baseFact = (eventType: CrmNewFact['eventType']): CrmNewFact => ({
  source: 'integration',
  eventType,
  timestamp: '2026-09-20T15:00:00Z',
  contactId: 'contact-123',
  externalId: 'external-123',
  metadata: { producer: 'test' },
});

describe('F5-B1a — ingestão pura de fato externo', () => {
  it.each(['order_confirmed', 'payment_confirmed', 'delivery_confirmed'] as const)(
    'aceita %s estruturado',
    (eventType) => {
      expect(ingestExternalCrmFact(baseFact(eventType)).status).toBe('accepted');
    },
  );

  it('aceita post_sale_issue com metadata estruturada', () => {
    const result = ingestExternalCrmFact({
      ...baseFact('post_sale_issue'),
      metadata: { occurrenceId: 'occ-1', category: 'delivery' },
    });

    expect(result.status).toBe('accepted');
  });

  it('rejeita fato operacional sem contactId', () => {
    const result = ingestExternalCrmFact({ ...baseFact('order_confirmed'), contactId: null });
    expect(result).toEqual({ status: 'invalid', reason: 'missing_contact_id' });
  });

  it('rejeita timestamp inválido', () => {
    const result = ingestExternalCrmFact({ ...baseFact('payment_confirmed'), timestamp: 'not-a-date' });
    expect(result).toEqual({ status: 'invalid', reason: 'invalid_timestamp' });
  });

  it('ignora eventType fora do escopo operacional externo', () => {
    const result = ingestExternalCrmFact(baseFact('message_received'));
    expect(result).toEqual({ status: 'ignored', reason: 'event_type_outside_external_operational_scope' });
  });

  it('não inventa externalId quando ele não foi fornecido', () => {
    const input = { ...baseFact('delivery_confirmed'), externalId: undefined };
    const result = ingestExternalCrmFact(input);

    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') expect(result.fact.externalId).toBeUndefined();
  });

  it('preserva metadata sem compartilhar o mesmo objeto', () => {
    const metadata = { orderId: 'order-1', paid: true };
    const result = ingestExternalCrmFact({ ...baseFact('payment_confirmed'), metadata });

    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') {
      expect(result.fact.metadata).toEqual(metadata);
      expect(result.fact.metadata).not.toBe(metadata);
    }
  });

  it('não muta o input', () => {
    const input = { ...baseFact('order_confirmed'), contactId: ' contact-123 ' };
    const snapshot = structuredClone(input);
    const result = ingestExternalCrmFact(input);

    expect(result.status).toBe('accepted');
    expect(input).toEqual(snapshot);
    if (result.status === 'accepted') expect(result.fact.contactId).toBe('contact-123');
  });

  it('rejeita post_sale_issue sem metadata estruturada', () => {
    const result = ingestExternalCrmFact({ ...baseFact('post_sale_issue'), metadata: undefined });
    expect(result).toEqual({ status: 'invalid', reason: 'missing_structured_issue_metadata' });
  });
});
