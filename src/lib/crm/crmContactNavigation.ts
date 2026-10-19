/**
 * CRM–UX E-02 — intenção explícita de atendimento versus consulta cadastral.
 *
 * Um contato no query string, sozinho, nunca autoriza writers da Inbox.
 * A mesma marcação de atendimento é usada pelos botões oficiais da Gestão.
 */
export function isExplicitCrmAttendanceLink(params: URLSearchParams): boolean {
  return Boolean(params.get('contact')?.trim()) && params.get('attend') === '1';
}

export function getCrmContactConsultationUrl(contactId: string): string {
  const params = new URLSearchParams({ contact: contactId });
  return `/contatos?${params.toString()}`;
}

export function getCrmContactAttendanceUrl(contactId: string): string {
  const params = new URLSearchParams({ contact: contactId, attend: '1' });
  return `/contatos/inbox?${params.toString()}`;
}
