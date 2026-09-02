import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

const CRM_ROOT_NODE_ID = 'd7c76db8-b7e0-4ce1-87ca-21275c346326';
export const CRM_TASK_SOURCE = 'crm_next_action';

export interface CrmNextAction {
  title: string | null | undefined;
  dueAt: string | null | undefined;
}

export interface SetCrmNextActionInput {
  contactId: string;
  title: string;
  dueAt: string;
  /** Use somente quando a ação é um retorno operacional desta conversa. */
  conversationId?: string | null;
  syncConversationReturn?: boolean;
}

async function syncMatchingConversationReturn(input: {
  contactId: string;
  previousDueAt?: string | null;
  nextDueAt: string | null;
  conversationId?: string | null;
}) {
  const payload = input.nextDueAt
    ? { return_at: input.nextDueAt }
    : { return_at: null, attendance_state: 'aguardando_cliente' };

  if (input.conversationId) {
    const { error } = await supabase.from('service_conversations')
      .update(payload)
      .eq('id', input.conversationId)
      .eq('contact_id', input.contactId);
    if (error) throw error;
    return;
  }

  // A página de tarefas conhece o contato, mas não necessariamente a conversa.
  // Só sincronizamos retornos que representam exatamente a ação canônica anterior.
  if (!input.previousDueAt) return;
  const { error } = await supabase.from('service_conversations')
    .update(payload)
    .eq('contact_id', input.contactId)
    .eq('return_at', input.previousDueAt)
    .in('attendance_state', ['retornar_em', 'aguardando_cliente']);
  if (error) throw error;
}

function requireValidAction(action: CrmNextAction) {
  const title = action.title?.trim();
  if (!title || !action.dueAt) throw new Error('Próxima ação e data são obrigatórias');
  const due = new Date(action.dueAt);
  if (Number.isNaN(due.getTime())) throw new Error('Data inválida para a próxima ação do CRM');
  return { title, dueAt: action.dueAt, due };
}

/** Mantém no máximo uma tarefa oficial pendente por contato. */
export async function syncCrmNextActionTask(contactId: string, action: CrmNextAction) {
  const { data: pending, error: findError } = await supabase
    .from('tasks')
    .select('id')
    .eq('contact_id', contactId)
    .eq('source', CRM_TASK_SOURCE)
    .is('deleted_at', null)
    .neq('status', 'concluído')
    .order('created_at', { ascending: false });
  if (findError) throw findError;

  const [existing, ...duplicates] = pending || [];
  if (duplicates.length > 0) {
    const { error } = await supabase.from('tasks')
      .update({ status: 'concluído', updated_at: new Date().toISOString() })
      .in('id', duplicates.map(task => task.id));
    if (error) throw error;
  }

  if (!action.title || !action.dueAt) {
    if (existing?.id) {
      const { error } = await supabase.from('tasks')
        .update({ status: 'concluído', updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw error;
    }
    return;
  }

  const { title, dueAt, due } = requireValidAction(action);
  const payload = {
    title,
    contact_id: contactId,
    node_id: CRM_ROOT_NODE_ID,
    source: CRM_TASK_SOURCE,
    status: 'pendente',
    scheduled_date: format(due, 'yyyy-MM-dd'),
    due_date: format(due, 'yyyy-MM-dd'),
    scheduled_time: format(due, 'HH:mm'),
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await supabase.from('tasks').update(payload).eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('tasks').insert(payload);
  if (error) throw error;
}

/** Define a intenção comercial canônica e sua representação executável. */
export async function setCrmNextAction(input: SetCrmNextActionInput) {
  const { title, dueAt } = requireValidAction(input);
  const { data: currentContact, error: currentContactError } = await supabase.from('contacts')
    .select('next_action_text, next_action_date, next_contact_date')
    .eq('id', input.contactId)
    .maybeSingle();
  if (currentContactError) throw currentContactError;
  const previousDueAt = currentContact?.next_action_date ?? currentContact?.next_contact_date ?? null;
  const previousTitle = currentContact?.next_action_text ?? null;
  const { error: contactError } = await supabase.from('contacts').update({
    next_action_text: title,
    next_action_date: dueAt,
    // Compatibilidade temporária com os filtros e cartões legados.
    next_contact_date: dueAt,
    updated_at: new Date().toISOString(),
  }).eq('id', input.contactId);
  if (contactError) throw contactError;

  await syncCrmNextActionTask(input.contactId, { title, dueAt });

  // A substituição já é segura pela tarefa única; o histórico torna o
  // reagendamento explicável sem criar uma segunda obrigação pendente.
  if (previousDueAt && (previousDueAt !== dueAt || previousTitle !== title)) {
    const { error: historyError } = await supabase.from('contact_history').insert({
      contact_id: input.contactId,
      event_type: 'follow_up',
      interaction_type: 'sistema',
      description: `Próxima ação substituída: ${previousTitle || 'Sem título'} → ${title}`,
      interaction_date: new Date().toISOString(),
      event_metadata: {
        source: CRM_TASK_SOURCE,
        previous_title: previousTitle,
        previous_due_at: previousDueAt,
        next_title: title,
        next_due_at: dueAt,
      },
    });
    if (historyError) throw historyError;
  }

  if (input.syncConversationReturn || previousDueAt) {
    await syncMatchingConversationReturn({
      contactId: input.contactId,
      previousDueAt,
      nextDueAt: dueAt,
      conversationId: input.syncConversationReturn ? input.conversationId : null,
    });
  }
}

/** Limpa apenas a próxima ação oficial; histórico e tarefas manuais permanecem. */
export async function clearCrmNextAction(contactId: string, conversationId?: string | null) {
  const { data: currentContact, error: currentContactError } = await supabase.from('contacts')
    .select('next_action_date, next_contact_date')
    .eq('id', contactId)
    .maybeSingle();
  if (currentContactError) throw currentContactError;
  const previousDueAt = currentContact?.next_action_date ?? currentContact?.next_contact_date ?? null;
  const { error: contactError } = await supabase.from('contacts').update({
    next_action_text: null,
    next_action_date: null,
    next_contact_date: null,
    updated_at: new Date().toISOString(),
  }).eq('id', contactId);
  if (contactError) throw contactError;
  await syncCrmNextActionTask(contactId, { title: null, dueAt: null });
  await syncMatchingConversationReturn({
    contactId,
    previousDueAt,
    nextDueAt: null,
    conversationId,
  });
}

/** A conclusão da tarefa oficial encerra também a intenção que ela representa. */
export async function completeCrmNextAction(contactId: string) {
  await clearCrmNextAction(contactId);
}
