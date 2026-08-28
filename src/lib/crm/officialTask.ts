/**
 * A Próxima Ação só é operacional quando contato e tarefa oficial descrevem
 * o mesmo compromisso. Datas/tarefas legadas permanecem no histórico, mas não
 * podem reabrir a fila por conta própria.
 */
export function getOfficialCrmNextActionAt(
  contactNextActionDate?: string | null,
  taskDueAt?: string | null,
) {
  if (!contactNextActionDate || !taskDueAt) return null;
  const contactAt = new Date(contactNextActionDate).getTime();
  const taskAt = new Date(taskDueAt).getTime();
  if (Number.isNaN(contactAt) || Number.isNaN(taskAt)) return null;
  // A tarefa guarda precisão de minuto; o contato pode trazer segundos.
  return Math.abs(contactAt - taskAt) < 60_000 ? taskDueAt : null;
}
