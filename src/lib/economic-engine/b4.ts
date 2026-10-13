import type { EconomicComponent } from './domain';

export const B4_LOGISTICS_MODES = [
  'retirada_fabrica',
  'entrega_propria',
  'uber_entrega',
  'transportadora',
  'correios',
  'marketplace_logistica',
  'academia_ponto_logistico',
  'outro',
] as const;

export type B4LogisticsMode = typeof B4_LOGISTICS_MODES[number];

export const B4_LOGISTICS_MODE_LABELS: Record<B4LogisticsMode, string> = {
  retirada_fabrica: 'Retirada pelo cliente / fábrica',
  entrega_propria: 'Entrega própria',
  uber_entrega: 'Uber / terceiro local',
  transportadora: 'Transportadora',
  correios: 'Correios',
  marketplace_logistica: 'Logística do marketplace',
  academia_ponto_logistico: 'Ponto logístico / distribuição',
  outro: 'Outra modalidade',
};

export type B4CostSource =
  | 'financial_entry'
  | 'manual_simulation'
  | 'operational_estimate'
  | 'zero_confirmed'
  | 'missing';

export type BuildB4Input = {
  mode: B4LogisticsMode | null;
  logisticsCost: number | null;
  source: B4CostSource;
  sourceId?: string | null;
  sourceEntity?: string | null;
  observedAt?: string | null;
  isPaid?: boolean;
  isConciliated?: boolean;
  orderId?: string | null;
  routeId?: string | null;

  customerFreightPaid?: number | null;
  channelFreightSubsidy?: number | null;

  notes?: string | null;
};

export type B4FundingSummary = {
  logisticsCost: number | null;
  customerFreightPaid: number | null;
  channelFreightSubsidy: number | null;
  sellerAbsorptionKnown: number | null;
};

const nonNegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function calculateB4FundingSummary(input: BuildB4Input): B4FundingSummary {
  const logisticsCost = nonNegative(input.logisticsCost) ? input.logisticsCost : null;
  const customerFreightPaid = nonNegative(input.customerFreightPaid) ? input.customerFreightPaid : null;
  const channelFreightSubsidy = nonNegative(input.channelFreightSubsidy) ? input.channelFreightSubsidy : null;

  const sellerAbsorptionKnown =
    logisticsCost !== null &&
    customerFreightPaid !== null &&
    channelFreightSubsidy !== null
      ? Math.max(0, logisticsCost - customerFreightPaid - channelFreightSubsidy)
      : null;

  return {
    logisticsCost,
    customerFreightPaid,
    channelFreightSubsidy,
    sellerAbsorptionKnown,
  };
}

export function buildB4Components(input: BuildB4Input): EconomicComponent[] {
  const mode = input.mode;

  if (!mode) {
    return [{
      id: 'b4:mode:pending',
      economicKey: 'b4:mode:pending',
      block: 'B4',
      subcategory: 'B4.P',
      itemName: 'Modalidade logística',
      amount: null,
      currency: 'BRL',
      unit: 'pedido',
      effect: 'COST',
      numericNature: 'FUTURE_UNDEFINED',
      costState: 'APPLICABLE_VALUE_PENDING',
      knowledgeState: 'UNKNOWN',
      incidence: 'I-P',
      sourceDomain: 'Operações/Logística',
      notes: 'Modalidade logística ainda não definida.',
    }];
  }

  if (mode === 'retirada_fabrica' && (!nonNegative(input.logisticsCost) || input.logisticsCost === 0)) {
    return [{
      id: 'b4:pickup:' + (input.orderId ?? 'scenario'),
      economicKey: 'b4:pickup:' + (input.orderId ?? 'scenario'),
      block: 'B4',
      subcategory: 'B4.1',
      itemCode: mode,
      itemName: B4_LOGISTICS_MODE_LABELS[mode],
      amount: 0,
      currency: 'BRL',
      unit: 'pedido',
      effect: 'COST',
      numericNature: input.source === 'financial_entry' ? 'PROVEN' : 'HOMOLOGATED',
      costState: 'PROVEN_ZERO',
      knowledgeState: 'KNOWN',
      incidence: 'I-P',
      sourceDomain: 'Operações/Logística',
      sourceEntity: input.sourceEntity ?? 'orders',
      sourceId: input.sourceId ?? input.orderId ?? null,
      observedAt: input.observedAt ?? null,
      notes: input.notes ?? 'Retirada sem deslocamento/custo logístico da empresa.',
    }];
  }

  if (!nonNegative(input.logisticsCost) || input.source === 'missing') {
    const methodologyPending = mode === 'entrega_propria';
    return [{
      id: 'b4:pending:' + mode + ':' + (input.orderId ?? 'scenario'),
      economicKey: 'b4:pending:' + mode + ':' + (input.orderId ?? 'scenario'),
      block: 'B4',
      subcategory: methodologyPending ? 'B4.2' : 'B4.P',
      itemCode: mode,
      itemName: B4_LOGISTICS_MODE_LABELS[mode],
      amount: null,
      currency: 'BRL',
      unit: 'pedido',
      effect: 'COST',
      numericNature: 'FUTURE_UNDEFINED',
      costState: methodologyPending ? 'METHODOLOGY_PENDING' : 'APPLICABLE_VALUE_PENDING',
      knowledgeState: 'UNKNOWN',
      incidence: mode === 'entrega_propria' ? 'I-R' : 'I-P',
      sourceDomain: 'Operações/Logística',
      sourceEntity: input.sourceEntity ?? 'orders',
      sourceId: input.sourceId ?? input.orderId ?? null,
      notes:
        input.notes ??
        (methodologyPending
          ? 'Entrega própria sem metodologia homologada de custo/rateio da rota.'
          : 'Modalidade logística aplicável sem custo econômico resolvido.'),
    }];
  }

  const nature =
    input.source === 'financial_entry'
      ? input.isConciliated || input.isPaid
        ? 'PROVEN'
        : 'OBSERVED_CURRENT'
      : input.source === 'manual_simulation'
        ? 'SIMULATED'
        : 'ESTIMATED';

  return [{
    id: 'b4:cost:' + mode + ':' + (input.sourceId ?? input.orderId ?? 'scenario'),
    economicKey: 'b4:cost:' + mode + ':' + (input.sourceId ?? input.orderId ?? 'scenario'),
    block: 'B4',
    subcategory:
      mode === 'entrega_propria' ? 'B4.2'
        : mode === 'uber_entrega' ? 'B4.3'
          : mode === 'transportadora' || mode === 'correios' ? 'B4.4'
            : mode === 'marketplace_logistica' ? 'B4.5'
              : 'B4.99',
    itemCode: mode,
    itemName: B4_LOGISTICS_MODE_LABELS[mode],
    amount: input.logisticsCost,
    currency: 'BRL',
    unit: 'pedido',
    effect: 'COST',
    numericNature: nature,
    costState: 'APPLICABLE_WITH_VALUE',
    knowledgeState: 'KNOWN',
    incidence: mode === 'entrega_propria' ? 'I-R' : 'I-P',
    nativeGrain: mode === 'entrega_propria' ? 'rota/pedido' : 'pedido',
    driver: mode === 'entrega_propria' ? 'route_or_order_cost' : 'logistics_cost',
    quantity: 1,
    scope: input.orderId ? 'order:' + input.orderId : 'scenario',
    applicability: B4_LOGISTICS_MODE_LABELS[mode],
    sourceDomain: input.source === 'financial_entry' ? 'Financeiro + Operações/Logística' : 'Operações/Logística',
    sourceEntity: input.sourceEntity ?? (input.source === 'financial_entry' ? 'financial_entries' : 'scenario'),
    sourceId: input.sourceId ?? input.orderId ?? null,
    evidenceIds: input.sourceId ? [input.sourceId] : [],
    observedAt: input.observedAt ?? null,
    notes: input.notes ?? 'Custo logístico preservado separadamente do frete cobrado e de subsídios.',
  }];
}
