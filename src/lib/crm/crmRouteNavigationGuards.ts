/**
 * E-03.3: registry efêmero de pendências visuais, sem writes comerciais.
 * Lidas por navegação programática e pelo evento browser "navigate" quando suportado.
 */
export type CrmRouteGuard = () => string | null;

const activeGuards = new Map<symbol, CrmRouteGuard>();

export function registerCrmRouteGuard(guard: CrmRouteGuard): () => void {
  const token = Symbol('crm-route-guard');
  activeGuards.set(token, guard);
  return () => { activeGuards.delete(token); };
}

export function getCrmRouteBlockReason(): string | null {
  // Pendências de overlays mais recentes prevalecem sobre as anteriores.
  for (const guard of Array.from(activeGuards.values()).reverse()) {
    const reason = guard();
    if (reason) return reason;
  }
  return null;
}
