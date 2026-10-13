/**
 * F4-B: leitura de fatos físicos do módulo Operações, sem writer.
 * Separação impressa/finalizada prova processamento do Pedido identificado,
 * NÃO prova aceite formal do handoff CRM nem recebimento de responsabilidade.
 */
export interface CrmSeparationRow {
  order_id: string;
  separation_status: string | null;
  first_printed_at: string | null;
  finalized_at: string | null;
}
export interface CrmSeparationEvidence {
  state: 'not_linked' | 'checking' | 'not_found' | 'registered' | 'printed' | 'finalized' | 'unavailable';
  label: string;
  /** Nunca inferir aceite/recebimento de handoff sem evidência própria. */
  handoffAccepted: false;
}
export function evaluateCrmSeparationEvidence(input: {
  explicitOrderLinkVerified: boolean;
  orderId: string | null;
  lookup: 'idle' | 'loading' | 'found' | 'missing' | 'error';
  row: CrmSeparationRow | null;
}): CrmSeparationEvidence {
  const wrap = (state: CrmSeparationEvidence['state'], label: string): CrmSeparationEvidence =>
    ({ state, label, handoffAccepted: false });
  if (!input.explicitOrderLinkVerified || !input.orderId) return wrap('not_linked', 'Sem vínculo explícito de Pedido comprovado.');
  if (input.lookup === 'idle' || input.lookup === 'loading') return wrap('checking', 'Verificando processamento físico em Operações.');
  if (input.lookup === 'error') return wrap('unavailable', 'Não foi possível consultar a separação em Operações.');
  if (input.lookup !== 'found' || !input.row || input.row.order_id !== input.orderId)
    return wrap('not_found', 'Nenhuma separação vinculada a este Pedido foi encontrada.');
  if (input.row.finalized_at && input.row.separation_status === 'finalized')
    return wrap('finalized', 'Separação física finalizada em Operações; aceite formal de handoff não comprovado.');
  if (input.row.first_printed_at)
    return wrap('printed', 'Separação impressa em Operações; aceite formal de handoff não comprovado.');
  return wrap('registered', 'Separação registrada em Operações, ainda sem evidência física de impressão ou finalização.');
}
