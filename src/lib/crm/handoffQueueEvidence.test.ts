import { evaluateCrmHandoffEvidence } from './handoffEvidence';
import { evaluateCrmHandoffQueueEvidence } from './handoffQueueEvidence';
import type { CrmOrderSeparationEvidenceRow } from './handoffOperationalAction';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(`CRM F4-C.1: ${message}`);
}
const orderId = '8f3f0e0a-32df-4d91-9448-23e822f0b02a';
const linked = evaluateCrmHandoffEvidence({
  contactId: 'contato-a', handoffRequired: true, referencedOrderId: orderId,
  lookup: 'found', order: {
    id: orderId, contact_id: 'contato-a', order_number: 'PED-451',
    sale_origin: 'crm_inbox', operational_status: 'todo',
  },
});
const row: CrmOrderSeparationEvidenceRow = {
  order_id: orderId, separation_status: 'todo',
  created_at: '2026-10-14T11:10:00Z',
  first_printed_at: null, first_printed_by: null, finalized_at: null, finalized_by: null,
};
const entry = evaluateCrmHandoffQueueEvidence({ orderLink: linked, lookup: 'found', separation: row });
assert(entry.state === 'registered' && entry.queueRegistrationVerified &&
  !entry.handoffFormallyAcceptedVerified && entry.registeredAt === row.created_at,
  'fila comprovada por ID/data sem presumir aceite formal nem impressão');
for (const status of ['preparing', 'finalized']) {
  const afterAction = evaluateCrmHandoffQueueEvidence({
    orderLink: linked, lookup: 'found', separation: { ...row, separation_status: status },
  });
  assert(afterAction.state === 'registered' && !afterAction.handoffFormallyAcceptedVerified,
    'status da Separação não substitui aceite formal');
}
const wrong = evaluateCrmHandoffQueueEvidence({
  orderLink: linked, lookup: 'found', separation: { ...row, order_id: 'outro-pedido' },
});
assert(wrong.state === 'unconfirmed_registration' && !wrong.queueRegistrationVerified,
  'registro de Pedido diferente não comprova encaminhamento');
for (const date of [null, 'data-invalidada']) {
  const invalid = evaluateCrmHandoffQueueEvidence({
    orderLink: linked, lookup: 'found', separation: { ...row, created_at: date },
  });
  assert(invalid.state === 'unconfirmed_registration' && !invalid.queueRegistrationVerified,
    'sem data verificável não confirmar a fila');
}
const cancelled = evaluateCrmHandoffEvidence({
  contactId: 'contato-a', handoffRequired: true, referencedOrderId: orderId, lookup: 'found',
  order: { id: orderId, contact_id: 'contato-a', order_number: 'PED-451',
    sale_origin: 'crm_inbox', operational_status: 'cancelled' },
});
assert(evaluateCrmHandoffQueueEvidence({ orderLink: cancelled, lookup: 'found', separation: row }).state
  === 'cancelled', 'cancelamento impede continuidade vigente');
const noLink = evaluateCrmHandoffEvidence({
  contactId: 'contato-a', handoffRequired: true, referencedOrderId: null,
  lookup: 'not_requested', order: null,
});
assert(evaluateCrmHandoffQueueEvidence({ orderLink: noLink, lookup: 'found', separation: row }).state
  === 'not_applicable', 'sem ID do último Resultado não utilizar Pedido histórico');
for (const [lookup, state] of [
  ['loading','checking'], ['error','unavailable'], ['missing','not_registered'],
] as const) {
  const evidence = evaluateCrmHandoffQueueEvidence({ orderLink: linked, lookup, separation: row });
  assert(evidence.state === state && !evidence.queueRegistrationVerified,
    'consulta não confirmada não pode reaproveitar linha anterior');
}
console.log('handoffQueueEvidence.test: OK');
