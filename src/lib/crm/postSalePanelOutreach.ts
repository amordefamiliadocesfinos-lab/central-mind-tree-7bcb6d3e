import { isWaitingCustomerState } from './priority';

/**
 * Proteção da preparação proativa do painel legado de Pós-venda.
 * Esta decisão NÃO prova pós-venda elegível nem prevê recompra:
 * apenas evita abordagem quando o contato/atendimento não permite.
 */
export interface PostSalePanelContactSafety {
  isActive: boolean;
  commercialOptOut: boolean;
}

export interface PostSalePanelConversationSafety {
  status: string | null;
  attendanceState: string | null;
  needsReply: boolean;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
}

export interface PostSalePanelOutreachDecision {
  allowed: boolean;
  reason: string;
}

function pendingInbound(conversation: PostSalePanelConversationSafety): boolean {
  if (!conversation.lastInboundAt) return false;
  const inbound = Date.parse(conversation.lastInboundAt);
  if (!Number.isFinite(inbound)) return true;
  if (!conversation.lastOutboundAt) return true;
  const outbound = Date.parse(conversation.lastOutboundAt);
  return !Number.isFinite(outbound) || inbound > outbound;
}

export function evaluatePostSalePanelOutreach(
  contact: PostSalePanelContactSafety | null,
  conversations: PostSalePanelConversationSafety[],
): PostSalePanelOutreachDecision {
  if (!contact?.isActive) {
    return { allowed: false, reason: 'Contato indisponível ou inativo. Confirme seu cadastro no CRM.' };
  }
  if (contact.commercialOptOut) {
    return { allowed: false, reason: 'Contato com opt-out comercial. Não preparar nova abordagem.' };
  }
  for (const conversation of conversations) {
    if (conversation.status !== 'open') continue;
    if (conversation.needsReply || pendingInbound(conversation)) {
      return {
        allowed: false,
        reason: 'Há mensagem do cliente pendente. Trate-a primeiro na Inbox, sem iniciar abordagem paralela.',
      };
    }
    if (isWaitingCustomerState(conversation.attendanceState)) {
      return {
        allowed: false,
        reason: 'O atendimento aguarda o cliente. Não preparar contato comercial concorrente.',
      };
    }
  }
  return {
    allowed: true,
    reason: 'Sem impedimento operacional identificado. Mensagem apenas preparada, sem envio confirmado.',
  };
}
