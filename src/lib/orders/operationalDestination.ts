export const OPERATIONAL_DESTINATIONS = [
  'retirada_fabrica',
  'transportadora',
  'entrega_propria',
  'uber_entrega',
  'correios',
  'marketplace_logistica',
  'academia_ponto_logistico',
  'outro',
] as const;

export type OperationalDestination = (typeof OPERATIONAL_DESTINATIONS)[number];

export const OPERATIONAL_DESTINATION_LABELS: Record<OperationalDestination, string> = {
  retirada_fabrica: 'RETIRADA NA FÁBRICA',
  transportadora: 'TRANSPORTADORA',
  entrega_propria: 'ENTREGA PRÓPRIA',
  uber_entrega: 'UBER / ENTREGA RÁPIDA',
  correios: 'CORREIOS',
  marketplace_logistica: 'LOGÍSTICA DO MARKETPLACE',
  academia_ponto_logistico: 'ACADEMIA / PONTO LOGÍSTICO',
  outro: 'OUTRO',
};

export function getOperationalDestinationLabel(destination: OperationalDestination | null | undefined) {
  return destination ? OPERATIONAL_DESTINATION_LABELS[destination] : null;
}

export function isOperationalDestination(value: unknown): value is OperationalDestination {
  return typeof value === 'string' && OPERATIONAL_DESTINATIONS.includes(value as OperationalDestination);
}
