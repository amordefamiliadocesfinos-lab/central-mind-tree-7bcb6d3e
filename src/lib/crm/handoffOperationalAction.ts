import type { CrmHandoffEvidence } from './handoffEvidence';

/**
 * F4-B: fatos registrados pelo módulo Operações em order_separation.
 * A primeira impressão é um registro de acionamento do fluxo de impressão,
 * não garantia física de impressão. A finalização é uma operação confirmada.
 * F4-C.2: o primeiro ato de trabalho com data e operador autorizado
 * caracteriza assunção NO FLUXO, sem criar botão, evento ou registro paralelo.
 * Isso não é um aceite formal independente nem prova impressão física.
 */
export interface CrmOrderSeparationEvidenceRow {
  order_id: string;
  separation_status: string | null;
  created_at: string | null;
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
  /** F4-C.2: o fluxo existente registrou um primeiro ato operacional atribuível. */
  assumedInFlowVerified: boolean;
  /** Momento do primeiro ato válido (impressão solicitada ou finalização). */
  assumedInFlowAt: string | null;
  /** Nenhum aceite formal separado foi criado. */
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
    assumedInFlowVerified: false,
    assumedInFlowAt: null,
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
  // O ato já existente no Kanban assume a operação sem exigir confirmação adicional.
  // A fila 'todo', mesmo com carimbo histórico, não comprova assunção ATUAL.
  // Preferimos a data do primeiro ato, não a da conclusão mais recente.
  const isWorkStage = row.separation_status === 'preparing' || row.separation_status === 'finalized';
  const validPrint = validRecordedAction(row.first_printed_at, row.first_printed_by);
  const validFinalization = row.separation_status === 'finalized'
    && validRecordedAction(row.finalized_at, row.finalized_by);
  const acts = [
    validPrint ? row.first_printed_at : null,
    validFinalization ? row.finalized_at : null,
  ].filter((at): at is string => Boolean(at)).sort((a, b) => Date.parse(a) - Date.parse(b));
  const assumedInFlowAt = isWorkStage ? acts[0] ?? null : null;
  const assumedInFlowVerified = assumedInFlowAt !== null;

  if (validFinalization) {
    return {
      state: 'separation_finalized',
      activityAt: row.finalized_at,
      source: 'order_separation',
      operationalActionVerified: true,
      assumedInFlowVerified,
      assumedInFlowAt,
      handoffFormallyAcceptedVerified: false,
      message: 'Finalização da Separação registrada por usuário autorizado. O atendimento foi assumido pelas ações do fluxo, sem aceite separado.',
    };
  }
  if (validPrint) {
    return {
      state: 'print_requested',
      activityAt: row.first_printed_at,
      source: 'order_separation',
      operationalActionVerified: true,
      assumedInFlowVerified,
      assumedInFlowAt,
      handoffFormallyAcceptedVerified: false,
      message: 'Acionamento de impressão registrado por usuário autorizado. Não confirma impressão física; representa início operacional somente em Em preparação ou Finalizado.',
    };
  }
  return { ...base, state: 'no_verified_action',
    message: 'A separação existe, mas não há data e usuário de ação verificáveis. Status isolado não comprova recebimento.' };
}
