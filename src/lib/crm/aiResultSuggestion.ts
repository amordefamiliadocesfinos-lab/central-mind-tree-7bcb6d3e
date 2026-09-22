/**
 * FRENTE 4.2 — Inteligência Assistida CRM: sugestão de Resultado.
 *
 * Camada de leitura: monta o contexto (F4.1), chama a Edge Function
 * `crm-ai-assistant` e valida a resposta também no cliente. Nenhum efeito
 * colateral: não grava Resultado, etapa, tarefa, retorno, prioridade,
 * opt-out ou campanha, e não envia mensagem.
 */
import { supabase } from '@/integrations/supabase/client';
import { buildCrmAiContext, buildCrmAiRequestContext, isCrmAiPerformanceLoggingEnabled, type CrmAiContext, type CrmAiContextSources } from './aiContext';
import { getCanonicalResult } from './canonical/results';
import { getCrmAiEscalationReasons } from './aiModelRouting';

/**
 * Limiar operacional já usado pela decisão de comunicação para marcar
 * `low_result_confidence`. Abaixo dele, a classificação continua visível como
 * hipótese, mas não pode dirigir Próxima Ação nem ser aplicada diretamente.
 */
export const CRM_RESULT_ACTIONABLE_CONFIDENCE = 0.55;
const CRM_OPERATION_TIME_ZONE = 'America/Sao_Paulo';

export interface CrmResultSuggestion {
  /** null = não há Resultado confiável o bastante para dirigir ação operacional. */
  code: string | null;
  label: string | null;
  /** Hipótese preservada apenas para leitura quando a confiança é baixa. */
  tentativeCode?: string | null;
  tentativeLabel?: string | null;
  /** Normalizada em 0–1. */
  confidence: number;
  reason: string;
}

function operationalDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CRM_OPERATION_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
}

/**
 * Uso real 21/09/2026: a fila classificava corretamente `return_at` como
 * "Retorno hoje", enquanto a explicação livre da IA chamou o mesmo instante
 * de "data futura" por observar apenas o timestamp. A fila continua soberana;
 * esta guarda corrige somente a linguagem apresentada pelo Assistente.
 */
export function normalizeSuggestionTemporalReason(
  suggestion: CrmResultSuggestion,
  context: Pick<CrmAiContext, 'generatedAt' | 'conversation'>,
): CrmResultSuggestion {
  const returnDay = operationalDateKey(context.conversation?.returnAt);
  const generatedDay = operationalDateKey(context.generatedAt);
  if (!returnDay || !generatedDay || returnDay !== generatedDay) return suggestion;
  if (!/\bfutur[ao]\b/i.test(suggestion.reason)) return suggestion;
  return {
    ...suggestion,
    reason: 'Retorno programado para hoje; não deve ser tratado como data futura.',
  };
}

/** Valida a resposta da IA no cliente: código canônico e confiança normalizada. */
export function normalizeSuggestionResponse(raw: any): CrmResultSuggestion {
  const rawCode = typeof raw?.suggested_result_code === 'string' ? raw.suggested_result_code.trim() : '';
  const canonical = rawCode ? getCanonicalResult(rawCode) : null;
  let confidence = Number(raw?.confidence);
  if (!Number.isFinite(confidence)) confidence = 0;
  if (confidence > 1) confidence = confidence / 100;
  confidence = Math.min(1, Math.max(0, confidence));
  const reason = typeof raw?.reason === 'string' && raw.reason.trim()
    ? raw.reason.trim()
    : 'Ainda aguardando resposta do cliente.';

  if (rawCode && !canonical) {
    // Código fora do catálogo canônico: descartado, nunca propagado à Inbox.
    return { code: null, label: null, confidence: 0, reason: 'A IA retornou um resultado fora do catálogo canônico.' };
  }

  if (canonical && confidence < CRM_RESULT_ACTIONABLE_CONFIDENCE) {
    // F2-F: preserva a leitura da IA para o operador, mas não propaga o código
    // como Resultado acionável. Assim nenhuma Próxima Ação é derivada dele e o
    // fluxo de registro não recebe uma classificação abaixo do limiar já usado
    // pela própria decisão operacional do Assistente.
    return {
      code: null,
      label: null,
      tentativeCode: canonical.code,
      tentativeLabel: canonical.label,
      confidence,
      reason,
    };
  }

  return {
    code: canonical?.code ?? null,
    label: canonical?.label ?? null,
    tentativeCode: null,
    tentativeLabel: null,
    confidence: canonical ? confidence : 0,
    reason,
  };
}

/** Sugere o Resultado a partir de um contexto já montado (reuso na F4.3). */
export async function suggestCrmResultFromContext(
  context: CrmAiContext,
  invokeFn?: (context: CrmAiContext) => Promise<any>,
): Promise<CrmResultSuggestion> {
  const invoke = invokeFn ?? (async (ctx: CrmAiContext) => {
    const startedAt = performance.now();
    const requestContext = buildCrmAiRequestContext(ctx, 'result');
    const { data, error } = await supabase.functions.invoke('crm-ai-assistant', {
      body: {
        context: requestContext,
        routing: { escalationReasons: getCrmAiEscalationReasons(ctx) },
      },
    });
    if (isCrmAiPerformanceLoggingEnabled()) {
      console.debug('[CRM IA] sugestão de resultado', {
        edgeAndModelMs: Math.round(performance.now() - startedAt),
        payloadBytes: JSON.stringify({ context: requestContext }).length,
      });
    }
    if (error) throw error;
    return data;
  });
  const raw = await invoke(context);
  if (raw?.error) throw new Error(String(raw.error));
  return normalizeSuggestionTemporalReason(normalizeSuggestionResponse(raw), context);
}

export async function suggestCrmResult(
  contactId: string,
  conversationId?: string | null,
  options?: { sources?: CrmAiContextSources; invoke?: (context: CrmAiContext) => Promise<any> },
): Promise<CrmResultSuggestion> {
  const context = await buildCrmAiContext(contactId, conversationId, options?.sources);
  return suggestCrmResultFromContext(context, options?.invoke);
}
