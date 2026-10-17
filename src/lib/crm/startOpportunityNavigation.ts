/**
 * CRM–UX 02 / C2-03 — intenção de navegação somente leitura da Start.
 * O parâmetro não modifica CRM e é consumido uma única vez na Gestão.
 * Não usar /contatos/inbox?attend=1 para abrir uma oportunidade.
 */
export const CRM_START_INTENT_PARAM = 'crm_start';

export type CrmStartIntent = 'post_sale' | 'repurchase' | 'segment' | 'campaigns';

const INTENTS: readonly CrmStartIntent[] = ['post_sale', 'repurchase', 'segment', 'campaigns'];

export function parseCrmStartIntent(params: URLSearchParams): CrmStartIntent | null {
  const value = params.get(CRM_START_INTENT_PARAM);
  return INTENTS.find(intent => intent === value) ?? null;
}

export function buildCrmStartDestination(intent: CrmStartIntent): string {
  const params = new URLSearchParams({ [CRM_START_INTENT_PARAM]: intent });
  return `/contatos?${params.toString()}`;
}

/** Preserva todos os demais parâmetros e não cria histórico adicional. */
export function removeCrmStartIntent(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete(CRM_START_INTENT_PARAM);
  return next;
}
