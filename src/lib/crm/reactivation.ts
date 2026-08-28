import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

const CRM_ROOT_NODE_ID = 'd7c76db8-b7e0-4ce1-87ca-21275c346326';
export const CRM_REACTIVATION_SOURCE = 'crm_reactivation';

export interface CrmReactivation {
  title?: string | null;
  dueAt?: string | null;
}

function requireValidReactivation(input: CrmReactivation) {
  const title = input.title?.trim() || 'Reativação comercial';
  if (!input.dueAt) throw new Error('Defina a data de reativação');
  const due = new Date(input.dueAt);
  if (Number.isNaN(due.getTime())) throw new Error('Data inválida para reativação');
  return { title, due, dueAt: input.dueAt };
}

/** Mantém uma única oportunidade futura de recompra por contato. */
export async function syncCrmReactivationTask(contactId: string, input: CrmReactivation) {
  const { data: pending, error: findError } = await supabase
    .from('tasks')
    .select('id')
    .eq('contact_id', contactId)
    .eq('source', CRM_REACTIVATION_SOURCE)
    .is('deleted_at', null)
    .neq('status', 'concluído')
    .order('created_at', { ascending: false });
  if (findError) throw findError;

  const [existing, ...duplicates] = pending || [];
  if (duplicates.length) {
    const { error } = await supabase.from('tasks')
      .update({ status: 'concluído', updated_at: new Date().toISOString() })
      .in('id', duplicates.map((task) => task.id));
    if (error) throw error;
  }

  if (!input.dueAt) {
    if (existing?.id) {
      const { error } = await supabase.from('tasks')
        .update({ status: 'concluído', updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw error;
    }
    return;
  }

  const { title, due, dueAt } = requireValidReactivation(input);
  const payload = {
    title,
    contact_id: contactId,
    node_id: CRM_ROOT_NODE_ID,
    source: CRM_REACTIVATION_SOURCE,
    status: 'pendente',
    scheduled_date: format(due, 'yyyy-MM-dd'),
    due_date: format(due, 'yyyy-MM-dd'),
    scheduled_time: format(due, 'HH:mm'),
    updated_at: new Date().toISOString(),
  };
  const { error } = existing?.id
    ? await supabase.from('tasks').update(payload).eq('id', existing.id)
    : await supabase.from('tasks').insert(payload);
  if (error) throw error;

  // Registro leve no histórico, sem mudar etapa, conversa ou próxima ação.
  await supabase.from('contact_history').insert({
    contact_id: contactId,
    event_type: 'reactivation',
    interaction_type: 'sistema',
    description: `Reativação comercial programada: ${title}`,
    interaction_date: new Date().toISOString(),
    event_metadata: { source: CRM_REACTIVATION_SOURCE, due_at: dueAt },
  });
}

export async function setCrmReactivation(contactId: string, input: CrmReactivation) {
  await syncCrmReactivationTask(contactId, input);
}

/** Cancela somente a oportunidade de recompra, sem tocar no atendimento atual. */
export async function clearCrmReactivation(contactId: string) {
  await syncCrmReactivationTask(contactId, { dueAt: null });
}

/** Um novo contato feito depois do vencimento consome a oportunidade planejada. */
export async function completeCrmReactivationIfDue(contactId: string, now = new Date()) {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, scheduled_date, scheduled_time, due_date')
    .eq('contact_id', contactId)
    .eq('source', CRM_REACTIVATION_SOURCE)
    .is('deleted_at', null)
    .neq('status', 'concluído')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return false;

  const date = data.scheduled_date || data.due_date;
  if (!date) return false;
  const dueAt = new Date(`${date}T${data.scheduled_time || '09:00'}:00`);
  if (Number.isNaN(dueAt.getTime()) || dueAt > now) return false;

  const { error: updateError } = await supabase.from('tasks')
    .update({ status: 'concluído', updated_at: now.toISOString() })
    .eq('id', data.id);
  if (updateError) throw updateError;
  return true;
}
