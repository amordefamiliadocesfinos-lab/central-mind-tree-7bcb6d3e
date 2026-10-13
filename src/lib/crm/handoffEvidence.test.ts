import { evaluateCrmHandoffEvidence } from './handoffEvidence';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`CRM F4-A: ${message}`);
}

const contactId = 'contato-correto';
const orderId = '8f3f0e0a-32df-4d91-9448-23e822f0b02a';
const order = {
  id: orderId,
  contact_id: contactId,
  order_number: 'PED-015',
  sale_origin: 'crm_inbox',
  operational_status: 'finalized',
};

const linked = evaluateCrmHandoffEvidence({
  contactId, handoffRequired: true, referencedOrderId: orderId,
  lookup: 'found', order,
});
assert(linked.state === 'linked_order' && linked.orderNumber === 'PED-015'
  && linked.explicitOrderLinkVerified && !linked.handoffReceivedVerified,
  'ID explícito, pedido real e contato coincidente comprovam só vínculo, não recebimento do handoff.');
assert(linked.operationalStatus === 'finalized' && linked.message.includes('não está comprovado'),
  'Status finalizado de Pedido não equivale a aceite formal do handoff de Operações.');

for (const name of ['Lurdes', 'Graciela', 'Armando']) {
  const declared = evaluateCrmHandoffEvidence({
    contactId: name, handoffRequired: true, referencedOrderId: null,
    lookup: 'not_requested', order,
  });
  assert(declared.state === 'declared_without_order' && !declared.explicitOrderLinkVerified
    && !declared.handoffReceivedVerified && declared.orderId === null,
    `${name}: pedido histórico de outro contato não pode comprovar vínculo com último Resultado.`);
}

const mismatch = evaluateCrmHandoffEvidence({
  contactId: 'outro-contato', handoffRequired: true, referencedOrderId: orderId,
  lookup: 'found', order,
});
assert(mismatch.state === 'unconfirmed_reference' && !mismatch.explicitOrderLinkVerified,
  'ID existente de outro contato jamais comprova vínculo.');
const wrongId = evaluateCrmHandoffEvidence({
  contactId, handoffRequired: true,
  referencedOrderId: 'a873cd01-d3bd-4682-a2f4-d0727cfa9572',
  lookup: 'found', order,
});
assert(wrongId.state === 'unconfirmed_reference', 'Pedido anterior do contato não substitui ID declarado no Resultado.');
const missing = evaluateCrmHandoffEvidence({
  contactId, handoffRequired: true, referencedOrderId: orderId, lookup: 'missing', order: null,
});
const error = evaluateCrmHandoffEvidence({
  contactId, handoffRequired: true, referencedOrderId: orderId, lookup: 'error', order: null,
});
assert(missing.state === 'unconfirmed_reference' && error.state === 'unconfirmed_reference',
  'Falha ou ausência do Pedido nunca produz confirmação falsa.');
const loading = evaluateCrmHandoffEvidence({
  contactId, handoffRequired: true, referencedOrderId: orderId, lookup: 'loading', order: null,
});
assert(loading.state === 'checking_order' && !loading.explicitOrderLinkVerified,
  'Consulta pendente não pode mostrar resultado de outro contato.');
const cancelled = evaluateCrmHandoffEvidence({
  contactId, handoffRequired: true, referencedOrderId: orderId,
  lookup: 'found', order: { ...order, operational_status: 'cancelled' },
});
assert(cancelled.state === 'linked_cancelled_order' && cancelled.explicitOrderLinkVerified
  && !cancelled.handoffReceivedVerified,
  'Pedido cancelado tem vínculo registrado, mas não continuidade confirmada.');
const noHandoff = evaluateCrmHandoffEvidence({
  contactId, handoffRequired: null, referencedOrderId: null,
  lookup: 'not_requested', order: null,
});
assert(noHandoff.state === 'not_required' && !noHandoff.handoffReceivedVerified,
  'Sem metadado canônico de handoff não inventar dependência.');
const linkedWithoutFlag = evaluateCrmHandoffEvidence({
  contactId, handoffRequired: null, referencedOrderId: orderId,
  lookup: 'found', order,
});
assert(linkedWithoutFlag.explicitOrderLinkVerified && !linkedWithoutFlag.handoffReceivedVerified,
  'Resultado legado com ID explícito ainda pode comprovar vínculo, nunca recebimento.');
console.log('handoffEvidence.test: OK');
