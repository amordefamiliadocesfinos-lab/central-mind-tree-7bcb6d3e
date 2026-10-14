import { evaluateCrmHandoffEvidence } from './handoffEvidence';
import { evaluateCrmOperationalActionEvidence, type CrmOrderSeparationEvidenceRow } from './handoffOperationalAction';

function assert(value: unknown, explanation: string): asserts value {
  if (!value) throw new Error(`CRM F4-B: ${explanation}`);
}

const contactId = 'contato-a';
const orderId = '8f3f0e0a-32df-4d91-9448-23e822f0b02a';
const linked = evaluateCrmHandoffEvidence({
  contactId, handoffRequired: true, referencedOrderId: orderId,
  lookup: 'found',
  order: { id: orderId, contact_id: contactId, order_number: '451',
    sale_origin: 'crm_inbox', operational_status: 'finalized' },
});
const row: CrmOrderSeparationEvidenceRow = {
  order_id: orderId, separation_status: 'finalized', created_at: '2026-10-12T11:00:00Z',
  first_printed_at: '2026-10-12T12:00:00Z', first_printed_by: 'operator-a',
  finalized_at: '2026-10-12T14:00:00Z', finalized_by: 'operator-b',
};

const finalized = evaluateCrmOperationalActionEvidence({ orderLink: linked, lookup: 'found', separation: row });
assert(finalized.state === 'separation_finalized' && finalized.operationalActionVerified
  && finalized.assumedInFlowVerified && finalized.assumedInFlowAt === row.first_printed_at
  && !finalized.handoffFormallyAcceptedVerified && finalized.activityAt === row.finalized_at,
  'Finalização com data e ator comprova atuação, jamais aceite formal do handoff.');

const printed = evaluateCrmOperationalActionEvidence({
  orderLink: linked, lookup: 'found',
  separation: { ...row, finalized_at: null, finalized_by: null, separation_status: 'preparing' },
});
assert(printed.state === 'print_requested' && printed.operationalActionVerified
  && printed.assumedInFlowVerified && printed.assumedInFlowAt === row.first_printed_at
  && !printed.handoffFormallyAcceptedVerified && printed.message.includes('Não confirma impressão física'),
  'RPC de impressão comprova acionamento, não emissão física nem recebimento formal.');

const legacyFinalized = evaluateCrmOperationalActionEvidence({
  orderLink: linked, lookup: 'found',
  separation: { ...row, first_printed_by: null, finalized_by: null },
});
assert(legacyFinalized.state === 'no_verified_action' && !legacyFinalized.operationalActionVerified,
  'Status finalized sem ator não é prova de atuação identificada.');
const invalidTime = evaluateCrmOperationalActionEvidence({
  orderLink: linked, lookup: 'found',
  separation: { ...row, finalized_at: 'inválido', first_printed_at: null },
});
assert(invalidTime.state === 'no_verified_action' && !invalidTime.operationalActionVerified,
  'Data inválida não é registro verificável.');

const wrongOrder = evaluateCrmOperationalActionEvidence({
  orderLink: linked, lookup: 'found', separation: { ...row, order_id: 'outro-pedido' },
});
assert(wrongOrder.state === 'no_verified_action' && !wrongOrder.operationalActionVerified,
  'Separação de outro Pedido não pode comprovar atuação no atendimento selecionado.');

for (const name of ['Lurdes','Graciela','Armando']) {
  const noReference = evaluateCrmHandoffEvidence({
    contactId: name, handoffRequired: true, referencedOrderId: null,
    lookup: 'not_requested', order: null,
  });
  const assessment = evaluateCrmOperationalActionEvidence({
    orderLink: noReference, lookup: 'found', separation: row,
  });
  assert(assessment.state === 'not_applicable' && !assessment.operationalActionVerified,
    `${name}: pedidos históricos sem vínculo explícito não são evidência de handoff.`);
}
const cancelled = evaluateCrmHandoffEvidence({
  contactId, handoffRequired: true, referencedOrderId: orderId, lookup: 'found',
  order: { id: orderId, contact_id: contactId, order_number: '451',
    sale_origin: 'crm_inbox', operational_status: 'cancelled' },
});
const cancelledActivity = evaluateCrmOperationalActionEvidence({ orderLink: cancelled, lookup: 'found', separation: row });
assert(cancelledActivity.state === 'cancelled' && !cancelledActivity.operationalActionVerified,
  'Pedido cancelado não pode aparecer como continuidade vigente.');

const pending = evaluateCrmOperationalActionEvidence({ orderLink: linked, lookup: 'loading', separation: row });
const unavailable = evaluateCrmOperationalActionEvidence({ orderLink: linked, lookup: 'error', separation: null });
const missing = evaluateCrmOperationalActionEvidence({ orderLink: linked, lookup: 'missing', separation: null });
assert(pending.state === 'checking' && !pending.operationalActionVerified,
  'Durante consulta não aproveitar evidência antiga.');
assert(unavailable.state === 'unavailable' && !unavailable.operationalActionVerified,
  'Falha de consulta não é ausência afirmativa nem comprovante.');
assert(missing.state === 'no_verified_action' && !missing.operationalActionVerified,
  'Ausência de separação não comprova ação de Operações.');
// F4-C.2: finalização direta também constitui primeiro ato quando não houve impressão.
const directFinalization = evaluateCrmOperationalActionEvidence({
  orderLink: linked, lookup: 'found',
  separation: { ...row, first_printed_at: null, first_printed_by: null },
});
assert(directFinalization.state === 'separation_finalized'
  && directFinalization.assumedInFlowVerified
  && directFinalization.assumedInFlowAt === row.finalized_at,
  'finalização com data e operador autoriza assunção no próprio fluxo');

const queueOnly = evaluateCrmOperationalActionEvidence({
  orderLink: linked, lookup: 'found',
  separation: { ...row, separation_status: 'todo',
    first_printed_at: null, first_printed_by: null,
    finalized_at: null, finalized_by: null },
});
assert(!queueOnly.assumedInFlowVerified && queueOnly.assumedInFlowAt === null,
  'linha de Separação em A Fazer não significa aceite');

const revertedToTodo = evaluateCrmOperationalActionEvidence({
  orderLink: linked, lookup: 'found',
  separation: { ...row, separation_status: 'todo', finalized_at: null, finalized_by: null },
});
assert(revertedToTodo.operationalActionVerified && !revertedToTodo.assumedInFlowVerified,
  'carimbo de impressão histórico não significa assunção ativa após retorno a A Fazer');

const oldStatusNoUser = evaluateCrmOperationalActionEvidence({
  orderLink: linked, lookup: 'found',
  separation: { ...row, separation_status: 'finalized',
    first_printed_at: row.first_printed_at, first_printed_by: null,
    finalized_at: row.finalized_at, finalized_by: null },
});
assert(!oldStatusNoUser.assumedInFlowVerified,
  'Pedido finalizado legado sem ator não é considerado assumido');

const latePrint = evaluateCrmOperationalActionEvidence({
  orderLink: linked, lookup: 'found',
  separation: { ...row, first_printed_at: '2026-10-12T15:00:00Z' },
});
assert(latePrint.assumedInFlowAt === row.finalized_at,
  'evento de impressão posterior à finalização não altera a primeira assunção');

assert(!wrongOrder.assumedInFlowVerified && !cancelledActivity.assumedInFlowVerified
  && !pending.assumedInFlowVerified && !unavailable.assumedInFlowVerified
  && !missing.assumedInFlowVerified,
  'falha de identidade, cancelamento ou consulta nunca cria aceite presumido');

console.log('handoffOperationalAction.test: OK');
