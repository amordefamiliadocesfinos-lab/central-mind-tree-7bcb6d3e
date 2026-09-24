export const INSTAGRAM_CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * A V1 suporta somente a janela padrão de atendimento do Instagram. O
 * servidor usa esta verificação como autoridade antes de chamar a Send API.
 */
export function isInstagramCustomerServiceWindowOpen(
  lastInboundAt: string | null | undefined,
  now = Date.now(),
) {
  if (!lastInboundAt) return false;
  const inboundAt = Date.parse(lastInboundAt);
  if (!Number.isFinite(inboundAt)) return false;
  const elapsed = now - inboundAt;
  return elapsed >= 0 && elapsed <= INSTAGRAM_CUSTOMER_SERVICE_WINDOW_MS;
}
