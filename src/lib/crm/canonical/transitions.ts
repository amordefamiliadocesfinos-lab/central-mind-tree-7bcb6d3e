import type { CrmFunnelStage } from '../model';
import type { CrmNewFact, CrmNextActionCode, CrmResultCode } from './types';

export type CrmTemporalPolicy =
  | 'NOT_APPLICABLE'
  | 'OPTIONAL_FUTURE'
  | 'REQUIRED_FUTURE'
  | 'MISSING_REQUIRED_CONTEXT'
  | 'PROHIBITED';

export type CrmOperationalState =
  | 'KEEP'
  | 'TEMPORAL_CONTINUITY'
  | 'OUT_OF_ACTIVE_COMMERCIAL_QUEUE'
  | 'HANDOFF_OPERATIONAL'
  | 'POST_SALE_ATTENTION'
  | 'CONTACT_RESTRICTED';

export type CrmHandoffType = 'operational' | 'orders' | 'financial' | 'production' | 'logistics';
export type CrmNewFactRelation = 'COMPATIBLE' | 'SUPERSEDES' | 'INCOMPATIBLE';

/**
 * Contexto estritamente declarativo. Nenhuma data Ã© calculada nem persistida
 * aqui: esta funÃ§Ã£o apenas informa se uma programaÃ§Ã£o temporal Ã© semanticamente
 * possÃ­vel, obrigatÃ³ria ou proibida.
 */
export interface CrmTransitionContext {
  result: CrmResultCode;
  currentStage: CrmFunnelStage;
  currentNextAction: CrmNextActionCode | null;
  currentNextActionDate: string | null;
  currentReturnAt: string | null;
  conversationStatus?: string | null;
  attendanceState?: string | null;
  needsReply?: boolean;
  newFact?: CrmNewFact | null;
  newFactRelation?: CrmNewFactRelation;
  contactRestricted?: boolean;
  hasOpenPostSaleIssue?: boolean;
  operationalContext?: {
    hasLegitimateFutureReason?: boolean;
    hasConcreteReturnMoment?: boolean;
    hasPendingCommercialRequirement?: boolean;
    paymentGuidanceNeeded?: boolean;
    supportedNextAction?: CrmNextActionCode | null;
    allowLegitimateNoNextAction?: boolean;
    requiresClarification?: boolean;
    requiresOccurrenceFollowUp?: boolean;
  };
}

export interface CrmTransitionDecision {
  result: CrmResultCode;
  stage: { action: 'KEEP' | 'CHANGE'; value?: CrmFunnelStage; reason: string };
  nextAction: { value: CrmNextActionCode | null; reason: string };
  temporal: { required: boolean; policy: CrmTemporalPolicy; reason: string };
  desiredOperationalState: CrmOperationalState;
  handoff: { required: boolean; type?: CrmHandoffType; reason: string };
  obsoletePreviousProgramming: boolean;
  reason: string;
}

type TransitionRule = {
  nextAction: CrmNextActionCode | null;
  alternatives?: readonly CrmNextActionCode[];
  temporal: CrmTemporalPolicy;
  operationalState?: CrmOperationalState;
  handoff?: boolean;
  reason: string;
};

const PA = (number: string) => `CRM-PA-${number}` as CrmNextActionCode;

/**
 * Regras declarativas da tabela canÃ´nica do Documento 09.04. Destinos
 * documentais nÃ£o sÃ£o convertidos em `funnel_status` sem contrato tÃ©cnico
 * homologado; por isso, a etapa permanece KEEP neste motor.
 */
const RULES: Record<CrmResultCode, TransitionRule> = {
  'CRM-RES-001': { nextAction: PA('001'), alternatives: [PA('002')], temporal: 'NOT_APPLICABLE', reason: 'Interesse demonstrado pede apenas a prÃ³xima qualificaÃ§Ã£o ou aÃ§Ã£o mais avanÃ§ada sustentada.' },
  'CRM-RES-002': { nextAction: null, temporal: 'PROHIBITED', operationalState: 'OUT_OF_ACTIVE_COMMERCIAL_QUEUE', reason: 'Sem interesse encerra a continuidade atual e bloqueia follow-up automÃ¡tico.' },
  'CRM-RES-003': { nextAction: null, alternatives: [PA('014')], temporal: 'OPTIONAL_FUTURE', operationalState: 'TEMPORAL_CONTINUITY', reason: 'SilÃªncio nÃ£o Ã© desinteresse; retomada sÃ³ existe com finalidade legÃ­tima.' },
  'CRM-RES-004': { nextAction: PA('003'), temporal: 'NOT_APPLICABLE', reason: 'Nova necessidade reavalia a oportunidade sem reiniciar o funil.' },
  'CRM-RES-005': { nextAction: PA('007'), temporal: 'NOT_APPLICABLE', reason: 'SoluÃ§Ã£o aprovada pede proposta ou movimento posterior sustentado, sem presumir condiÃ§Ãµes.' },
  'CRM-RES-006': { nextAction: PA('003'), temporal: 'NOT_APPLICABLE', reason: 'SoluÃ§Ã£o inadequada pede reavaliaÃ§Ã£o, nÃ£o objeÃ§Ã£o artificial.' },
  'CRM-RES-007': { nextAction: PA('010'), alternatives: [PA('011'), PA('012'), PA('008')], temporal: 'NOT_APPLICABLE', reason: 'Proposta aceita preserva a pendÃªncia mais especÃ­fica antes de concluir pedido.' },
  'CRM-RES-008': { nextAction: null, alternatives: [PA('014')], temporal: 'OPTIONAL_FUTURE', reason: 'AnÃ¡lise de proposta nÃ£o cria follow-up automaticamente.' },
  'CRM-RES-009': { nextAction: PA('007'), temporal: 'NOT_APPLICABLE', reason: 'AlteraÃ§Ã£o comercial atualiza somente a proposta necessÃ¡ria.' },
  'CRM-RES-010': { nextAction: PA('009'), temporal: 'NOT_APPLICABLE', reason: 'ObjeÃ§Ã£o identificada pede tratamento da barreira real.' },
  'CRM-RES-011': { nextAction: PA('010'), alternatives: [PA('007')], temporal: 'NOT_APPLICABLE', reason: 'ObjeÃ§Ã£o resolvida segue a decisÃ£o sustentada pelo novo fato.' },
  'CRM-RES-012': { nextAction: PA('009'), alternatives: [PA('003')], temporal: 'OPTIONAL_FUTURE', reason: 'ObjeÃ§Ã£o nÃ£o resolvida exige novo tratamento, reavaliaÃ§Ã£o ou encerramento responsÃ¡vel.' },
  'CRM-RES-013': { nextAction: null, alternatives: [PA('014')], temporal: 'OPTIONAL_FUTURE', reason: 'DecisÃ£o adiada sÃ³ permite retorno com intenÃ§Ã£o e momento legÃ­timos.' },
  'CRM-RES-014': { nextAction: null, alternatives: [PA('014')], temporal: 'OPTIONAL_FUTURE', reason: 'DependÃªncia de terceiro nÃ£o Ã© aÃ§Ã£o; apenas retomada legÃ­tima pode ser programada.' },
  'CRM-RES-015': { nextAction: null, temporal: 'PROHIBITED', operationalState: 'OUT_OF_ACTIVE_COMMERCIAL_QUEUE', reason: 'DesistÃªncia encerra a oportunidade atual atÃ© novo fato posterior.' },
  'CRM-RES-016': { nextAction: null, temporal: 'PROHIBITED', operationalState: 'OUT_OF_ACTIVE_COMMERCIAL_QUEUE', reason: 'Sem soluÃ§Ã£o compatÃ­vel bloqueia insistÃªncia e follow-up sem novo motivo.' },
  'CRM-RES-017': { nextAction: PA('011'), alternatives: [PA('014')], temporal: 'OPTIONAL_FUTURE', reason: 'Dados faltantes pedem solicitaÃ§Ã£o objetiva; retorno sÃ³ depois se legÃ­timo.' },
  'CRM-RES-018': { nextAction: PA('012'), alternatives: [PA('014')], temporal: 'OPTIONAL_FUTURE', reason: 'Aguardar pagamento Ã© condiÃ§Ã£o, nÃ£o aÃ§Ã£o; orientar ou retomar somente quando cabÃ­vel.' },
  'CRM-RES-019': { nextAction: PA('013'), temporal: 'NOT_APPLICABLE', reason: 'Pagamento informado exige conferÃªncia e nunca confirmaÃ§Ã£o presumida.' },
  'CRM-RES-020': { nextAction: PA('010'), temporal: 'NOT_APPLICABLE', reason: 'Pagamento confirmado conclui somente requisitos comerciais ainda pendentes.' },
  'CRM-RES-021': { nextAction: null, temporal: 'NOT_APPLICABLE', operationalState: 'HANDOFF_OPERATIONAL', handoff: true, reason: 'Pedido confirmado realiza handoff operacional sem inventar nova etapa comercial.' },
  'CRM-RES-022': { nextAction: PA('014'), temporal: 'REQUIRED_FUTURE', reason: 'Retorno combinado exige motivo, aÃ§Ã£o futura e momento ou critÃ©rio real.' },
  'CRM-RES-023': { nextAction: null, alternatives: [PA('016')], temporal: 'OPTIONAL_FUTURE', reason: 'Recebimento correto permite avaliar experiÃªncia, mas nÃ£o presume satisfaÃ§Ã£o.' },
  'CRM-RES-024': { nextAction: PA('017'), temporal: 'OPTIONAL_FUTURE', operationalState: 'POST_SALE_ATTENTION', reason: 'Problema pÃ³s-venda aberto precede recompra e cross-sell.' },
  'CRM-RES-025': { nextAction: null, alternatives: [PA('016')], temporal: 'OPTIONAL_FUTURE', reason: 'Problema resolvido pode levar Ã  avaliaÃ§Ã£o de experiÃªncia quando adequada.' },
  'CRM-RES-026': { nextAction: null, alternatives: [PA('018')], temporal: 'OPTIONAL_FUTURE', reason: 'ExperiÃªncia positiva nÃ£o cria oferta de reposiÃ§Ã£o automÃ¡tica.' },
  'CRM-RES-027': { nextAction: null, alternatives: [PA('006'), PA('017')], temporal: 'OPTIONAL_FUTURE', reason: 'ExperiÃªncia neutra depende do conteÃºdo; nÃ£o deve virar problema ou oferta automaticamente.' },
  'CRM-RES-028': { nextAction: null, alternatives: [PA('017')], temporal: 'OPTIONAL_FUTURE', reason: 'ExperiÃªncia negativa sÃ³ pede ocorrÃªncia quando houver problema real.' },
  'CRM-RES-029': { nextAction: null, alternatives: [PA('018')], temporal: 'OPTIONAL_FUTURE', reason: 'Boa aceitaÃ§Ã£o na revenda nÃ£o prova necessidade de reposiÃ§Ã£o.' },
  'CRM-RES-030': { nextAction: null, alternatives: [PA('014')], temporal: 'OPTIONAL_FUTURE', reason: 'Estoque suficiente nÃ£o cria follow-up sem motivo futuro real.' },
  'CRM-RES-031': { nextAction: PA('018'), temporal: 'NOT_APPLICABLE', reason: 'Estoque baixo pede avaliaÃ§Ã£o de reposiÃ§Ã£o, nÃ£o pedido presumido.' },
  'CRM-RES-032': { nextAction: PA('019'), temporal: 'NOT_APPLICABLE', reason: 'ReposiÃ§Ã£o solicitada conduz nova compra sem requalificaÃ§Ã£o completa.' },
  'CRM-RES-033': { nextAction: null, temporal: 'PROHIBITED', operationalState: 'CONTACT_RESTRICTED', reason: 'NÃ£o deseja contato bloqueia aÃ§Ãµes comerciais incompatÃ­veis e preserva o histÃ³rico.' },
};

function resultFromFact(fact: CrmNewFact | null | undefined): CrmResultCode | null {
  switch (fact?.eventType) {
    case 'payment_informed': return 'CRM-RES-019';
    case 'payment_confirmed': return 'CRM-RES-020';
    case 'order_confirmed': return 'CRM-RES-021';
    case 'refusal': return 'CRM-RES-002';
    case 'objection': return 'CRM-RES-010';
    case 'post_sale_issue': return 'CRM-RES-024';
    case 'delivery_confirmed': return 'CRM-RES-023';
    default: return null;
  }
}

function chooseAction(rule: TransitionRule, context: CrmTransitionContext): CrmNextActionCode | null {
  const candidates = [rule.nextAction, ...(rule.alternatives ?? [])].filter(Boolean) as CrmNextActionCode[];
  const operational = context.operationalContext;
  const canUseFutureBridge = Boolean(operational?.hasLegitimateFutureReason);
  const supportedAction = operational?.supportedNextAction;
  if (context.result === 'CRM-RES-020') return operational?.hasPendingCommercialRequirement ? PA('010') : null;
  if (context.result === 'CRM-RES-022') return operational?.hasConcreteReturnMoment ? PA('014') : null;
  if (supportedAction && candidates.includes(supportedAction)) {
    if (supportedAction !== PA('014') || canUseFutureBridge) return supportedAction;
  }
  if (rule.nextAction === null && rule.alternatives?.includes(PA('014'))) return canUseFutureBridge ? PA('014') : null;
  if (context.result === 'CRM-RES-018') return operational?.paymentGuidanceNeeded ? PA('012') : null;
  if (context.result === 'CRM-RES-012' && operational?.allowLegitimateNoNextAction) return null;
  if (context.result === 'CRM-RES-028') return operational?.requiresOccurrenceFollowUp ? PA('017') : null;
  if (context.result === 'CRM-RES-023' || context.result === 'CRM-RES-025' || context.result === 'CRM-RES-026' || context.result === 'CRM-RES-029' || context.result === 'CRM-RES-028') return null;
  if (context.result === 'CRM-RES-027') {
    if (operational?.requiresOccurrenceFollowUp) return PA('017');
    if (operational?.requiresClarification) return PA('006');
    return null;
  }
  return rule.nextAction;
}

function decisionForRestriction(context: CrmTransitionContext): CrmTransitionDecision {
  return {
    result: 'CRM-RES-033',
    stage: { action: 'KEEP', reason: 'RestriÃ§Ã£o de contato nÃ£o apaga histÃ³rico nem inventa etapa comercial.' },
    nextAction: { value: null, reason: 'AÃ§Ãµes comerciais incompatÃ­veis ficam sem prÃ³xima aÃ§Ã£o.' },
    temporal: { required: false, policy: 'PROHIBITED', reason: 'RestriÃ§Ã£o de contato proÃ­be programaÃ§Ã£o comercial futura.' },
    desiredOperationalState: 'CONTACT_RESTRICTED',
    handoff: { required: false, reason: 'RestriÃ§Ã£o nÃ£o Ã© handoff nem exclusÃ£o de cadastro.' },
    obsoletePreviousProgramming: Boolean(context.currentNextAction || context.currentReturnAt),
    reason: 'CRM-TR-X07: restriÃ§Ã£o de contato prevalece sobre programaÃ§Ãµes comerciais incompatÃ­veis.',
  };
}

/** Motor oficial, puro e determinÃ­stico das transiÃ§Ãµes canÃ´nicas do CRM. */
export function getCrmTransition(context: CrmTransitionContext): CrmTransitionDecision {
  if (context.contactRestricted || context.result === 'CRM-RES-033') return decisionForRestriction(context);

  const factResult = resultFromFact(context.newFact);
  const effectiveResult = context.hasOpenPostSaleIssue ? 'CRM-RES-024' : (factResult ?? context.result);
  const rule = RULES[effectiveResult];
  const actionContext = { ...context, result: effectiveResult };
  const action = chooseAction(rule, actionContext);
  const usesTemporalBridge = action === PA('014');
  const missingReturnContext = effectiveResult === 'CRM-RES-022' && !context.operationalContext?.hasConcreteReturnMoment;
  const temporalPolicy = missingReturnContext
    ? 'MISSING_REQUIRED_CONTEXT'
    : rule.temporal === 'OPTIONAL_FUTURE' && !usesTemporalBridge
      ? 'NOT_APPLICABLE'
      : rule.temporal;
  const temporalRequired = temporalPolicy === 'REQUIRED_FUTURE' || temporalPolicy === 'MISSING_REQUIRED_CONTEXT';
  const stage = { action: 'KEEP' as const, reason: 'Menor movimento responsÃ¡vel: destino documental nÃ£o Ã© convertido em funnel_status sem contrato tÃ©cnico homologado.' };
  const handoffRequired = Boolean(rule.handoff) || (effectiveResult === 'CRM-RES-020' && action === null);

  return {
    result: effectiveResult,
    stage,
    nextAction: { value: action, reason: rule.reason },
    temporal: {
      required: temporalRequired,
      policy: temporalPolicy,
      reason: temporalRequired
        ? 'AÃ§Ã£o futura com retorno combinado requer tempo ou critÃ©rio real.'
        : temporalPolicy === 'PROHIBITED'
          ? 'NÃ£o hÃ¡ aÃ§Ã£o futura legÃ­tima para sustentar programaÃ§Ã£o temporal.'
          : 'O motor informa apenas a polÃ­tica temporal; nÃ£o calcula datas.',
    },
    desiredOperationalState: rule.operationalState ?? (usesTemporalBridge ? 'TEMPORAL_CONTINUITY' : 'KEEP'),
    handoff: {
      required: handoffRequired,
      type: handoffRequired ? 'operational' : undefined,
      reason: handoffRequired
        ? 'A continuidade passa ao domÃ­nio operacional responsÃ¡vel, sem nova etapa comercial artificial.'
        : 'Nenhum handoff operacional Ã© inferido por este resultado.',
    },
    obsoletePreviousProgramming: Boolean(context.currentNextAction || context.currentReturnAt) && (
      context.newFactRelation === 'SUPERSEDES'
      || context.newFactRelation === 'INCOMPATIBLE'
      || Boolean(context.hasOpenPostSaleIssue)
      || (context.currentNextAction === PA('014') && action !== PA('014'))
    ),
    reason: context.hasOpenPostSaleIssue
      ? 'CRM-TR-X08: problema pÃ³s-venda aberto prevalece sobre recompra e cross-sell.'
      : context.newFactRelation === 'SUPERSEDES' || context.newFactRelation === 'INCOMPATIBLE'
        ? 'CRM-TR-X01/X06: novo fato incompatÃ­vel ou substitutivo exige reavaliaÃ§Ã£o da programaÃ§Ã£o anterior.'
        : context.newFactRelation === 'COMPATIBLE'
          ? 'Novo fato compatÃ­vel preserva a programaÃ§Ã£o existente enquanto ela continuar sustentada.'
        : rule.reason,
  };
}

export const CRM_TRANSITION_RESULTS = Object.freeze(Object.keys(RULES) as CrmResultCode[]);

/**
 * FRENTE 4.3 — leitura auxiliar: Próximas Ações canônicas admissíveis para um
 * Resultado. Não decide nada (a autoridade continua sendo `getCrmTransition`);
 * serve apenas para limitar a IA às opções já permitidas pelo motor.
 */
export function getCrmTransitionCandidates(result: CrmResultCode): CrmNextActionCode[] {
  const rule = RULES[result];
  if (!rule) return [];
  return [rule.nextAction, ...(rule.alternatives ?? [])].filter(Boolean) as CrmNextActionCode[];
}
