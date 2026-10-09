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
import { getUnsupportedCrmLiveDataRequirement, type CrmUnsupportedLiveDataRequirement } from './dynamicLiveData';
import { defaultCrmKnowledgeFetcher, resolveCrmKnowledgeContext, shouldQueryCrmKnowledge, type CrmKnowledgeContext } from './knowledgeContext';
import { getCrmAiEscalationReasons } from './aiModelRouting';
import { isWaitingCustomerState } from './priority';

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

const PASSIVE_OBJECTION_CLOSE = /\b(?:aguard(?:amos|o) (?:o )?seu retorno|fic(?:o|amos) no aguardo(?: do seu retorno)?|quando tiver novidades|quando puder(?:,)? (?:me )?cham[ae]|quando conseguir(?:,)? (?:me )?avis[ae])\b/i;

export function guardTreatableObjectionReply(
  suggestion: CrmReplySuggestion,
  decision?: CrmCommunicationDecision | null,
): CrmReplySuggestion {
  if (
    !suggestion.reply
    || decision?.commercialIntent !== 'objection'
    || decision.decisionState !== 'action_required'
    || decision.responsibility !== 'operator'
  ) return suggestion;

  // Pergunta ativa ou proposta de próximo movimento mantém a negociação viva.
  if (suggestion.reply.includes('?')) return suggestion;
  if (!PASSIVE_OBJECTION_CLOSE.test(suggestion.reply)) return suggestion;

  const reason = 'A objeção continua tratável e sob responsabilidade do operador; uma resposta de espera passiva encerraria a negociação cedo demais.';
  return {
    reply: null,
    message: null,
    reason,
    rationale: reason,
    tone: null,
    intent: 'none',
    length: 'short',
  };
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

/**
 * F2-H: a proteção de fonte viva precisa observar o bloco inbound ainda
 * pendente, e não apenas a última mensagem. Uma pergunta dinâmica anterior
 * continua sem resposta até existir um outbound posterior que encerre o bloco.
 */
function pendingUnsupportedLiveData(
  messages: CrmAiContext['messages'],
): CrmUnsupportedLiveDataRequirement | null {
  for (let index = (messages?.length ?? 0) - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.direction === 'outbound') break;
    if (message?.direction !== 'inbound') continue;
    const requirement = getUnsupportedCrmLiveDataRequirement(message.content);
    if (requirement) return requirement;
  }
  return null;
}

/** F5: não solicitar novamente um formulário de envio já preenchido. */
export function hasCustomerSuppliedShippingData(messages: CrmAiContext['messages']): boolean {
  const inbound = (messages ?? []).filter(message => message?.direction === 'inbound')
    .slice(-8).map(message => String(message.content ?? '')).join('\n')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const indicators = [
    /\bcpf\s*[:\-]/, /\bcep\s*[:\-]/,
    /\bendereco(?: completo)?\s*[:\-]/, /\btelefone\s*[:\-]/,
    /\be-?mail\s*[:\-]/, /\bnome completo\s*[:\-]/,
  ];
  return indicators.filter(regex => regex.test(inbound)).length >= 3;
}

export function guardShippingDataRepeat(
  suggestion: CrmReplySuggestion,
  messages: CrmAiContext['messages'],
): CrmReplySuggestion {
  if (!suggestion.reply || !hasCustomerSuppliedShippingData(messages)) return suggestion;
  const reply = suggestion.reply.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const fields = [/\bnome completo\b/, /\bcpf\b/, /\bcep\b/, /\bendereco completo\b/, /\btelefone\b/, /\be-?mail\b/];
  if (fields.filter(regex => regex.test(reply)).length < 3) return suggestion;
  const reason = 'O cliente já forneceu dados de envio no atendimento. O formulário repetido foi descartado para revisão humana.';
  return { ...suggestion, reply: null, message: null, reason, rationale: reason, intent: 'none' };
}

/** Resposta curta "Pix" só autoriza recuperar uma chave oficial existente. */
export function isPixPaymentMethodChoice(messages: CrmAiContext['messages']): boolean {
  const last = messages?.[messages.length - 1];
  if (last?.direction !== 'inbound' || !/^\s*pix[.!]?\s*$/i.test(String(last.content ?? ''))) return false;
  const previous = [...messages.slice(0, -1)].reverse().find(message => message?.direction === 'outbound');
  return Boolean(previous && /\b(forma|meio|modo|opcao|opção).{0,35}pagamento\b|\bpagamento.{0,35}(forma|meio|modo|opcao|opção)\b|\b(pix|cartao|cartão)\b/i.test(String(previous.content ?? '')));
}

export function isUnsafePixReply(reply: string): boolean {
  const normalized = reply.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /\b(?:pix|chave|cnpj)\b/.test(normalized)
    && (/\b0{2}\.0{3}\.0{3}\/0{4}-0{2}\b/.test(normalized)
      || /\b0{11,14}\b/.test(normalized)
      || /\b(?:chave|cnpj)\s*(?:pix)?\s*[:=-]?\s*(?:xxxx+|000[.\d\/-]*)\b/.test(normalized));
}

function blockedPixReply(reason: string): CrmReplySuggestion {
  return { reply: null, message: null, reason, rationale: reason, tone: null, intent: 'none', length: 'short' };
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

  // F2-D/F2-E: uma intenção de recompra não pode transformar automaticamente
  // um atendimento em estado equivalente a "aguardando cliente" em nova
  // abordagem outbound. Reutilizamos a mesma normalização da fila/prioridade.
  if (
    options?.decision?.commercialIntent === 'repurchase'
    && isWaitingCustomerState(context.conversation?.state)
    && !lastIsInbound
  ) {
    const reason = 'O atendimento está aguardando o cliente. A oportunidade de recompra pode permanecer visível, mas não deve gerar nova abordagem enquanto esse estado estiver ativo.';
    return {
      reply: null,
      message: null,
      reason,
      rationale: reason,
      tone: null,
      intent: 'none',
      length: 'short',
    };
  }

  // F2-B/F2-H: se qualquer pergunta ainda pendente no bloco inbound exige um
  // fato vivo que este contexto não transporta, não chamamos FAQ nem IA para
  // preencher a lacuna. Um outbound posterior encerra naturalmente esse bloco.
  const unsupportedLiveData = lastIsInbound
    ? pendingUnsupportedLiveData(context.messages)
    : null;
  if (unsupportedLiveData) {
    const reason = `${unsupportedLiveData.reason} O Assistente não sugere esse dado sem fonte viva disponível.`;
    return {
      reply: null,
      message: null,
      reason,
      rationale: reason,
      tone: null,
      intent: 'none',
      length: 'short',
    };
  }

  // Chave Pix é identificador financeiro, nunca inferência do modelo.
  if (isPixPaymentMethodChoice(context.messages)) {
    try {
      const items = await (options?.knowledgeFetcher ?? defaultCrmKnowledgeFetcher)(context.conversation?.platformId ?? null);
      const official = items.filter(item => /^\s*qual (?:e|é) o pix\??\s*$/i.test(item.question));
      if (official.length === 1 && official[0].answer.trim()
        && !isUnsafePixReply(official[0].answer)
        && /\bpix\b/i.test(official[0].answer)) {
        const reply = official[0].answer.trim();
        return { reply, message: reply, reason: 'Chave Pix extraída da base oficial ativa; sem geração livre.', rationale: 'Chave Pix extraída da base oficial ativa; sem geração livre.', tone: 'objetivo', intent: 'answer', length: 'short' };
      }
    } catch {
      // Falha de leitura: não recorrer à geração livre de chave financeira.
    }
    return blockedPixReply('Não foi possível confirmar uma única chave Pix oficial ativa. Confira a base de conhecimento antes de responder.');
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
    return guardShippingDataRepeat({
      reply: knowledgeContext.authoritativeAnswer,
      message: knowledgeContext.authoritativeAnswer,
      reason: 'Resposta baseada em conhecimento estável aplicável.',
      rationale: 'Resposta baseada em conhecimento estável aplicável.',
      tone: 'objetivo',
      intent: 'answer',
      length: 'short',
    }, context.messages);
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
  const suggestion = guardShippingDataRepeat(guardTreatableObjectionReply(normalizeReplyResponse(raw), options?.decision), context.messages);
  if (suggestion.reply && isUnsafePixReply(suggestion.reply)) return blockedPixReply('Sugestão bloqueada: identificador Pix/CNPJ fictício. Confira a fonte oficial.');
  return suggestion;
}
