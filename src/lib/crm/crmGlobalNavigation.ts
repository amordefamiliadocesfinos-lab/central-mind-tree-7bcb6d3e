/**
 * CRM–UX E-01 — entrada global: Inbox é o destino operacional do CRM.
 * A Gestão e as Tarefas permanecem rotas próprias. Somente o item global
 * CRM usa correspondência de seção; demais módulos usam rota exata.
 */
export const CRM_GLOBAL_ENTRY_PATH = '/contatos/inbox' as const;
export const CRM_SECTION_PATHS = ['/contatos', '/contatos/inbox', '/contatos/tarefas'] as const;

export function isGlobalNavigationItemActive(pathname: string, itemPath: string): boolean {
  return itemPath === CRM_GLOBAL_ENTRY_PATH
    ? (CRM_SECTION_PATHS as readonly string[]).includes(pathname)
    : pathname === itemPath;
}

export interface CrmInboxRouteProtection {
  editingProfile: boolean;
  pendingChatDraftOrSend: boolean;
  attendanceWriting: boolean;
  actionFormOpen: boolean;
  saleFlowOpen: boolean;
}

/** Impede saída por links de qualquer módulo com um atendimento incompleto. */
export function getCrmInboxNavigationBlockReason(state: CrmInboxRouteProtection): string | null {
  if (state.editingProfile) return 'Finalize ou cancele a edição da ficha antes de mudar de página.';
  if (state.pendingChatDraftOrSend) return 'Envie ou descarte o rascunho e aguarde eventual envio antes de mudar de página.';
  if (state.attendanceWriting) return 'Aguarde a gravação do atendimento antes de mudar de página.';
  if (state.actionFormOpen) return 'Conclua ou cancele Registrar Resultado/Adiar antes de mudar de página.';
  if (state.saleFlowOpen) return 'Conclua ou cancele a confirmação comercial antes de mudar de página.';
  return null;
}

/** E-03.2: bloqueia troca com pendência; preserva avanço automático pós-commit. */
export function getCrmInboxContactSwitchBlockReason(
  state: CrmInboxRouteProtection,
  currentContactId: string | null,
  targetContactId: string | null,
  fromConfirmedOperation = false,
): string | null {
  if (currentContactId === targetContactId || fromConfirmedOperation) return null;
  return getCrmInboxNavigationBlockReason(state);
}
