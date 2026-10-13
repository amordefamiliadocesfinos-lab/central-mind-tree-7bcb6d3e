import type { EconomicComponent, EconomicIncidence } from './domain';

export type ConfigCostSource = 'latest_purchase' | 'variant_override' | 'product_cost' | 'missing';

export type ConfigCostCandidate = {
  source: Exclude<ConfigCostSource, 'missing'>;
  unitCost: number;
  occurredAt?: string | null;
  sourceId?: string | null;
};

export type EconomicConfiguration = {
  id: string;
  block: 'B2' | 'B3';
  code: string;
  name: string;
  isZeroConfirmed: boolean;
  productId: string;
  variantId: string | null;
  commercialPresentationId: string | null;
  notes?: string | null;
};

export type EconomicConfigurationLine = {
  id: string;
  componentProductId: string;
  componentVariantId: string | null;
  componentName: string;
  componentVariantName?: string | null;
  unit?: string | null;
  quantity: number;
  incidence: EconomicIncidence;
  subcategory?: string | null;
  latestPurchase?: ConfigCostCandidate | null;
  variantOverride?: ConfigCostCandidate | null;
  productCost?: ConfigCostCandidate | null;
};

export type BuildConfiguredBlockInput = {
  configuration: EconomicConfiguration;
  lines: EconomicConfigurationLine[];
  occurrenceMultiplier?: number;
};

function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function resolveConfiguredComponentCost(line: EconomicConfigurationLine) {
  const candidates = [line.latestPurchase, line.variantOverride, line.productCost];
  const found = candidates.find((candidate) => candidate && positive(candidate.unitCost)) ?? null;
  return found ?? { source: 'missing' as const, unitCost: null, sourceId: null, occurredAt: null };
}

export function buildConfiguredBlockComponents(
  input: BuildConfiguredBlockInput,
): EconomicComponent[] {
  const multiplier = Number.isFinite(input.occurrenceMultiplier) && (input.occurrenceMultiplier ?? 0) > 0
    ? Number(input.occurrenceMultiplier)
    : 1;

  if (input.configuration.isZeroConfirmed) {
    return [{
      id: 'cfg-zero:' + input.configuration.id,
      economicKey: 'cfg-zero:' + input.configuration.id,
      block: input.configuration.block,
      subcategory: input.configuration.block + '.0',
      itemCode: input.configuration.code,
      itemName: input.configuration.name,
      amount: 0,
      currency: 'BRL',
      unit: input.configuration.block === 'B2' ? 'apresentacao' : 'pedido',
      effect: 'COST',
      numericNature: 'HOMOLOGATED',
      costState: 'PROVEN_ZERO',
      knowledgeState: 'KNOWN',
      incidence: input.configuration.block === 'B2' ? 'I-A' : 'I-P',
      quantity: multiplier,
      sourceDomain: input.configuration.block === 'B2' ? 'Produto/Arquitetura Comercial' : 'Operações/Fulfillment',
      sourceEntity: 'economic_cost_configurations',
      sourceId: input.configuration.id,
      notes: input.configuration.notes ?? 'Configuração explicitamente confirmada com custo zero.',
    }];
  }

  if (input.lines.length === 0) {
    return [{
      id: 'cfg-pending:' + input.configuration.id,
      economicKey: 'cfg-pending:' + input.configuration.id,
      block: input.configuration.block,
      subcategory: input.configuration.block + '.P',
      itemCode: input.configuration.code,
      itemName: input.configuration.name,
      amount: null,
      currency: 'BRL',
      unit: input.configuration.block === 'B2' ? 'apresentacao' : 'pedido',
      effect: 'COST',
      numericNature: 'FUTURE_UNDEFINED',
      costState: 'APPLICABLE_VALUE_PENDING',
      knowledgeState: 'UNKNOWN',
      incidence: input.configuration.block === 'B2' ? 'I-A' : 'I-P',
      sourceDomain: input.configuration.block === 'B2' ? 'Produto/Arquitetura Comercial' : 'Operações/Fulfillment',
      sourceEntity: 'economic_cost_configurations',
      sourceId: input.configuration.id,
      notes: 'Configuração existe, porém sua composição econômica ainda não foi definida.',
    }];
  }

  return input.lines.map<EconomicComponent>((line) => {
    const resolved = resolveConfiguredComponentCost(line);
    const known = resolved.source !== 'missing';
    const lineQty = positive(line.quantity) ? line.quantity : 0;
    const amount = known && resolved.unitCost !== null
      ? resolved.unitCost * lineQty * multiplier
      : null;

    return {
      id: 'cfg-line:' + line.id,
      economicKey: [
        'cfg',
        input.configuration.block,
        input.configuration.id,
        line.componentProductId,
        line.componentVariantId ?? 'base',
        line.id,
      ].join(':'),
      block: input.configuration.block,
      subcategory: line.subcategory ?? null,
      itemCode: line.componentProductId,
      itemName: line.componentName + (line.componentVariantName ? ' · ' + line.componentVariantName : ''),
      amount,
      currency: 'BRL',
      unit: input.configuration.block === 'B2' ? 'apresentacao' : 'pedido',
      effect: 'COST',
      numericNature: resolved.source === 'latest_purchase'
        ? 'DERIVED'
        : resolved.source === 'variant_override'
          ? 'OBSERVED_CURRENT'
          : resolved.source === 'product_cost'
            ? 'OBSERVED_CURRENT'
            : 'FUTURE_UNDEFINED',
      costState: known ? 'APPLICABLE_WITH_VALUE' : 'APPLICABLE_VALUE_PENDING',
      knowledgeState: known ? 'KNOWN' : 'UNKNOWN',
      incidence: line.incidence,
      nativeGrain: line.unit ?? null,
      driver: input.configuration.block === 'B2' ? 'presentation_configuration' : 'fulfillment_configuration',
      quantity: lineQty * multiplier,
      conversionFactor: 1,
      scope: input.configuration.id,
      applicability: input.configuration.name,
      sourceDomain: resolved.source === 'latest_purchase'
        ? 'Operações/Compras'
        : input.configuration.block === 'B2'
          ? 'Produto/Arquitetura Comercial'
          : 'Operações/Fulfillment',
      sourceEntity: resolved.source === 'latest_purchase'
        ? 'purchase_order_items'
        : resolved.source === 'variant_override'
          ? 'product_variants'
          : resolved.source === 'product_cost'
            ? 'products'
            : 'economic_cost_configuration_components',
      sourceId: resolved.sourceId ?? line.id,
      observedAt: resolved.occurredAt ?? null,
      notes: resolved.source === 'product_cost'
        ? 'Referência cadastral operacional usada até existir evidência de aquisição mais atual.'
        : known
          ? 'Custo resolvido para componente da configuração econômica.'
          : 'Componente configurado sem custo econômico resolvido.',
    };
  });
}
