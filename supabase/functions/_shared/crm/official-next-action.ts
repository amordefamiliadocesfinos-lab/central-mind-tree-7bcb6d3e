/**
 * Writer server-side da Próxima Ação oficial.
 *
 * Espelha o contrato de `src/lib/crm/nextAction.ts`: campos canônicos no
 * contato, uma única tarefa `crm_next_action` pendente e retorno vinculado à
 * conversa. Edge Functions não podem importar o alias do frontend, por isso
 * esta é a implementação equivalente para writers do servidor.
 */
const CRM_ROOT_NODE_ID = 'd7c76db8-b7e0-4ce1-87ca-21275c346326';
const CRM_TASK_SOURCE = 'crm_next_action';

export async function setOfficialCrmNextAction(
  supabase: any,
  input: { contactId: string; title: string; dueAt: string; conversationId?: string | null; taskTime?: string },
) {
  const title = input.title.trim();
  const dueAt = input.dueAt;
  const due = new Date(dueAt);
  if (!title || Number.isNaN(due.getTime())) throw new Error('Próxima ação oficial inválida');

  const now = new Date().toISOString();
  const { data: currentContact, error: contactReadError } = await supabase
    .from('contacts')
    .select('next_action_text, next_action_date, next_contact_date')
    .eq('id', input.contactId)
    .maybeSingle();
  if (contactReadError) throw contactReadError;

  const previousTitle = currentContact?.next_action_text ?? null;
  const previousDueAt = currentContact?.next_action_date ?? currentContact?.next_contact_date ?? null;
  const { error: contactError } = await supabase.from('contacts').update({
    next_action_text: title,
    next_action_date: dueAt,
    // Compatibilidade temporária com consumidores legados.
    next_contact_date: dueAt,
    updated_at: now,
  }).eq('id', input.contactId);
  if (contactError) throw contactError;

  const { data: pending, error: pendingError } = await supabase
    .from('tasks')
    .select('id')
    .eq('contact_id', input.contactId)
    .eq('source', CRM_TASK_SOURCE)
    .is('deleted_at', null)
    .neq('status', 'concluído')
    .order('created_at', { ascending: false });
  if (pendingError) throw pendingError;

  const [existing, ...duplicates] = pending || [];
  if (duplicates.length) {
    const { error } = await supabase.from('tasks')
      .update({ status: 'concluído', updated_at: now })
      .in('id', duplicates.map((task: { id: string }) => task.id));
    if (error) throw error;
  }

  const taskPayload = {
    title,
    contact_id: input.contactId,
    node_id: CRM_ROOT_NODE_ID,
    source: CRM_TASK_SOURCE,
    status: 'pendente',
    scheduled_date: dueAt.slice(0, 10),
    due_date: dueAt.slice(0, 10),
    // O writer de origem pode fornecer o horário operacional já normalizado
    // para São Paulo; sem ele, preservamos o horário informado no ISO.
    scheduled_time: input.taskTime ?? dueAt.slice(11, 19),
    updated_at: now,
  };
  const { error: taskError } = existing?.id
    ? await supabase.from('tasks').update(taskPayload).eq('id', existing.id)
    : await supabase.from('tasks').insert(taskPayload);
  if (taskError) throw taskError;

  if (input.conversationId) {
    const { error } = await supabase.from('service_conversations').update({ return_at: dueAt })
      .eq('id', input.conversationId)
      .eq('contact_id', input.contactId);
    if (error) throw error;
  }

  const replaced = Boolean(previousDueAt) && (previousDueAt !== dueAt || previousTitle !== title);
  if (replaced) {
    const { error } = await supabase.from('contact_history').insert({
      contact_id: input.contactId,
      event_type: 'follow_up',
      interaction_type: 'sistema',
      description: `Próxima ação substituída: ${previousTitle || 'Sem título'} → ${title}`,
      interaction_date: now,
      event_metadata: {
        source: CRM_TASK_SOURCE,
        previous_title: previousTitle,
        previous_due_at: previousDueAt,
        next_title: title,
        next_due_at: dueAt,
      },
    });
    if (error) throw error;
  }
}
