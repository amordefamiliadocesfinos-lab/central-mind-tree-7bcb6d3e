import type { CrmHandoffEvidence } from './handoffEvidence';

/**
 * F4-B: fatos registrados pelo módulo Operações em order_separation.
 * A primeira impressão é um registro de acionamento do fluxo de impressão,
 * não garantia física de impressão. A finalização é uma operação confirmada.
 * Nenhum dos dois equivale ao aceite formal do handoff, que não possui fonte
 * canônica identificada nesta fase.
 */
export interface CrmOrderSeparationEvidenceRow {
  order_id: string;
  separation_status: string | null;
  first_printed_at: string | null;
  first_printed_by: string | null;
  finalized_at: string | null;
  finalized_by: string | null;
}

export type CrmSeparationLookup = 'not_requested' | 'loading' | 'found' | 'missing' | 'error';
export type CrmOperationalActionState =
  | 'not_applicable'
  | 'checking'
  | 'print_requested'
  | 'separation_finalized'
  | 'no_verified_action'
  | 'unavailable'
  | 'cancelled';

export interface CrmOperationalActionEvidence {
  state: CrmOperationalActionState;
  activityAt: string | null;
  /** Só identifica a origem do fato; não expõe identificador do operador na Inbox. */
  source: 'order_separation' | null;
  operationalActionVerified: boolean;
  /** Não foi encontrada fonte de aceite formal do handoff CRM→Operações. */
  handoffFormallyAcceptedVerified: false;
  message: string;
}

function validRecordedAction(at: string | null, by: string | null): boolean {
  return Boolean(at && by?.trim() && Number.isFinite(Date.parse(at)));
}

/**
 * Avalia apenas a separação vinculada ao Pedido explicitamente confirmado
 * pela F4-A. Jamais usa pedidos históricos, somente status, ou fatos de outro ID.
 */
export function evaluateCrmOperationalActionEvidence(input: {
  orderLink: CrmHandoffEvidence;
  lookup: CrmSeparationLookup;
  separation: CrmOrderSeparationEvidenceRow | null;
}): CrmOperationalActionEvidence {
  const base = {
    activityAt: null,
    source: null,
    operationalActionVerified: false,
    handoffFormallyAcceptedVerified: false as const,
  };
  if (!input.orderLink.explicitOrderLinkVerified || !input.orderLink.orderId) {
    return { ...base, state: 'not_applicable',
      message: 'Não há Pedido explicitamente vinculado ao último Resultado para conferir em Operações.' };
  }
  if (input.orderLink.state === 'linked_cancelled_order') {
    return { ...base, state: 'cancelled',
      message: 'Pedido cancelado: nenhuma ação de separação confirma continuidade operacional vigente.' };
  }
  if (input.lookup === 'loading' || input.lookup === 'not_requested') {
    return { ...base, state: 'checking',
      message: 'Conferindo eventos de impressão e finalização do Pedido em Operações.' };
  }
  if (input.lookup === 'error') {
    return { ...base, state: 'unavailable',
      message: 'Não foi possível consultar a separação. Não é possível comprovar atuação operacional.' };
  }
  const row = input.lookup === 'found' ? input.separation : null;
  if (!row || row.order_id !== input.orderLink.orderId) {
    return { ...base, state: 'no_verified_action',
      message: 'Não há ação operacional comprovada para este Pedido nos registros consultados.' };
  }
  if (validRecordedAction(row.finalized_at, row.finalized_by)) {
    return {
      state: 'separation_finalized',
      activityAt: row.finalized_at,
      source: 'order_separation',
      operationalActionVerified: true,
      handoffFormallyAcceptedVerified: false,
      message: 'Finalização da separação registrada por usuário de Operações. Aceite formal do handoff ainda não comprovado.',
    };
  }
  if (validRecordedAction(row.first_printed_at, row.first_printed_by)) {
    return {
      state: 'print_requested',
      activityAt: row.first_printed_at,
      source: 'order_separation',
      operationalActionVerified: true,
      handoffFormallyAcceptedVerified: false,
      message: 'Acionamento de impressão registrado por usuário de Operações. Não confirma impressão física nem aceite formal do handoff.',
    };
  }
  return { ...base, state: 'no_verified_action',
    message: 'A separação existe, mas não há data e usuário de ação verificáveis. Status isolado não comprova recebimento.' };
}
