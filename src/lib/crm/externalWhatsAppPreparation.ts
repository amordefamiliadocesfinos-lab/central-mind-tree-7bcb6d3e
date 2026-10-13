/**
 * F0-A: abrir o WhatsApp externo é apenas preparar a mensagem, não enviá-la.
 * A confirmação real de envio permanece no aplicativo externo ou no
 * transporte oficial com recibo verificável. Nenhuma escrita CRM aqui.
 */
export type ExternalWhatsAppPreparation = 'opened_unconfirmed' | 'blocked';

export function prepareExternalWhatsAppDraft(
  phone: string,
  message: string,
  open: (phone: string, message: string) => boolean,
): ExternalWhatsAppPreparation {
  return open(phone, message) ? 'opened_unconfirmed' : 'blocked';
}
