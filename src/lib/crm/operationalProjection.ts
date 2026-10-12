import { getCanonicalResult } from './canonical/results';
import { getCrmOperationalResponsibility, type CrmOperationalResponsibility } from './canonical/operationalResponsibility';
import { normalizeCrmStage } from './model';
import { getOfficialCrmNextActionAt, getOfficialCrmTaskDueAt } from './officialTask';
import { getCrmPriority, type CrmPriority, type CrmPriorityInput } from './priority';

/**
 * F1-A — projeção somente leitura dos fatos já conhecidos pelo CRM.
 * Não altera o motor de prioridade, etapas, Resultados, tarefas ou conversas.
 * Campos sem comprovação ficam ausentes; nunca inferimos conclusão de handoff.
 */
export interface CrmOperationalSource extends CrmPriorityInput {
  contactId: string;
  conversationId?: string | null;
  funnel_status?: string | null;
  next_action_text?: string | null;
  next_action_title?: string | null;
  /** Confirma que o prazo/título nasceu de uma tarefa oficial ativa. */
  official_task_present?: boolean;
  /** Código do último Resultado efetivamente registrado, nunca uma hipótese da IA. */
  last_result_code?: string | null;
  /** Metadado gravado no evento canônico; não comprova recebimento por Operações. */
  handoff_required?: boolean | null;
}

export interface CrmOperationalProjection {
  contactId: string;
  conversationId: string | null;
  priority: CrmPriority;
  lastResultCode: string | null;
  /** Responsabilidade declarada pelo último Resultado, não uma transferência comprovada. */
  resultResponsibility: CrmOperationalResponsibility | null;
  obligation: { title: string | null; dueAt: string | null; source: 'official_task' | 'contact' } | null;
  handoffRequired: boolean | null;
  handoffVerified: false;
}

/** Composição temporal oficial compartilhada com a Inbox e a IA. */
export function getCrmOperationalTaskDueAt(task: {
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  due_date?: string | null;
}): string | null {
  return task.scheduled_date
    ? getOfficialCrmTaskDueAt(task.scheduled_date, task.scheduled_time)
    : getOfficialCrmNextActionAt(task.due_date);
}

/**
 * Adaptador comum: a prioridade continua pertencendo exclusivamente
 * a getCrmPriority(). Nenhum Resultado ou texto de IA altera essa regra.
 */
export function toCrmOperationalPriorityInput(source: CrmOperationalSource): CrmPriorityInput {
  const stage = source.funnel_status ? normalizeCrmStage(source.funnel_status) : null;
  return {
    needs_reply: source.needs_reply,
    status: source.status,
    attendance_state: source.attendance_state,
    return_at: source.return_at,
    next_action_date: source.next_action_date,
    reactivation_at: source.reactivation_at,
    next_contact_date: source.next_contact_date,
    ultimo_contato: source.ultimo_contato,
    last_inbound_at: source.last_inbound_at,
    last_outbound_at: source.last_outbound_at,
    last_message_at: source.last_message_at,
    attendance_state_updated_at: source.attendance_state_updated_at,
    last_result_at: source.last_result_at,
    last_no_new_fact_at: source.last_no_new_fact_at,
    no_response_status: source.no_response_status,
    is_lead_or_quote: source.is_lead_or_quote ?? (stage
      ? ['novo_lead', 'contato_realizado', 'proposta_enviada', 'negociacao'].includes(stage)
      : false),
  };
}

export function projectCrmOperationalState(source: CrmOperationalSource, now = new Date()): CrmOperationalProjection {
  if (!source.contactId) throw new Error('Projeção CRM requer contactId');
  const canonicalResult = getCanonicalResult(source.last_result_code);
  const taskTitle = source.next_action_title?.trim() || null;
  const contactTitle = source.next_action_text?.trim() || null;
  const obligation = source.official_task_present || taskTitle
    ? { title: taskTitle ?? contactTitle, dueAt: source.next_action_date ?? null, source: 'official_task' as const }
    : contactTitle || source.next_action_date
      ? { title: contactTitle, dueAt: source.next_action_date ?? null, source: 'contact' as const }
      : null;
  return {
    contactId: source.contactId,
    conversationId: source.conversationId || null,
    priority: getCrmPriority(toCrmOperationalPriorityInput(source), now),
    lastResultCode: canonicalResult?.code ?? null,
    resultResponsibility: canonicalResult ? getCrmOperationalResponsibility(canonicalResult.code) : null,
    obligation,
    handoffRequired: typeof source.handoff_required === 'boolean' ? source.handoff_required : null,
    handoffVerified: false,
  };
}
