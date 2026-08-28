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
