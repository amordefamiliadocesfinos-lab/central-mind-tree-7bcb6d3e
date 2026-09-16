import type { CrmAiContext } from './aiContext';
import type { CrmCommunicationDecision } from './communication';

/** Modelos usados pelo Assistente no Lovable AI Gateway. */
export const CRM_AI_FAST_MODEL = 'google/gemini-2.5-flash';
export const CRM_AI_STRONG_MODEL = 'google/gemini-2.5-pro';
export const CRM_AI_LOW_CONFIDENCE_THRESHOLD = 0.7;

export type CrmAiEscalationReason =
  | 'low_confidence'
  | 'conflicting_signals'
  | 'multiple_products_or_quantities'
  | 'relative_date'
  | 'multiple_plausible_readings'
  | 'ambiguous_context';

const RELATIVE_DATE = /\b(amanha|depois de amanha|mais tarde|semana que vem|proxima semana|no proximo dia|hoje|ontem)\b/i;
const QUANTITY = /\b\d+(?:[,.]\d+)?\s*(?:un(?:idades?)?|caixas?|kits?|pacotes?|bandejas?|kg|g|litros?|ml)\b/gi;
const PLAUSIBLE_READING = /\b(talvez|n[aã]o sei|ou ent[aã]o|tanto faz|depende|pode ser)\b/i;
const CONFLICT_SIGNAL = /\b(mas|por[eé]m|s[oó] que|na verdade|corrigindo|n[aã]o,? j[aá])\b/i;

function recentCustomerText(context: CrmAiContext): string {
  return (context.messages ?? [])
    .filter((message) => message.direction === 'inbound')
    .slice(-3)
    .map((message) => message.content)
    .join('\n');
}

function normalizeForRouting(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/**
 * Decide apenas se a leitura exige mais capacidade. Não toma Resultado nem
 * Próxima Ação e nunca é usada para escalar uma resposta FAQ determinística.
 */
export function getCrmAiEscalationReasons(
  context: CrmAiContext,
  options?: { confidence?: number | null; decision?: CrmCommunicationDecision | null },
): CrmAiEscalationReason[] {
  const text = recentCustomerText(context);
  const normalizedText = normalizeForRouting(text);
  const reasons: CrmAiEscalationReason[] = [];
  const confidence = options?.confidence;

  if (typeof confidence === 'number' && confidence < CRM_AI_LOW_CONFIDENCE_THRESHOLD) reasons.push('low_confidence');
  if (RELATIVE_DATE.test(normalizedText)) reasons.push('relative_date');
  if ((text.match(QUANTITY) ?? []).length >= 2) reasons.push('multiple_products_or_quantities');
  if (PLAUSIBLE_READING.test(text)) reasons.push('multiple_plausible_readings');
  if (CONFLICT_SIGNAL.test(text) && context.lastResult) reasons.push('conflicting_signals');
  if (options?.decision?.ambiguity && options.decision.ambiguity !== 'none') reasons.push('ambiguous_context');

  return [...new Set(reasons)];
}
