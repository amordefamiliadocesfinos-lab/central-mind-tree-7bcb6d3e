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
import { buildCrmAiRequestContext, isCrmAiPerformanceLoggingEnabled, type CrmAiContext } from './aiContext';
import type { CrmNextActionRecommendation } from './aiNextActionRecommendation';
import {
  DEFAULT_BUILDING_COMMUNICATION_PROFILE,
  type CommunicationProfile,
  type CrmCommunicationDecision,
  type CrmCommunicationDraft,
} from './communication';
import { resolveCrmKnowledgeContext, shouldQueryCrmKnowledge, type CrmKnowledgeContext } from './knowledgeContext';
import { getCrmAiEscalationReasons } from './aiModelRouting';

export interface CrmReplySuggestion extends CrmCommunicationDraft {
  /** null = não há motivo real para responder agora. */
  reply: string | null;
  reason: string;
  tone: CrmCommunicationDraft['tone'];
}

export interface SuggestCrmReplyOptions {
  result?: { code: string; label: string | null } | null;
  nextAction?: Pick<CrmNextActionRecommendation, 'nextActionCode' | 'nextActionLabel'> | null;
  decision?: CrmCommunicationDecision;
  profile?: CommunicationProfile;
  knowledgeFetcher?: (platformId?: string | null) => Promise<CrmKnowledgeContext['items']>;
  invoke?: (payload: unknown) => Promise<any>;
}

export function normalizeReplyResponse(raw: any): CrmReplySuggestion {
  const text = typeof raw?.suggested_reply === 'string' ? raw.suggested_reply.trim() : '';
  const reply = text ? text : null;
  const reason = typeof raw?.reason === 'string' && raw.reason.trim()
    ? raw.reason.trim()
    : (reply ? 'Resposta alinhada ao contexto do atendimento.' : 'Nenhuma resposta necessária no momento.');
  const rawTone = typeof raw?.tone === 'string' ? raw.tone.trim() : '';
  const tone: CrmCommunicationDraft['tone'] = (['cordial', 'consultivo', 'objetivo', 'acolhedor'] as const).includes(rawTone as any)
    ? (rawTone as CrmCommunicationDraft['tone'])
    : null;
  const intent = ['answer', 'follow_up', 'clarify', 'acknowledge'].includes(raw?.intent) ? raw.intent : (reply ? 'answer' : 'none');
  const length = raw?.length === 'medium' ? 'medium' : 'short';
  return { reply, message: reply, reason, rationale: reason, tone, intent, length };
}

/**
 * Perguntas inbound consecutivas ainda aguardam resposta enquanto não houver
 * uma mensagem outbound posterior. Reunimos no máximo três consultas factuais
 * para responder o bloco pendente sem misturar assuntos mais antigos.
 */
function pendingFactualQuestions(messages: CrmAiContext['messages']): string | null {
  const pending: string[] = [];
  for (let index = (messages?.length ?? 0) - 1; index >= 0 && pending.length < 3; index -= 1) {
    const message = messages[index];
    if (message?.direction === 'outbound') break;
    if (message?.direction !== 'inbound') continue;
    const content = String(message.content ?? '').trim();
    // Encerramento explícito supera uma pergunta temática anterior que ainda
    // esteja no histórico da janela recente.
    if (/\b(resolvid[oa]?|resolvi|deu certo|ja resolvi|já resolvi|nao precisa|não precisa)\b/i.test(content)) break;
    if (content && shouldQueryCrmKnowledge(content)) pending.unshift(content);
  }
  return pending.length > 0 ? pending.join('\n') : null;
}

function canUsePendingFactualKnowledge(options: SuggestCrmReplyOptions | undefined, lastIsInbound: boolean): boolean {
  if (!lastIsInbound) return false;
  const decision = options?.decision;
  // A decisão operacional é soberana: não ressuscitamos uma FAQ histórica em
  // atendimentos encerrados ou que estão aguardando o outro lado.
  return !decision || (decision.shouldReply && !['closed', 'awaiting_counterparty'].includes(decision.decisionState));
}

export async function suggestCrmReplyFromContext(
  context: CrmAiContext,
  options?: SuggestCrmReplyOptions,
): Promise<CrmReplySuggestion> {
  // Guarda local: opt-out sem inbound recente jamais produz abordagem outbound.
  const lastMessage = context.messages?.[context.messages.length - 1] ?? null;
  const lastIsInbound = lastMessage?.direction === 'inbound';
  // A decisão operacional é soberana. Esta guarda vem antes de KB, gateway e
  // geração livre para que uma fala nunca contradiga a ausência de ação.
  if (options?.decision && !options.decision.shouldReply) {
    return {
      reply: null,
      message: null,
      reason: options.decision.reason || 'A decisão operacional indica que não há resposta necessária no momento.',
      rationale: options.decision.reason || 'A decisão operacional indica que não há resposta necessária no momento.',
      tone: null,
      intent: 'none',
      length: 'short',
    };
  }
  if (context.contact?.optOut && !lastIsInbound) {
    return {
      reply: null,
      message: null,
      reason: 'Contato em opt-out comercial e sem mensagem recente do cliente: nova abordagem não é permitida.',
      rationale: 'Contato em opt-out comercial e sem mensagem recente do cliente: nova abordagem não é permitida.',
      tone: null,
      intent: 'none',
      length: 'short',
    };
  }

  const invoke = options?.invoke ?? (async (payload: unknown) => {
    const startedAt = performance.now();
    const { data, error } = await supabase.functions.invoke('crm-ai-assistant', { body: payload });
    if (isCrmAiPerformanceLoggingEnabled()) {
      console.debug('[CRM IA] resposta sugerida', {
        edgeAndModelMs: Math.round(performance.now() - startedAt),
        payloadBytes: JSON.stringify(payload).length,
      });
    }
    if (error) throw error;
    return data;
  });

  // A Base de Conhecimento é consultada somente para dúvidas factuais estáveis.
  // Sua indisponibilidade é absorvida pelo helper e nunca bloqueia a resposta.
  const knowledgeContext = await resolveCrmKnowledgeContext({
    message: canUsePendingFactualKnowledge(options, lastIsInbound)
      ? pendingFactualQuestions(context.messages)
      : null,
    platformId: context.conversation?.platformId ?? null,
  }, options?.knowledgeFetcher);

  // Um fato estável, específico e não ambíguo já vem da KB com sua redação
  // aprovada. Não chamamos o modelo para reescrever números, quantidades ou
  // endereços e, assim, eliminamos variação entre recarregamentos.
  if (lastIsInbound && knowledgeContext.authoritativeAnswer) {
    return {
      reply: knowledgeContext.authoritativeAnswer,
      message: knowledgeContext.authoritativeAnswer,
      reason: 'Resposta baseada em conhecimento estável aplicável.',
      rationale: 'Resposta baseada em conhecimento estável aplicável.',
      tone: 'objetivo',
      intent: 'answer',
      length: 'short',
    };
  }

  const raw = await invoke({
    mode: 'reply',
    context: buildCrmAiRequestContext(context, 'reply'),
    result: options?.result ?? null,
    nextAction: options?.nextAction
      ? { code: options.nextAction.nextActionCode, label: options.nextAction.nextActionLabel }
      : null,
    decision: options?.decision,
    communicationProfile: options?.profile ?? DEFAULT_BUILDING_COMMUNICATION_PROFILE,
    knowledgeContext,
    routing: { escalationReasons: getCrmAiEscalationReasons(context, { decision: options?.decision }) },
  });
  if (raw?.error) throw new Error(String(raw.error));
  return normalizeReplyResponse(raw);
}
