import { buildWhatsAppUrl } from '@/lib/whatsapp';

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
 * Alias operacional do CRM. A identidade/normalização do telefone permanece
 * sob a fonte canônica compartilhada em `@/lib/whatsapp`.
 */
export function getWhatsAppContactUrl(handle: string | null | undefined): string | null {
  return buildWhatsAppUrl(handle);
}
