/** E-03.4: somente estado de formulário; sem alteração de regra CRM. */
export type CrmTaskDraft = { title: string; date: string; time: string };
export function isCrmTaskDraftModified(original: CrmTaskDraft, current: CrmTaskDraft): boolean {
  return original.title !== current.title || original.date !== current.date || original.time !== current.time;
}

export function getCrmFormExitReason(
  form: 'contact' | 'task',
  dirty: boolean,
  saving: boolean,
): string | null {
  if (saving) return form === 'contact'
    ? 'Aguarde a gravação do contato antes de mudar de página.'
    : 'Aguarde a gravação do reagendamento antes de mudar de página.';
  if (!dirty) return null;
  return form === 'contact'
    ? 'Salve ou cancele as alterações do contato antes de mudar de página.'
    : 'Salve ou cancele as alterações do reagendamento antes de mudar de página.';
}
