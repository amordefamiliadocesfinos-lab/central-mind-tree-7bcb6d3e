/**
 * CRM–UX D-03 — explicações de consequências dos comandos do cabeçalho.
 *
 * A decisão comercial continua com o operador. Estes avisos não
 * alteram elegibilidade, prioridade, estado ou persistência do CRM.
 */
export interface AttendanceCompletionContext {
  pendingResult: boolean;
  officialTaskPresent: boolean;
  operationalReturnScheduled: boolean;
}
export interface AttendanceArchiveContext {
  officialTaskPresent: boolean;
}
export function getConcludeAttendanceWarning(context: AttendanceCompletionContext): string | null {
  const warnings: string[] = [];
  if (context.pendingResult) warnings.push('Existe um Resultado comercial pendente de registro.');
  if (context.officialTaskPresent) warnings.push('Há uma tarefa ou Próxima Ação oficial que continuará pendente.');
  if (context.operationalReturnScheduled) warnings.push('O retorno operacional programado não será removido por Concluir.');
  return warnings.length
    ? warnings.join(' ') + ' Concluir encerra somente esta conversa; não registra Resultado nem conclui tarefas automaticamente.'
    : null;
}
export function getArchiveAttendanceWarning(context: AttendanceArchiveContext): string {
  return 'Ela será encerrada e o retorno operacional será removido. O contato, o histórico e as demais obrigações serão preservados.'
    + (context.officialTaskPresent
      ? ' Existe uma obrigação oficial pendente, que não será concluída por Arquivar.'
      : '');
}
