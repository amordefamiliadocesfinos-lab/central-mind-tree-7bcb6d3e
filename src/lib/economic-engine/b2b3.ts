import type { EconomicComponent, EconomicIncidence } from './domain';

export type ConfigCostSource = 'latest_purchase' | 'variant_override' | 'product_cost' | 'missing';

export type ConfigCostCandidate = {
  source: Exclude<ConfigCostSource, 'missing'>;
  unitCost: number;
  sourceId?: string | null;
  occurredAt?: string | null;
};

export type EconomicConfigComponentInput = {
  id: string;
  componentProductId: string;
  componentVariantId: string | null;
  componentName: string;
  componentVariantName?: string | null;
  unit?: string | null;
  quantity: number;
  incidence?: EconomicIncidence;
  nativeGrain?: string | null;
  latestPurchase?: ConfigCostCandidate | null;
  variantOverride?: ConfigCostCandidate | null;
  productCost?: ConfigCostCandidate | null;
};

export type EconomicConfigInput = {
  id: string;
  code: string;
  name: string;
  zeroConfirmed: boolean;
  components: EconomicConfigComponentInput[];
};

const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

export function resolveConfigComponentCost(line: EconomicConfigComponentInput) {
  const candidates = [line.latestPurchase, line.variantOverride, line.productCost];
  return candidates.find((candidate) => candidate && positive(candidate.unitCost))
    ?? { source: 'missing' as const, unitCost: null, sourceId: null, occurredAt: null };
}

function buildConfigComponents(
  block: 'B2' | 'B3',
  config: EconomicConfigInput,
  defaultIncidence: EconomicIncidence,
): EconomicComponent[] {
  if (config.components.length === 0 && config.zeroConfirmed) {
    return [{
      id: block.toLowerCase() + ':zero:' + config.id,
      economicKey: block.toLowerCase() + ':config:' + config.id + ':zero',
      block,
      subcategory: block === 'B2' ? 'B2.0' : 'B3.0',
      itemName: config.name,
      amount: 0,
      currency: 'BRL',
      unit: block === 'B2' ? 'apresentacao' : 'pedido',
      effect: 'COST',
      numericNature: 'HOMOLOGATED',
      costState: 'PROVEN_ZERO',
      knowledgeState: 'KNOWN',
      incidence: defaultIncidence,
      sourceDomain: block === 'B2' ? 'Produto/Operações/Comercial' : 'Operações/Fulfillment',
      sourceEntity: block === 'B2' ? 'economic_presentation_configs' : 'economic_fulfillment_configs',
      sourceId: config.id,
      notes: 'Zero comprovado somente para esta configuração explicitamente selecionada.',
    }];
  }

  if (config.components.length === 0) {
    return [{
      id: block.toLowerCase() + ':pending:' + config.id,
      economicKey: block.toLowerCase() + ':config:' + config.id + ':pending',
      block,
      subcategory: block === 'B2' ? 'B2.9' : 'B3.9',
      itemName: config.name,
      amount: null,
      currency: 'BRL',
      unit: block === 'B2' ? 'apresentacao' : 'pedido',
      effect: 'COST',
      numericNature: 'FUTURE_UNDEFINED',
      costState: 'APPLICABLE_VALUE_PENDING',
      knowledgeState: 'UNKNOWN',
      incidence: defaultIncidence,
      sourceDomain: block === 'B2' ? 'Produto/Operações/Comercial' : 'Operações/Fulfillment',
      sourceEntity: block === 'B2' ? 'economic_presentation_configs' : 'economic_fulfillment_configs',
      sourceId: config.id,
      notes: 'Configuração aplicável ainda sem composição econômica definida.',
    }];
  }

  return config.components.map<EconomicComponent>((line) => {
    const resolved = resolveConfigComponentCost(line);
    const known = resolved.source !== 'missing';
    const amount = known && resolved.unitCost !== null && positive(line.quantity)
      ? resolved.unitCost * line.quantity
      : null;

    return {
      id: block.toLowerCase() + ':component:' + line.id,
      economicKey: [
        block.toLowerCase(),
        'config',
        config.id,
        line.componentProductId,
        line.componentVariantId ?? 'base',
        line.id,
      ].join(':'),
      block,
      subcategory: block === 'B2' ? 'B2.1' : 'B3.1',
      itemCode: line.componentProductId,
      itemName: line.componentName + (line.componentVariantName ? ' · ' + line.componentVariantName : ''),
      amount,
      currency: 'BRL',
      unit: block === 'B2' ? 'apresentacao' : 'pedido',
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
      incidence: line.incidence ?? defaultIncidence,
      nativeGrain: line.nativeGrain ?? line.unit ?? null,
      driver: 'configuration_quantity',
      quantity: positive(line.quantity) ? line.quantity : null,
      sourceDomain: resolved.source === 'latest_purchase' ? 'Operações/Compras' : 'Produto/Operações',
      sourceEntity: resolved.source === 'latest_purchase'
        ? 'purchase_order_items'
        : resolved.source === 'variant_override'
          ? 'product_variants'
          : resolved.source === 'product_cost'
            ? 'products'
            : block === 'B2'
              ? 'economic_presentation_config_components'
              : 'economic_fulfillment_config_components',
      sourceId: resolved.sourceId ?? line.id,
      observedAt: resolved.occurredAt ?? null,
      notes: resolved.source === 'product_cost'
        ? 'Referência cadastral operacional do componente; preservar origem no resultado.'
        : known
          ? 'Custo econômico resolvido para o componente configurado.'
          : 'Componente configurado sem custo econômico resolvido.',
    };
  });
}

export function buildB2Components(config: EconomicConfigInput) {
  return buildConfigComponents('B2', config, 'I-A');
}

export function buildB3Components(config: EconomicConfigInput) {
  return buildConfigComponents('B3', config, 'I-P');
}
