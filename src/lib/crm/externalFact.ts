import type { CrmEventType, CrmNewFact } from './canonical/types';

const EXTERNAL_OPERATIONAL_EVENT_TYPES = new Set<CrmEventType>([
  'payment_informed',
  'payment_confirmed',
  'order_confirmed',
  'post_sale_issue',
  'delivery_confirmed',
]);

export type ExternalFactIngestionResult =
  | { status: 'accepted'; fact: CrmNewFact }
  | { status: 'ignored'; reason: string }
  | { status: 'invalid'; reason: string };

function isValidTimestamp(value: string): boolean {
  return value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

function hasStructuredIssueIdentity(input: CrmNewFact): boolean {
  if (input.externalId?.trim()) return true;

  const occurrenceId = input.metadata?.occurrenceId;
  return typeof occurrenceId === 'string' && occurrenceId.trim().length > 0;
}

/**
 * F5-B1a: fronteira pura de ingestão de fatos externos.
 *
 * Valida somente se um fato operacional estruturado possui informação suficiente
 * para ser apresentado ao CRM. Não decide Resultado, não persiste e não executa
 * efeitos operacionais.
 */
export function ingestExternalCrmFact(input: CrmNewFact): ExternalFactIngestionResult {
  if (!EXTERNAL_OPERATIONAL_EVENT_TYPES.has(input.eventType)) {
    return { status: 'ignored', reason: 'event_type_outside_external_operational_scope' };
  }

  if (!isValidTimestamp(input.timestamp)) {
    return { status: 'invalid', reason: 'invalid_timestamp' };
  }

  if (!input.contactId?.trim()) {
    return { status: 'invalid', reason: 'missing_contact_id' };
  }

  if (input.eventType === 'post_sale_issue' && !hasStructuredIssueIdentity(input)) {
    return { status: 'invalid', reason: 'missing_structured_issue_identity' };
  }

  const fact: CrmNewFact = {
    ...input,
    contactId: input.contactId.trim(),
    metadata: input.metadata ? { ...input.metadata } : undefined,
  };

  return { status: 'accepted', fact };
}
