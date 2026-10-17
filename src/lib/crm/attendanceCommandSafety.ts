/**
 * CRM–UX D-01 — segurança das gravações operacionais no cabeçalho.
 * Um UPDATE sem erro pode atingir zero linhas (RLS, registro removido,
 * conversa não criada). Só confirmar sucesso quando o ID efetivamente
 * atualizado retornar da escrita.
 */
export function isConfirmedAttendanceMutation(
  result: { id: string } | null | undefined,
  expectedConversationId: string | null | undefined,
): boolean {
  return Boolean(expectedConversationId && result?.id === expectedConversationId);
}

/** Trava síncrona: previne dois cliques antes do primeiro setState renderizar. */
export interface AttendanceWriteGate {
  acquire(): boolean;
  release(): void;
  locked(): boolean;
}
export function createAttendanceWriteGate(): AttendanceWriteGate {
  let active = false;
  return {
    acquire() {
      if (active) return false;
      active = true;
      return true;
    },
    release() { active = false; },
    locked() { return active; },
  };
}
