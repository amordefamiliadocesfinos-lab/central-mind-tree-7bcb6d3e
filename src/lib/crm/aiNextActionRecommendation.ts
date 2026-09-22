/**
 * FRENTE 4.3 — Inteligência Assistida CRM: Próxima Ação recomendada.
 *
 * Autoridade: `getCrmTransition()`. A IA NUNCA cria nem escolhe uma Próxima
 * Ação: ela apenas explica a decisão determinística ou a ambiguidade legítima.
 * Opções canônicas continuam visíveis como possibilidades, mas só fatos
 * operacionais adicionais podem fazer o motor selecionar uma delas.
 *
 * Camada de leitura pura: não registra Resultado, não cria tarefa nem
 * return_at, não altera funil/prioridade e não envia mensagem. Datas nunca são
 * inventadas — apenas sinalizamos "Data necessária".
 */
import { supabase } from '@/integrations/supabase/client';
import { buildCrmAiRequestContext, isCrmAiPerformanceLoggingEnabled, type CrmAiContext } from './aiContext';
import { normalizeCrmStage } from './model';
import { getCanonicalNextAction } from './canonical/nextActions';
import { getCanonicalResult } from './canonical/results';
import { getCrmTransition, getCrmTransitionCandidates, type CrmTransitionContext, type CrmTransitionDecision } from './canonical/transitions';
import type { CrmNextActionCode, CrmResultCode } from './canonical/types';

export interface CrmNextActionRecommendation {
  resultCode: CrmResultCode;
  resultLabel: string | null;
  /** null = ausência legítima ou ambiguidade ainda sem fato suficiente. */
  nextActionCode: CrmNextActionCode | null;
  nextActionLabel: string | null;
  /** true quando ainda não existe uma ação canônica executável agora. */
  noImmediateAction: boolean;
  /** true quando a ação exige data — o operador escolhe no fluxo atual. */
  requiresDate: boolean;
  temporalPolicy: CrmTransitionDecision['temporal']['policy'];
  stageChange: { changes: boolean; to: string | null };
  /** Motivo determinístico do motor (sempre presente). */
  reason: string;
  /** Explicação curta da IA, quando solicitada. Nunca substitui o código. */
  aiExplanation: string | null;
  /** Opções canônicas possíveis enquanto falta fato operacional para decidir. */
  candidates: { code: CrmNextActionCode; label: string }[];
  /** Mantido por compatibilidade; D3 torna esta flag sempre false. */
  chosenByAi: boolean;
}

/** Traduz o CrmAiContext (F4.1) para o contexto declarativo do motor canônico. */
export function buildTransitionContextFromAiContext(context: CrmAiContext, result: CrmResultCode): CrmTransitionContext {
  const currentNextAction = getCanonicalNextAction(context.nextAction?.code)?.code ?? null;
  return {
    result,
    currentStage: normalizeCrmStage(context.contact?.stage ?? null),
    currentNextAction,
    currentNextActionDate: context.nextAction?.dueAt ?? null,
    currentReturnAt: context.conversation?.returnAt ?? null,
    conversationStatus: context.conversation?.status ?? null,
    attendanceState: context.conversation?.state ?? null,
    needsReply: Boolean(context.conversation?.needsReply),
    contactRestricted: Boolean(context.contact?.optOut) || result === 'CRM-RES-033',
    // Nada é presumido: sem evidência declarada, o motor decide pela ausência.
    operationalContext: {},
  };
}

function candidatesFor(result: CrmResultCode) {
  return getCrmTransitionCandidates(result)
    .map(code => {
      const canonical = getCanonicalNextAction(code);
      return canonical ? { code: canonical.code, label: canonical.label } : null;
    })
    .filter(Boolean) as { code: CrmNextActionCode; label: string }[];
}

export interface RecommendNextActionOptions {
  /** Solicita à IA somente explicação da decisão/ambiguidade canônica. */
  explain?: boolean;
  invoke?: (payload: unknown) => Promise<any>;
}

export async function recommendCrmNextAction(
  context: CrmAiContext,
  resultCode: string,
  options?: RecommendNextActionOptions,
): Promise<CrmNextActionRecommendation | null> {
  const canonicalResult = getCanonicalResult(resultCode);
  if (!canonicalResult) return null; // Resultado fora do catálogo: nada é recomendado.

  const result = canonicalResult.code as CrmResultCode;
  const decision = getCrmTransition(buildTransitionContextFromAiContext(context, result));
  const candidates = candidatesFor(result);
  const nextActionCode = decision.nextAction.value;
  let aiExplanation: string | null = null;

  // D3 — a IA pode explicar tanto uma decisão clara quanto uma ambiguidade,
  // mas nunca transforma um candidato em Próxima Ação. Só o motor canônico,
  // alimentado por fatos operacionais reais, tem essa autoridade.
  const ambiguous = nextActionCode === null && candidates.length > 1;
  if (options?.explain) {
    const invoke = options.invoke ?? (async (payload: unknown) => {
      const startedAt = performance.now();
      const { data, error } = await supabase.functions.invoke('crm-ai-assistant', { body: payload });
      if (isCrmAiPerformanceLoggingEnabled()) {
        console.debug('[CRM IA] explicação de próxima ação', {
          edgeAndModelMs: Math.round(performance.now() - startedAt),
          payloadBytes: JSON.stringify(payload).length,
        });
      }
      if (error) throw error;
      return data;
    });
    try {
      const raw = await invoke({
        mode: 'next_action',
        context: buildCrmAiRequestContext(context, 'next_action'),
        result: { code: result, label: canonicalResult.label },
        decision: {
          nextActionCode: decision.nextAction.value,
          reason: decision.nextAction.reason,
          temporalPolicy: decision.temporal.policy,
          requiresDate: decision.temporal.required,
        },
        candidates,
        ambiguous,
      });
      if (raw && !raw.error) {
        const explanation = typeof raw.explanation === 'string' ? raw.explanation.trim() : '';
        if (explanation) aiExplanation = explanation.slice(0, 280);
        // Defesa em profundidade: `chosen_next_action_code` é deliberadamente
        // ignorado, inclusive quando aponta para um candidato canônico válido.
      }
    } catch (error) {
      console.error('crm-ai-assistant (next_action):', error);
    }
  }

  const canonicalAction = getCanonicalNextAction(nextActionCode);
  return {
    resultCode: result,
    resultLabel: canonicalResult.label,
    nextActionCode: canonicalAction?.code ?? null,
    nextActionLabel: canonicalAction?.label ?? null,
    noImmediateAction: !canonicalAction,
    requiresDate: decision.temporal.required,
    temporalPolicy: decision.temporal.policy,
    stageChange: { changes: decision.stage.action === 'CHANGE', to: decision.stage.value ?? null },
    reason: decision.nextAction.reason,
    aiExplanation,
    candidates,
    chosenByAi: false,
  };
}
