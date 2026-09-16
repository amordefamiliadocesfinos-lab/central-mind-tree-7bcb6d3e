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

export interface CrmResultSuggestion {
  /** null = a IA não tem informação suficiente para sugerir com segurança. */
  code: string | null;
  label: string | null;
  /** Normalizada em 0–1. */
  confidence: number;
  reason: string;
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
  return { code: canonical?.code ?? null, label: canonical?.label ?? null, confidence: canonical ? confidence : 0, reason };
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
  return normalizeSuggestionResponse(raw);
}

export async function suggestCrmResult(
  contactId: string,
  conversationId?: string | null,
  options?: { sources?: CrmAiContextSources; invoke?: (context: CrmAiContext) => Promise<any> },
): Promise<CrmResultSuggestion> {
  const context = await buildCrmAiContext(contactId, conversationId, options?.sources);
  return suggestCrmResultFromContext(context, options?.invoke);
}
