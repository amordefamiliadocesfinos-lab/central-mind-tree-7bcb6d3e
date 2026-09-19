import { isWaitingCustomerState } from './priority';
import type { PostSaleEligibilitySignal } from './postSale';

export interface PostSaleApproachContext {
  optOut: boolean;
  conversationState: string | null;
  needsReply: boolean;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
}

export interface PostSaleApproachDecision {
  allowed: boolean;
  reason: string;
}

function hasCurrentInbound(context: PostSaleApproachContext) {
  if (!context.lastInboundAt) return false;
  const inboundAt = Date.parse(context.lastInboundAt);
  if (!Number.isFinite(inboundAt)) return false;
  if (!context.lastOutboundAt) return true;
  const outboundAt = Date.parse(context.lastOutboundAt);
  return !Number.isFinite(outboundAt) || inboundAt > outboundAt;
}

/**
 * F3-D — autorização pura para preparar uma abordagem proativa de pós-venda.
 *
 * O pós-venda elegível é um sinal comercial, não uma obrigação automática.
 * Esta função não cria tarefa, não envia mensagem e não altera estado.
 * Ela apenas protege a futura ação humana assistida contra conflitos claros:
 * - opt-out comercial;
 * - inbound atual que exige resposta no fluxo normal;
 * - conversa em estado canônico de espera do cliente.
 */
export function evaluatePostSaleApproach(
  postSale: PostSaleEligibilitySignal | null,
  context: PostSaleApproachContext,
): PostSaleApproachDecision {
  if (!postSale?.eligible) {
    return { allowed: false, reason: 'Não há pós-venda elegível para preparar agora.' };
  }

  if (context.optOut) {
    return { allowed: false, reason: 'Contato com opt-out comercial ativo; não iniciar abordagem proativa de pós-venda.' };
  }

  if (context.needsReply || hasCurrentInbound(context)) {
    return {
      allowed: false,
      reason: 'Há uma interação atual do cliente que deve ser tratada pelo fluxo normal antes de iniciar um pós-venda proativo.',
    };
  }

  if (isWaitingCustomerState(context.conversationState)) {
    return {
      allowed: false,
      reason: 'O atendimento está aguardando o cliente; o pós-venda não deve criar uma segunda abordagem concorrente.',
    };
  }

  return {
    allowed: true,
    reason: 'Pós-venda elegível e sem conflito operacional atual; o operador pode preparar uma mensagem para revisão manual.',
  };
}
