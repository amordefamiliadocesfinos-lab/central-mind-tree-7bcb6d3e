import type { CrmAiContext } from './aiContext';
import type { CrmNextActionRecommendation } from './aiNextActionRecommendation';
import type { CrmResultSuggestion } from './aiResultSuggestion';
import { getCrmOperationalResponsibility } from './canonical/operationalResponsibility';
import type { CrmResultCode } from './canonical/types';

export type CrmCommercialIntent = 'interest' | 'information_request' | 'objection' | 'deferred_decision' | 'payment' | 'post_sale' | 'repurchase' | 'refusal' | 'restriction' | 'unknown';
export type CrmDecisionState = 'action_required' | 'awaiting_counterparty' | 'verification_required' | 'handoff' | 'closed' | 'unknown';
export type CrmPaymentState = 'none' | 'awaiting' | 'informed' | 'confirmed';

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
  commercialIntent: CrmCommercialIntent;
  decisionState: CrmDecisionState;
  paymentState: CrmPaymentState;
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

function normalizedText(context: CrmAiContext) {
  return String(context.messages.at(-1)?.content ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Sinais de leitura: nunca criam códigos, etapas, tarefas ou transições. */
export function deriveCommercialSignals(context: CrmAiContext, resultCode: string | null) {
  const text = normalizedText(context);
  const code = resultCode as CrmResultCode | null;
  const hasPriorPurchase = Number(context.purchases?.paidOrdersCount ?? 0) > 0;
  const isPaymentInformed = code === 'CRM-RES-019' || /\b(j[aá] fiz|paguei|pix feito|comprovante|transferi)\b/.test(text);
  const paymentState: CrmPaymentState = code === 'CRM-RES-020' ? 'confirmed'
    : isPaymentInformed ? 'informed'
    : code === 'CRM-RES-018' ? 'awaiting'
    : 'none';
  const postSaleCodes = new Set(['CRM-RES-023', 'CRM-RES-024', 'CRM-RES-025', 'CRM-RES-026', 'CRM-RES-027', 'CRM-RES-028', 'CRM-RES-029']);
  const repurchaseIntent = hasPriorPurchase && /\b(novo pedido|quero pedir|quero comprar|repor|reposicao|mais \d+)\b/.test(text);
  const commercialIntent: CrmCommercialIntent = code === 'CRM-RES-033' ? 'restriction'
    : code === 'CRM-RES-002' || code === 'CRM-RES-015' ? 'refusal'
    : paymentState !== 'none' ? 'payment'
    : repurchaseIntent || code === 'CRM-RES-032' ? 'repurchase'
    : postSaleCodes.has(code ?? '') ? 'post_sale'
    : code === 'CRM-RES-013' || code === 'CRM-RES-014' || /\b(vou pensar|depois decido|te retorno)\b/.test(text) ? 'deferred_decision'
    : code === 'CRM-RES-010' || code === 'CRM-RES-012' || /\b(caro|preco|prazo|quantidade|entrega|condicao|disponibilidade)\b/.test(text) ? 'objection'
    : /\b(quanto custa|qual o preco|tem disponivel|como funciona|qual o prazo)\b/.test(text) ? 'information_request'
    : code === 'CRM-RES-001' || /\b(quero fechar|quero comprar|me manda proposta|preciso de|tenho interesse)\b/.test(text) ? 'interest'
    : 'unknown';
  return { commercialIntent, paymentState, hasPriorPurchase };
}

export function buildCrmCommunicationDecision(
  context: CrmAiContext,
  result: CrmResultSuggestion | null,
  nextAction: CrmNextActionRecommendation | null,
): CrmCommunicationDecision {
  const lastMessage = context.messages.at(-1) ?? null;
  const lastInbound = lastMessage?.direction === 'inbound';
  const hasOverdueTask = context.tasks.some(task => Boolean(task.dueAt) && Date.parse(task.dueAt!) <= Date.now());
  const canonicalResponsibility = result?.code ? getCrmOperationalResponsibility(result.code as CrmResultCode) : null;
  const responsibility = context.conversation?.needsReply || lastInbound || hasOverdueTask
    ? 'operator'
    : canonicalResponsibility === 'operator' ? 'operator'
    : canonicalResponsibility === 'counterparty' ? 'customer'
    : context.conversation?.state === 'aguardando_cliente'
      ? 'customer'
      : 'unknown';
  const signals = deriveCommercialSignals(context, result?.code ?? null);
  const riskFlags = [
    ...(context.contact.optOut ? ['commercial_opt_out'] : []),
    ...(nextAction?.noImmediateAction ? ['no_immediate_action'] : []),
    ...(result && result.confidence < 0.55 ? ['low_result_confidence'] : []),
  ];
  // Ausência de Próxima Ação não basta para silenciar uma inbound atual.
  const shouldReply = (lastInbound || context.conversation?.needsReply || hasOverdueTask)
    && !(context.contact.optOut && !lastInbound);

  const decisionState: CrmDecisionState = signals.paymentState === 'informed' ? 'verification_required'
    : result?.code === 'CRM-RES-021' ? 'handoff'
    : ['CRM-RES-002', 'CRM-RES-015', 'CRM-RES-016', 'CRM-RES-033'].includes(result?.code ?? '') ? 'closed'
    : responsibility === 'customer' ? 'awaiting_counterparty'
    : responsibility === 'operator' ? 'action_required'
    : 'unknown';

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
    commercialIntent: signals.commercialIntent,
    decisionState,
    paymentState: signals.paymentState,
  };
}
