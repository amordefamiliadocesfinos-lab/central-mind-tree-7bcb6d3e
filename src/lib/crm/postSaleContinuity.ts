import type { PostSaleOutcome } from './postSaleOutcome';
import type { RepurchaseSignal } from './repurchase';

export type PostSaleContinuityKind = 'none' | 'repurchase_explicit' | 'repurchase_probable';

export interface PostSaleContinuityDecision {
  kind: PostSaleContinuityKind;
  repurchase: RepurchaseSignal | null;
  reason: string;
}

/**
 * F3-G — continuidade do ciclo depois que o pós-venda foi registrado.
 *
 * O Resultado de pós-venda encerra somente o acompanhamento daquela entrega.
 * Ele não cria recompra por si só. Uma nova oportunidade comercial só aparece
 * quando o motor próprio de recompra fornece evidência independente.
 */
export function resolvePostSaleContinuity(
  outcome: PostSaleOutcome | null,
  repurchase: RepurchaseSignal | null,
): PostSaleContinuityDecision {
  if (!outcome?.isPostSale || !outcome.closesEligibility) {
    return {
      kind: 'none',
      repurchase: null,
      reason: 'Não há pós-venda concluído que exija avaliar continuidade comercial.',
    };
  }

  if (repurchase?.status === 'explicit') {
    return {
      kind: 'repurchase_explicit',
      repurchase,
      reason: 'Após o pós-venda, existe intenção concreta e independente do cliente para uma nova compra.',
    };
  }

  if (repurchase?.status === 'probable') {
    return {
      kind: 'repurchase_probable',
      repurchase,
      reason: 'O pós-venda foi concluído e o histórico independente já sustenta uma oportunidade provável de recompra.',
    };
  }

  return {
    kind: 'none',
    repurchase: null,
    reason: 'Pós-venda concluído sem evidência independente de recompra; nenhuma nova ação comercial é criada.',
  };
}
