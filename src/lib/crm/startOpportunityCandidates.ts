/**
 * CRM–UX 02 / C2-01 — candidatos da Start Estratégica (somente leitura).
 *
 * Não cria fila, score, tarefa, campanha, Resultado ou atendimento.
 * A elegibilidade é de exibição/estudo, NUNCA autorização de envio: ações
 * comerciais continuam sujeitas à revalidação oficial no fluxo de destino.
 */
import { supabase } from '@/integrations/supabase/client';
import { isSupplierOnly } from './campaignEligibility';
import { getCrmPriority, type CrmPriorityInput } from './priority';
import { toCrmOperationalPriorityInput } from './operationalProjection';
import { evaluatePostSalePanelOutreach, type PostSalePanelConversationSafety } from './postSalePanelOutreach';
import { loadPostSalePanelLifecycleInsight, type PostSalePanelLifecycleInsight } from './postSalePanelLifecycle';
import type { CrmLifecycleOpportunity } from './lifecycleOpportunity';

export const START_OPPORTUNITY_INITIAL_BATCH = 8;
export const START_OPPORTUNITY_MAX_CONCURRENCY = 2;
const MAX_CONVERSATIONS_PER_CONTACT = 100;

export interface StartOpportunityContact {
  id: string;
  is_active: boolean | null;
  commercial_opt_out: boolean | null;
  type: string | null;
  funnel_status?: string | null;
  ultimo_contato?: string | null;
  next_action_date?: string | null;
  next_contact_date?: string | null;
}

export interface StartOpportunityConversation extends PostSalePanelConversationSafety {
  returnAt?: string | null;
  lastMessageAt?: string | null;
  updatedAt?: string | null;
  noResponseStatus?: CrmPriorityInput['no_response_status'];
}

export interface StartOpportunitySafetyFacts {
  contact: StartOpportunityContact | null;
  conversations: StartOpportunityConversation[];
  /** Leitura de tarefas oficiais ativas (crm_next_action / crm_reactivation). */
  hasPendingOfficialTask: boolean;
  /** Recipient pendente de campanha CRM: a Start não deve iniciar abordagem paralela. */
  hasPendingCampaignRecipient: boolean;
  /** Limite da consulta atingido: não sabemos se existem mais conversas. */
  conversationsTruncated: boolean;
}

export type StartOpportunityState = 'available' | 'blocked' | 'no_signal' | 'insufficient' | 'error';

export interface StartOpportunityCandidate {
  contactId: string;
  state: StartOpportunityState;
  reason: string;
  opportunity: CrmLifecycleOpportunity | null;
  /** Único sentido: elegível para destaque, NÃO para disparo comercial. */
  canRecommend: boolean;
}

export interface StartOpportunityBatch {
  candidates: StartOpportunityCandidate[];
  analyzedCount: number;
  inputCount: number;
  remainingCount: number;
  /** Os registros de entrada NÃO provam cobertura da empresa/CRM inteiro. */
  coverage: 'input_segment_only';
  checkedAt: string;
}

const blocked = (id: string, reason: string): StartOpportunityCandidate =>
  ({ contactId: id, state: 'blocked', reason, opportunity: null, canRecommend: false });
const insufficient = (id: string, reason: string): StartOpportunityCandidate =>
  ({ contactId: id, state: 'insufficient', reason, opportunity: null, canRecommend: false });

/**
 * Guardas antes da análise de pós-venda/recompra. Reutiliza regras do CRM
 * e falha fechada em dado ausente; não deduz liberação a partir do silêncio.
 */
export function assessStartOpportunitySafety(
  contactId: string,
  facts: StartOpportunitySafetyFacts,
  now = new Date(),
): { allowed: boolean; reason: string; insufficient: boolean } {
  const contact = facts.contact;
  if (!contact || contact.id !== contactId || typeof contact.is_active !== 'boolean'
    || typeof contact.commercial_opt_out !== 'boolean' || facts.conversationsTruncated) {
    return { allowed: false, insufficient: true, reason: 'Cadastro ou histórico de atendimento não verificado integralmente.' };
  }
  if (!contact.is_active) return { allowed: false, insufficient: false, reason: 'Contato inativo.' };
  if (isSupplierOnly(contact)) return { allowed: false, insufficient: false, reason: 'Fornecedor exclusivo; fora da abordagem comercial.' };
  const outreach = evaluatePostSalePanelOutreach(
    { isActive: contact.is_active, commercialOptOut: contact.commercial_opt_out },
    facts.conversations,
  );
  if (!outreach.allowed) return { allowed: false, insufficient: false, reason: outreach.reason };
  if (facts.hasPendingOfficialTask) {
    return { allowed: false, insufficient: false, reason: 'Próxima Ação ou reativação oficial pendente: respeitar o fluxo existente.' };
  }
  if (facts.hasPendingCampaignRecipient) {
    return { allowed: false, insufficient: false, reason: 'Contato já está em uma campanha CRM pendente.' };
  }
  if (contact.next_action_date || contact.next_contact_date) {
    return { allowed: false, insufficient: false, reason: 'Existe agendamento comercial registrado no contato; confirmar na Gestão antes de nova abordagem.' };
  }
  for (const conversation of facts.conversations) {
    if (conversation.status !== 'open') continue;
    if (conversation.returnAt) {
      return { allowed: false, insufficient: false, reason: 'Retorno operacional já programado na Inbox.' };
    }
    const input = toCrmOperationalPriorityInput({
      contactId,
      funnel_status: contact.funnel_status,
      ultimo_contato: contact.ultimo_contato,
      status: conversation.status,
      attendance_state: conversation.attendanceState,
      needs_reply: conversation.needsReply,
      last_inbound_at: conversation.lastInboundAt,
      last_outbound_at: conversation.lastOutboundAt,
      last_message_at: conversation.lastMessageAt,
      attendance_state_updated_at: conversation.updatedAt,
      no_response_status: conversation.noResponseStatus,
    });
    const priority = getCrmPriority(input, now);
    if (priority.operational && (priority.level === 'P0' || priority.level === 'P1' || priority.level === 'P2')) {
      return { allowed: false, insufficient: false, reason: `Prioridade ${priority.level} na Inbox: ${priority.label}.` };
    }
  }
  return { allowed: true, insufficient: false, reason: 'Sem impedimento identificado no retrato consultado; revalidar antes de qualquer abordagem.' };
}

/** A ausência ou falha de fatos nunca equivale a ausência de oportunidade. */
export function assessStartOpportunityCandidate(
  contactId: string,
  facts: StartOpportunitySafetyFacts,
  insight: PostSalePanelLifecycleInsight | null,
  now = new Date(),
): StartOpportunityCandidate {
  const safety = assessStartOpportunitySafety(contactId, facts, now);
  if (!safety.allowed) return safety.insufficient ? insufficient(contactId, safety.reason) : blocked(contactId, safety.reason);
  if (!insight || insight.readOnly !== true) return insufficient(contactId, 'Sinais comerciais ainda não verificados.');
  if (insight.restricted) return blocked(contactId, 'A análise oficial identificou restrição comercial.');
  const opportunity = insight.opportunity;
  if (opportunity.kind === 'repurchase' && opportunity.repurchase?.status === 'explicit') {
    return blocked(contactId, 'Recompra solicitada pelo cliente deve seguir para o atendimento da Inbox.');
  }
  if (opportunity.kind === 'post_sale' && opportunity.postSale?.eligible === true) {
    if (!opportunity.postSale.deliveryDate) return insufficient(contactId, 'Pós-venda sinalizado sem data de entrega comprovada.');
    return { contactId, state: 'available', reason: opportunity.reason, opportunity, canRecommend: true };
  }
  if (opportunity.kind === 'repurchase' && opportunity.repurchase?.status === 'probable') {
    const signal = opportunity.repurchase;
    if (signal.purchaseCount < 3 || !signal.lastPurchaseAt
      || signal.typicalIntervalDays === null || signal.typicalIntervalDays <= 0) {
      return insufficient(contactId, 'Recompra provável sem histórico ou intervalo típico comprovado.');
    }
    return { contactId, state: 'available', reason: opportunity.reason, opportunity, canRecommend: true };
  }
  return { contactId, state: 'no_signal', reason: opportunity.reason, opportunity, canRecommend: false };
}

/**
 * Adaptador apenas de SELECT: reutiliza as mesmas fontes que Inbox e Campanhas.
 * Consultas com erro ou limite atingido não liberam nenhuma recomendação.
 */
export async function loadStartOpportunitySafetyFacts(contactId: string): Promise<StartOpportunitySafetyFacts> {
  if (!contactId) throw new Error('Contato obrigatório.');
  const db = supabase as any;
  const [contactResult, conversationResult, taskResult, campaignResult] = await Promise.all([
    db.from('contacts')
      .select('id,is_active,commercial_opt_out,type,funnel_status,ultimo_contato,next_action_date,next_contact_date')
      .eq('id', contactId).maybeSingle(),
    db.from('service_conversations')
      .select('status,attendance_state,needs_reply,last_inbound_at,last_outbound_at,return_at,last_message_at,updated_at')
      .eq('contact_id', contactId).eq('status', 'open')
      .limit(MAX_CONVERSATIONS_PER_CONTACT + 1),
    db.from('tasks').select('id')
      .eq('contact_id', contactId).in('source', ['crm_next_action', 'crm_reactivation'])
      .is('deleted_at', null).neq('status', 'concluído').limit(1),
    db.from('crm_campaign_recipients').select('id')
      .eq('contact_id', contactId).eq('status', 'pending').limit(1),
  ]);
  for (const result of [contactResult, conversationResult, taskResult, campaignResult]) {
    if (result.error) throw result.error;
  }
  const rows = conversationResult.data ?? [];
  return {
    contact: contactResult.data ?? null,
    conversations: rows.slice(0, MAX_CONVERSATIONS_PER_CONTACT).map((row: any) => ({
      status: row.status ?? null,
      attendanceState: row.attendance_state ?? null,
      needsReply: row.needs_reply === true,
      lastInboundAt: row.last_inbound_at ?? null,
      lastOutboundAt: row.last_outbound_at ?? null,
      returnAt: row.return_at ?? null,
      lastMessageAt: row.last_message_at ?? null,
      updatedAt: row.updated_at ?? null,
    })),
    hasPendingOfficialTask: (taskResult.data ?? []).length > 0,
    hasPendingCampaignRecipient: (campaignResult.data ?? []).length > 0,
    conversationsTruncated: rows.length > MAX_CONVERSATIONS_PER_CONTACT,
  };
}

export interface StartCandidateAnalysisOptions {
  loadSafety?: (contactId: string) => Promise<StartOpportunitySafetyFacts>;
  loadInsight?: (contactId: string) => Promise<PostSalePanelLifecycleInsight>;
  batchSize?: number;
  onProgress?: (analyzedCount: number, inputCount: number) => void;
  now?: Date;
}

/**
 * Progressivo, sem polling automático. Cada chamada verifica só uma janela
 * de contatos recebidos do segmento oficial; a UI poderá solicitar o próximo
 * lote explicitamente em C2-02, sem inventar abrangência global.
 */
export async function analyzeStartOpportunityCandidates(
  contactIds: readonly string[],
  options: StartCandidateAnalysisOptions = {},
): Promise<StartOpportunityBatch> {
  const unique = [...new Set(contactIds)];
  if (unique.some(id => !id)) throw new Error('A seleção contém contato sem identificador.');
  const batchSize = Math.min(START_OPPORTUNITY_INITIAL_BATCH, Math.max(1, Math.trunc(options.batchSize ?? START_OPPORTUNITY_INITIAL_BATCH)));
  const selected = unique.slice(0, batchSize);
  const now = options.now ?? new Date();
  const loadSafety = options.loadSafety ?? loadStartOpportunitySafetyFacts;
  const loadInsight = options.loadInsight ?? loadPostSalePanelLifecycleInsight;
  const results: StartOpportunityCandidate[] = new Array(selected.length);
  let next = 0;
  let finished = 0;
  const worker = async () => {
    while (next < selected.length) {
      const index = next++;
      const contactId = selected[index];
      try {
        const facts = await loadSafety(contactId);
        const safety = assessStartOpportunitySafety(contactId, facts, now);
        results[index] = safety.allowed
          ? assessStartOpportunityCandidate(contactId, facts, await loadInsight(contactId), now)
          : safety.insufficient ? insufficient(contactId, safety.reason) : blocked(contactId, safety.reason);
      } catch {
        results[index] = { contactId, state: 'error', reason: 'Falha ao consultar os fatos; não inferir ausência de oportunidade.', opportunity: null, canRecommend: false };
      }
      finished++;
      options.onProgress?.(finished, unique.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(START_OPPORTUNITY_MAX_CONCURRENCY, selected.length) }, () => worker()));
  return {
    candidates: results,
    analyzedCount: finished,
    inputCount: unique.length,
    remainingCount: unique.length - finished,
    coverage: 'input_segment_only',
    checkedAt: now.toISOString(),
  };
}
