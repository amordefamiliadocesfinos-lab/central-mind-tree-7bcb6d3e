/**
 * FRENTE 4.4 — Inteligência Assistida CRM: resposta sugerida.
 *
 * Reutiliza o `CrmAiContext` (F4.1) — nenhum contexto paralelo é montado — e o
 * mesmo Edge Function `crm-ai-assistant` (modo `reply`).
 *
 * Camada de leitura pura: nunca envia mensagem (não chama `whatsapp-send`),
 * não grava Resultado/tarefa/return_at e não altera funil ou prioridade.
 * "Usar resposta" apenas preenche o composer no componente.
 */
import { supabase } from '@/integrations/supabase/client';
import type { CrmAiContext } from './aiContext';
import type { CrmNextActionRecommendation } from './aiNextActionRecommendation';

export interface CrmReplySuggestion {
  /** null = não há motivo real para responder agora. */
  reply: string | null;
  reason: string;
  tone: string | null;
}

export interface SuggestCrmReplyOptions {
  result?: { code: string; label: string | null } | null;
  nextAction?: Pick<CrmNextActionRecommendation, 'nextActionCode' | 'nextActionLabel'> | null;
  invoke?: (payload: unknown) => Promise<any>;
}

export function normalizeReplyResponse(raw: any): CrmReplySuggestion {
  const text = typeof raw?.suggested_reply === 'string' ? raw.suggested_reply.trim() : '';
  const reply = text ? text : null;
  const reason = typeof raw?.reason === 'string' && raw.reason.trim()
    ? raw.reason.trim()
    : (reply ? 'Resposta alinhada ao contexto do atendimento.' : 'Nenhuma resposta necessária no momento.');
  const tone = typeof raw?.tone === 'string' && raw.tone.trim() ? raw.tone.trim() : null;
  return { reply, reason, tone };
}

export async function suggestCrmReplyFromContext(
  context: CrmAiContext,
  options?: SuggestCrmReplyOptions,
): Promise<CrmReplySuggestion> {
  // Guarda local: opt-out sem inbound recente jamais produz abordagem outbound.
  const lastMessage = context.messages?.[context.messages.length - 1] ?? null;
  const lastIsInbound = lastMessage?.direction === 'inbound';
  if (context.contact?.optOut && !lastIsInbound) {
    return {
      reply: null,
      reason: 'Contato em opt-out comercial e sem mensagem recente do cliente: nova abordagem não é permitida.',
      tone: null,
    };
  }

  const invoke = options?.invoke ?? (async (payload: unknown) => {
    const { data, error } = await supabase.functions.invoke('crm-ai-assistant', { body: payload });
    if (error) throw error;
    return data;
  });

  const raw = await invoke({
    mode: 'reply',
    context,
    result: options?.result ?? null,
    nextAction: options?.nextAction
      ? { code: options.nextAction.nextActionCode, label: options.nextAction.nextActionLabel }
      : null,
  });
  if (raw?.error) throw new Error(String(raw.error));
  return normalizeReplyResponse(raw);
}
