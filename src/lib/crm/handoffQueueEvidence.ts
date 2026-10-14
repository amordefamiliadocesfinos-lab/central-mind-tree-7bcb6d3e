import type { CrmHandoffEvidence } from './handoffEvidence';
import type { CrmOrderSeparationEvidenceRow, CrmSeparationLookup } from './handoffOperationalAction';

/**
 * F4-C.1: a existência datada da linha canônica de Separação comprova
 * entrada do Pedido na fila operacional, NÃO aceite/assunção humana.
 * O aceite formal depende de fato novo cuja autoridade é Operações.
 */
export type CrmHandoffQueueState =
  | 'not_applicable'
  | 'cancelled'
  | 'checking'
  | 'unavailable'
  | 'not_registered'
  | 'unconfirmed_registration'
  | 'registered';

export interface CrmHandoffQueueEvidence {
  state: CrmHandoffQueueState;
  registeredAt: string | null;
  queueRegistrationVerified: boolean;
  handoffFormallyAcceptedVerified: false;
  message: string;
}

export function evaluateCrmHandoffQueueEvidence(input: {
  orderLink: CrmHandoffEvidence;
  lookup: CrmSeparationLookup;
  separation: CrmOrderSeparationEvidenceRow | null;
}): CrmHandoffQueueEvidence {
  const base = {
    registeredAt: null,
    queueRegistrationVerified: false,
    handoffFormallyAcceptedVerified: false as const,
  };
  if (!input.orderLink.explicitOrderLinkVerified || !input.orderLink.orderId) {
    return { ...base, state: 'not_applicable',
      message: 'Sem Pedido explicitamente vinculado ao último Resultado, não é possível confirmar entrada na Separação.' };
  }
  if (input.orderLink.state === 'linked_cancelled_order') {
    return { ...base, state: 'cancelled',
      message: 'Pedido cancelado não representa encaminhamento operacional vigente.' };
  }
  if (input.lookup === 'loading' || input.lookup === 'not_requested') {
    return { ...base, state: 'checking', message: 'Conferindo entrada do Pedido na fila de Separação.' };
  }
  if (input.lookup === 'error') {
    return { ...base, state: 'unavailable',
      message: 'Consulta à Separação indisponível. Não é possível comprovar entrada na fila.' };
  }
  if (input.lookup !== 'found' || !input.separation) {
    return { ...base, state: 'not_registered',
      message: 'Nenhum registro de entrada na Separação foi encontrado para este Pedido.' };
  }
  if (input.separation.order_id !== input.orderLink.orderId) {
    return { ...base, state: 'unconfirmed_registration',
      message: 'A Separação consultada não corresponde ao Pedido do último Resultado.' };
  }
  const registeredAt = input.separation.created_at;
  if (!registeredAt || !Number.isFinite(Date.parse(registeredAt))) {
    return { ...base, state: 'unconfirmed_registration',
      message: 'Há registro de Separação, mas a data de ingresso não é verificável.' };
  }
  return {
    state: 'registered',
    registeredAt,
    queueRegistrationVerified: true,
    handoffFormallyAcceptedVerified: false,
    message: 'Pedido registrado na fila de Separação. Isso comprova encaminhamento técnico, não aceite ou assunção formal por Operações.',
  };
}
