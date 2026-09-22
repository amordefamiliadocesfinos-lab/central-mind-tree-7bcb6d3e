export const META_CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Janela operacional da Meta para mensagem livre. O servidor continua sendo a
 * autoridade final; esta função existe para a UX antecipar uma tentativa que
 * já sabemos que será recusada.
 */
export function isMetaCustomerServiceWindowOpen(
  lastInboundAt: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!lastInboundAt) return false;
  const inboundAt = Date.parse(lastInboundAt);
  if (!Number.isFinite(inboundAt)) return false;
  const elapsed = now - inboundAt;
  return elapsed >= 0 && elapsed <= META_CUSTOMER_SERVICE_WINDOW_MS;
}

/**
 * Fallback operacional para desktop/celular sem pesquisa manual de telefone.
 * O CRM continua sendo o cockpit; o WhatsApp externo é aberto somente quando
 * o operador realmente precisa do canal original.
 */
export function getWhatsAppContactUrl(handle: string | null | undefined): string | null {
  const digits = String(handle ?? '').replace(/\D/g, '');
  if (!digits) return null;
  // Número nacional brasileiro possui 10 ou 11 dígitos. Isso evita confundir
  // um telefone do DDD 55 com um número que já contém o DDI +55.
  const normalized = digits.length === 10 || digits.length === 11
    ? `55${digits}`
    : digits;
  return `https://wa.me/${normalized}`;
}
