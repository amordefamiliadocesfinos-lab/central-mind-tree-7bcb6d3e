/**
 * A origem `crm_next_action` identifica a obrigação oficial atual. Os campos
 * do contato são sincronizados por compatibilidade, mas uma divergência antiga
 * entre eles não pode fazer uma tarefa oficial futura cair em "Fila normal".
 * Tarefas legadas continuam excluídas pelo filtro de source da Inbox.
 */
export function getOfficialCrmNextActionAt(
  taskDueAt?: string | null,
) {
  if (!taskDueAt) return null;
  const taskAt = new Date(taskDueAt).getTime();
  return Number.isNaN(taskAt) ? null : taskDueAt;
}

/**
 * Normaliza a representação de horário do PostgreSQL antes de compor a data.
 * A API pode devolver `09:00` ou `09:00:00`; acrescentar segundos aos dois
 * formatos gerava uma data inválida e fazia a Inbox ignorar a obrigação.
 */
export function getOfficialCrmTaskDueAt(
  scheduledDate?: string | null,
  scheduledTime?: string | null,
) {
  if (!scheduledDate) return null;
  const suppliedTime = scheduledTime?.trim();
  const match = suppliedTime?.match(/^(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (suppliedTime && !match) return null;

  const dueAt = new Date(`${scheduledDate}T${match?.[1] ?? '09:00'}:00`);
  return Number.isNaN(dueAt.getTime()) ? null : dueAt.toISOString();
}
