/**
 * F4-A — evidência de vínculo Pedido↔Resultado para consulta no CRM.
 *
 * Um ID explícito no ÚLTIMO Resultado só prova a referência quando o pedido
 * existe e pertence ao mesmo contato. Nunca prova que Operações recebeu ou
 * concluiu o handoff. Nenhum Pedido/OP é criado ou modificado por este leitor.
 */
export interface CrmReferencedOrder {
  id: string;
  contact_id: string | null;
  order_number: string | null;
  sale_origin: string | null;
  operational_status: string | null;
}

export type CrmOrderLookup = 'not_requested' | 'loading' | 'found' | 'missing' | 'error';
export type CrmHandoffEvidenceState =
  | 'not_required'
  | 'declared_without_order'
  | 'checking_order'
  | 'linked_order'
  | 'linked_cancelled_order'
  | 'unconfirmed_reference';

export interface CrmHandoffEvidence {
  state: CrmHandoffEvidenceState;
  /** Identidade do pedido exatamente associada ao último Resultado. */
  orderId: string | null;
  orderNumber: string | null;
  operationalStatus: string | null;
  /** Comprovação de recebimento exige fonte própria de Operações, ainda ausente. */
  handoffReceivedVerified: false;
  /** Verdadeiro significa somente vínculo Pedido↔Resultado, não handoff executado. */
  explicitOrderLinkVerified: boolean;
  message: string;
}

export function evaluateCrmHandoffEvidence(input: {
  contactId: string;
  handoffRequired: boolean | null;
  referencedOrderId: string | null;
  lookup: CrmOrderLookup;
  order: CrmReferencedOrder | null;
}): CrmHandoffEvidence {
  const base = {
    orderId: null,
    orderNumber: null,
    operationalStatus: null,
    handoffReceivedVerified: false as const,
    explicitOrderLinkVerified: false,
  };
  const reference = input.referencedOrderId?.trim() || null;
  if (!reference) {
    return input.handoffRequired === true
      ? {
          ...base,
          state: 'declared_without_order',
          message: 'Handoff declarado no último Resultado, sem ID de Pedido vinculado nesse registro.',
        }
      : {
          ...base,
          state: 'not_required',
          message: 'O último Resultado não possui vínculo explícito de Pedido nem handoff declarado.',
        };
  }
  if (input.lookup === 'loading' || input.lookup === 'not_requested') {
    return {
      ...base, state: 'checking_order',
      message: 'Conferindo vínculo explícito do Pedido com o contato atual.',
    };
  }
  if (input.lookup !== 'found' || !input.order
    || input.order.id !== reference || input.order.contact_id !== input.contactId) {
    return {
      ...base, state: 'unconfirmed_reference',
      message: 'O ID de Pedido do último Resultado não foi confirmado para este contato. Verifique em Operações.',
    };
  }
  const cancelled = input.order.operational_status === 'cancelled';
  return {
    state: cancelled ? 'linked_cancelled_order' : 'linked_order',
    orderId: input.order.id,
    orderNumber: input.order.order_number ?? null,
    operationalStatus: input.order.operational_status ?? null,
    explicitOrderLinkVerified: true,
    handoffReceivedVerified: false,
    message: cancelled
      ? 'Pedido vinculado ao último Resultado, mas cancelado. Não comprova continuidade operacional.'
      : 'Pedido vinculado ao último Resultado. A entrada na Separação e o início do atendimento são conferidos separadamente abaixo.',
  };
}
