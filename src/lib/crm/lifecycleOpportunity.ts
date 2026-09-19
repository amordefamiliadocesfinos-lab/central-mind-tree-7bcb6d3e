import type { PostSaleEligibilitySignal } from './postSale';
import type { RepurchaseSignal } from './repurchase';

export type CrmLifecycleOpportunityKind = 'none' | 'post_sale' | 'repurchase';

/**
 * F3-B — orquestração determinística entre pós-venda e recompra.
 *
 * Esta camada apenas decide qual sinal merece precedência visual/comercial.
 * Não cria tarefa, não envia mensagem, não altera etapa, conversa, prioridade
 * ou qualquer dado operacional.
 *
 * Precedência:
 * 1. recompra explícita iniciada pelo cliente;
 * 2. pós-venda elegível ainda não realizado;
 * 3. recompra provável inferida por padrão histórico;
 * 4. nenhum sinal.
 */
export interface CrmLifecycleOpportunity {
  kind: CrmLifecycleOpportunityKind;
  postSale: PostSaleEligibilitySignal | null;
  repurchase: RepurchaseSignal | null;
  reason: string;
}

export function resolveCrmLifecycleOpportunity(
  postSale: PostSaleEligibilitySignal | null,
  repurchase: RepurchaseSignal | null,
): CrmLifecycleOpportunity {
  if (repurchase?.status === 'explicit') {
    return {
      kind: 'repurchase',
      postSale,
      repurchase,
      reason: 'O cliente iniciou uma intenção concreta de nova compra; esse fato atual prevalece sobre um pós-venda ainda elegível.',
    };
  }

  if (postSale?.eligible) {
    return {
      kind: 'post_sale',
      postSale,
      repurchase,
      reason: 'O pedido mais recente já entrou na janela de pós-venda e ainda não possui Resultado pós-venda posterior; uma recompra apenas provável não deve atropelar esse acompanhamento.',
    };
  }

  if (repurchase && repurchase.status !== 'none') {
    return {
      kind: 'repurchase',
      postSale,
      repurchase,
      reason: repurchase.reason,
    };
  }

  return {
    kind: 'none',
    postSale,
    repurchase,
    reason: postSale?.reason || repurchase?.reason || 'Não há sinal de pós-venda ou recompra que exija destaque agora.',
  };
}
