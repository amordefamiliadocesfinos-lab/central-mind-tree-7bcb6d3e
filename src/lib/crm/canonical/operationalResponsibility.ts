import type { CrmCanonicalNextAction, CrmResultCode } from './types';

/**
 * Define de quem é a bola após cada Resultado canônico. Esta regra não decide
 * etapa, próxima ação ou handoff: essas decisões continuam no motor de
 * transições. Ela só evita que uma conversa sem ação imediata do operador
 * permaneça indevidamente na fila de atendimento.
 */
export type CrmOperationalResponsibility = 'operator' | 'counterparty';

export const CRM_RESULT_OPERATIONAL_RESPONSIBILITY: Record<CrmResultCode, CrmOperationalResponsibility> = {
  'CRM-RES-001': 'operator',
  'CRM-RES-002': 'operator',
  'CRM-RES-003': 'counterparty',
  'CRM-RES-004': 'operator',
  'CRM-RES-005': 'operator',
  'CRM-RES-006': 'operator',
  'CRM-RES-007': 'operator',
  'CRM-RES-008': 'counterparty',
  'CRM-RES-009': 'operator',
  'CRM-RES-010': 'operator',
  'CRM-RES-011': 'operator',
  'CRM-RES-012': 'operator',
  'CRM-RES-013': 'counterparty',
  'CRM-RES-014': 'counterparty',
  'CRM-RES-015': 'operator',
  'CRM-RES-016': 'operator',
  'CRM-RES-017': 'counterparty',
  'CRM-RES-018': 'counterparty',
  'CRM-RES-019': 'operator',
  // Pagamento confirmado sem ação comercial pendente encerra a iniciativa do
  // operador: PA-010 só existe quando ainda há requisito comercial (ver
  // transitions.ts); fora desse caso a bola não é nossa.
  'CRM-RES-020': 'counterparty',
  'CRM-RES-021': 'operator',
  'CRM-RES-022': 'counterparty',
  'CRM-RES-023': 'counterparty',
  'CRM-RES-024': 'operator',
  'CRM-RES-025': 'counterparty',
  'CRM-RES-026': 'counterparty',
  'CRM-RES-027': 'counterparty',
  'CRM-RES-028': 'counterparty',
  'CRM-RES-029': 'counterparty',
  'CRM-RES-030': 'counterparty',
  'CRM-RES-031': 'operator',
  'CRM-RES-032': 'operator',
  'CRM-RES-033': 'operator',
};

export function getCrmOperationalResponsibility(resultCode: CrmResultCode): CrmOperationalResponsibility {
  return CRM_RESULT_OPERATIONAL_RESPONSIBILITY[resultCode];
}

/**
 * Uma ação imediata do operador sempre prevalece. Ação futura já agendada
 * (por exemplo, PA-014) mantém a conversa aguardando até a data vencer.
 */
export function shouldAwaitCustomerAfterCanonicalResult(input: {
  resultCode: CrmResultCode;
  nextAction: CrmCanonicalNextAction | null;
  nextActionScheduled: boolean;
}) {
  if (getCrmOperationalResponsibility(input.resultCode) !== 'counterparty') return false;
  return !input.nextAction || input.nextActionScheduled;
}
