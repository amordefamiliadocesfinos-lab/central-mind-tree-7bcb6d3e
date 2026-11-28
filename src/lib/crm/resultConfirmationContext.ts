import { getCanonicalResult } from './canonical/results';
import type { CrmResultCode } from './canonical/types';

/**
 * CRM UX Real U2: contexto consultivo antes da confirmação humana.
 * Não infere fatos, não decide Resultados e não grava dados.
 */
export interface ResultConfirmationContext {
  evidence: string;
  consequence: string;
  warning: string;
}

export function getResultConfirmationContext(
  code: CrmResultCode,
  taskTitle?: string | null,
): ResultConfirmationContext | null {
  const result = getCanonicalResult(code);
  if (!result) return null;

  const evidence = result.description;
  const consequence = 'Ao confirmar, o CRM registrará este Resultado no atendimento. A continuidade e as obrigações serão recalculadas pelo fluxo já existente.';
  const task = taskTitle?.trim();
  let warning = 'Confirme apenas o fato realmente ocorrido. Este formulário não envia mensagens nem cria pedidos.';

  if (code === 'CRM-RES-003') {
    warning = 'Sem resposta não significa sem interesse. Confira o histórico e as tentativas antes de classificar.';
  } else if (code === 'CRM-RES-019') {
    warning = 'Pagamento informado não equivale a pagamento confirmado. A confirmação financeira pertence ao fluxo competente.';
  } else if (code === 'CRM-RES-020') {
    warning = 'Selecione somente com comprovação confiável de pagamento, não apenas mensagem do contato.';
  } else if (code === 'CRM-RES-021') {
    warning = 'Pedido confirmado é um fato comercial; escolher este Resultado não cria Pedido em Operações.';
  } else if (code === 'CRM-RES-022') {
    warning = 'Exige acordo real de retorno com o cliente e data definida. Para adiamento interno use Adiar.';
  } else if (code === 'CRM-RES-033') {
    warning = 'Pedido de não receber contato deve respeitar o opt-out canônico; não enviar nova mensagem para confirmar.';
  } else if (result.requiresAdditionalContext) {
    warning = 'Este Resultado exige contexto adicional. Confira a conversa e não deduza fatos ausentes.';
  } else if (result.family === 'objection_decision' || result.family === 'solution_proposal') {
    warning = 'Diferencie proposta, objeção e decisão final. Uma negociação em andamento não comprova venda.';
  }

  return {
    evidence: task ? `Contexto da Próxima Ação: ${task}. Resultado selecionado: ${evidence}` : evidence,
    consequence,
    warning,
  };
}
