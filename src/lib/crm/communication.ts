import type { CrmAiContext } from './aiContext';
import type { CrmNextActionRecommendation } from './aiNextActionRecommendation';
import type { CrmResultSuggestion } from './aiResultSuggestion';

/** Decisão operacional estruturada. Nunca contém texto destinado ao cliente. */
export interface CrmCommunicationDecision {
  situation: string;
  perceivedIntent: string | null;
  responsibility: 'operator' | 'customer' | 'external' | 'unknown';
  suggestedResult: { code: string | null; confidence: number };
  nextAction: { code: string | null; source: 'canonical' | 'ambiguous_choice' | 'none' };
  shouldReply: boolean;
  ambiguity: 'none' | 'low' | 'high';
  riskFlags: string[];
  reason: string;
}

/** Saída da camada de fala. Não pode alterar a decisão que a originou. */
export interface CrmCommunicationDraft {
  message: string | null;
  intent: 'answer' | 'follow_up' | 'clarify' | 'acknowledge' | 'none';
  tone: 'cordial' | 'consultivo' | 'objetivo' | 'acolhedor' | null;
  length: 'short' | 'medium';
  rationale: string;
}

export interface CommunicationProfile {
  status: 'building' | 'documented';
  formality: 'low' | 'balanced' | 'high';
  preferredLength: 'short' | 'medium';
  generalTone: 'cordial' | 'consultivo' | 'objetivo' | 'acolhedor';
  followUpStyle: string;
  avoidedExpressions: string[];
  approvedExamples: string[];
}

/** Perfil neutro, local e aditivo enquanto o estilo do operador é documentado. */
export const DEFAULT_BUILDING_COMMUNICATION_PROFILE: CommunicationProfile = {
  status: 'building',
  formality: 'low',
  preferredLength: 'short',
  generalTone: 'cordial',
  followUpStyle: 'comercial leve, sem pressão ou urgência artificial',
  avoidedExpressions: [
    'fico à disposição',
    'será um prazer',
    'estamos à disposição',
    'não hesite em entrar em contato',
  ],
  approvedExamples: [],
};

export function buildCrmCommunicationDecision(
  context: CrmAiContext,
  result: CrmResultSuggestion | null,
  nextAction: CrmNextActionRecommendation | null,
): CrmCommunicationDecision {
  const lastMessage = context.messages.at(-1) ?? null;
  const lastInbound = lastMessage?.direction === 'inbound';
  const responsibility = context.conversation?.needsReply || lastInbound
    ? 'operator'
    : context.conversation?.state === 'aguardando_cliente'
      ? 'customer'
      : 'unknown';
  const riskFlags = [
    ...(context.contact.optOut ? ['commercial_opt_out'] : []),
    ...(nextAction?.noImmediateAction ? ['no_immediate_action'] : []),
    ...(result && result.confidence < 0.55 ? ['low_result_confidence'] : []),
  ];
  const shouldReply = responsibility === 'operator'
    && !(context.contact.optOut && !lastInbound)
    && !nextAction?.noImmediateAction;

  return {
    situation: context.conversation?.state ?? 'sem conversa ativa',
    perceivedIntent: result?.label ?? null,
    responsibility,
    suggestedResult: { code: result?.code ?? null, confidence: result?.confidence ?? 0 },
    nextAction: {
      code: nextAction?.nextActionCode ?? null,
      source: nextAction?.chosenByAi ? 'ambiguous_choice' : nextAction?.nextActionCode ? 'canonical' : 'none',
    },
    shouldReply,
    ambiguity: !result?.code ? 'high' : result.confidence < 0.7 ? 'low' : 'none',
    riskFlags,
    reason: result?.reason ?? nextAction?.reason ?? 'Não há evidência suficiente para uma decisão operacional.',
  };
}
