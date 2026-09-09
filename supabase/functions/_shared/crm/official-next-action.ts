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
const FOLLOW_UP_LIMIT = 3;
const FOLLOW_UP_ATTEMPT_KIND = 'follow_up_attempt';
const FOLLOW_UP_RESET_EVENTS = new Set([
  'customer_replied',
  'sale_won',
  'sale_lost',
  'post_sale_completed',
  'reactivation_completed',
  'lead_created',
]);

type FollowUpHistoryRow = {
  event_code?: string | null;
  event_metadata?: unknown;
  interaction_date?: string | null;
  created_at?: string | null;
};

function historyAt(row: FollowUpHistoryRow): string | null {
  return row.interaction_date ?? row.created_at ?? null;
}

function isFollowUpAttempt(row: FollowUpHistoryRow): boolean {
  const metadata = row.event_metadata;
  return Boolean(metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    && (metadata as Record<string, unknown>).kind === FOLLOW_UP_ATTEMPT_KIND);
}

/**
 * Writer server-side não pode depender do estado visual da Inbox. Esta leitura
 * espelha o contrato do ciclo: só tentativas explícitas contam; inbound/venda
 * e demais fatos canônicos iniciam um novo ciclo.
 */
export async function canCreateAutomaticFollowUpObligation(
  supabase: any,
  contactId: string,
  lastInboundAt?: string | null,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('contact_history')
    .select('event_code, event_metadata, interaction_date, created_at')
    .eq('contact_id', contactId)
    .order('interaction_date', { ascending: false })
    .limit(200);
  if (error) throw error;

  const rows = ((data ?? []) as FollowUpHistoryRow[])
    .map((row) => ({ row, at: historyAt(row) }))
    .filter((item): item is { row: FollowUpHistoryRow; at: string } => Boolean(item.at))
    .sort((a, b) => a.at.localeCompare(b.at));

  let boundary = lastInboundAt ?? null;
  for (const { row, at } of rows) {
    if (row.event_code && FOLLOW_UP_RESET_EVENTS.has(row.event_code) && (!boundary || at > boundary)) {
      boundary = at;
    }
  }
  const attempts = rows.filter(({ row, at }) => isFollowUpAttempt(row) && (!boundary || at > boundary));
  return attempts.length < FOLLOW_UP_LIMIT;
}

/** Consome a obrigação oficial atual sem criar substituta. */
export async function clearOfficialCrmNextAction(
  supabase: any,
  input: { contactId: string; conversationId?: string | null },
) {
  const now = new Date().toISOString();
  const { error: contactError } = await supabase.from('contacts').update({
    next_action_text: null,
    next_action_date: null,
    next_contact_date: null,
    updated_at: now,
  }).eq('id', input.contactId);
  if (contactError) throw contactError;

  const { error: taskError } = await supabase.from('tasks')
    .update({ status: 'concluído', updated_at: now })
    .eq('contact_id', input.contactId)
    .eq('source', CRM_TASK_SOURCE)
    .is('deleted_at', null)
    .neq('status', 'concluído');
  if (taskError) throw taskError;

  if (input.conversationId) {
    const { error: conversationError } = await supabase.from('service_conversations')
      .update({ return_at: null, attendance_state: 'aguardando_cliente' })
      .eq('id', input.conversationId)
      .eq('contact_id', input.contactId);
    if (conversationError) throw conversationError;
  }
}

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
