import type { CrmResultCode } from './canonical/types';

function normalizeTaskTitle(value?: string | null) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * F1 — contexto da obrigação oficial para apresentação do seletor de Resultado.
 *
 * Não decide nem bloqueia Resultado. Apenas traz para o topo os Resultados mais
 * relacionados à tarefa que o operador está executando; todos os 33 continuam
 * disponíveis para fatos inesperados (ex.: nova compra durante um pós-venda).
 */
export function getTaskContextResultCodes(taskTitle?: string | null): CrmResultCode[] {
  const title = normalizeTaskTitle(taskTitle);
  if (!title) return [];

  if (title.includes('pos-venda') || title.includes('pos venda')) {
    return [
      'CRM-RES-023', 'CRM-RES-024', 'CRM-RES-025', 'CRM-RES-026', 'CRM-RES-027',
      'CRM-RES-028', 'CRM-RES-029', 'CRM-RES-030', 'CRM-RES-031', 'CRM-RES-032',
    ];
  }

  if (title.includes('tratar objecao') || title.includes('objecao')) {
    return ['CRM-RES-010', 'CRM-RES-011', 'CRM-RES-012', 'CRM-RES-013', 'CRM-RES-014', 'CRM-RES-015', 'CRM-RES-016'];
  }

  if (title.includes('verificar resposta') || title.includes('retomar contato') || title.includes('follow-up') || title.includes('follow up')) {
    return ['CRM-RES-001', 'CRM-RES-002', 'CRM-RES-003', 'CRM-RES-004', 'CRM-RES-013', 'CRM-RES-014', 'CRM-RES-022'];
  }

  if (title.includes('qualificar contato') || title.includes('identificar oportunidade')) {
    return ['CRM-RES-001', 'CRM-RES-002', 'CRM-RES-003', 'CRM-RES-004', 'CRM-RES-010'];
  }

  if (title.includes('pagamento')) {
    return ['CRM-RES-017', 'CRM-RES-018', 'CRM-RES-019', 'CRM-RES-020', 'CRM-RES-021'];
  }

  if (title.includes('proposta') || title.includes('condicao comercial')) {
    return ['CRM-RES-005', 'CRM-RES-006', 'CRM-RES-007', 'CRM-RES-008', 'CRM-RES-009', 'CRM-RES-013', 'CRM-RES-014', 'CRM-RES-015'];
  }

  return [];
}
