import type { EconomicComponent } from './domain';

export type B1CostSource = 'latest_purchase' | 'variant_override' | 'product_cost' | 'missing';

export type B1CostCandidate = {
  source: Exclude<B1CostSource, 'missing'>;
  unitCost: number;
  occurredAt?: string | null;
  sourceId?: string | null;
};

export type B1BomLine = {
  id: string;
  componentId: string;
  componentVariantId: string | null;
  componentName: string;
  componentVariantName?: string | null;
  category?: string | null;
  unit?: string | null;
  qtyPerUnit: number;
  latestPurchase?: B1CostCandidate | null;
  variantOverride?: B1CostCandidate | null;
  productCost?: B1CostCandidate | null;
};

export type B1Process = {
  id: string;
  processId: string;
  processName: string;
  costPerUnit: number | null;
  isActive: boolean;
};

export type B1LossMode = 'provisional-zero-open' | 'unknown' | 'not-applicable';

export type BuildB1Input = {
  productId: string;
  variantId: string | null;
  bomLines: B1BomLine[];
  processes: B1Process[];
  lossMode?: B1LossMode;
};

const validPositive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

export function resolveB1Cost(line: B1BomLine) {
  const candidates = [line.latestPurchase, line.variantOverride, line.productCost];
  const found = candidates.find((candidate) => candidate && validPositive(candidate.unitCost)) ?? null;
  return found ?? { source: 'missing' as const, unitCost: null, sourceId: null, occurredAt: null };
}

function packaging(category?: string | null) {
  const value = (category ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return value.includes('embal');
}

export function buildB1Components(input: BuildB1Input): EconomicComponent[] {
  const materials = input.bomLines.map<EconomicComponent>((line) => {
    const resolved = resolveB1Cost(line);
    const fromPurchase = resolved.source === 'latest_purchase';
    const fromOverride = resolved.source === 'variant_override';
    const fromLegacy = resolved.source === 'product_cost';
    const known = fromPurchase || fromOverride;
    const amount = known && validPositive(line.qtyPerUnit) && resolved.unitCost !== null
      ? resolved.unitCost * line.qtyPerUnit
      : null;

    return {
      id: 'b1:bom:' + line.id,
      economicKey: ['b1','bom',line.componentId,line.componentVariantId ?? 'base',line.id].join(':'),
      block: 'B1',
      subcategory: packaging(line.category) ? 'B1.2' : 'B1.1',
      itemCode: line.componentId,
      itemName: line.componentName + (line.componentVariantName ? ' · ' + line.componentVariantName : ''),
      amount,
      currency: 'BRL',
      unit: 'un_fisica_produto_final',
      effect: 'COST',
      numericNature: fromPurchase ? 'DERIVED' : fromOverride ? 'OBSERVED_CURRENT' : fromLegacy ? 'OBSERVED_HISTORICAL' : 'FUTURE_UNDEFINED',
      costState: known ? 'APPLICABLE_WITH_VALUE' : fromLegacy ? 'HISTORICAL_REVALIDATE' : 'APPLICABLE_VALUE_PENDING',
      knowledgeState: known ? 'KNOWN' : 'UNKNOWN',
      incidence: 'I-U',
      nativeGrain: line.unit ?? null,
      driver: 'qty_per_unit',
      quantity: validPositive(line.qtyPerUnit) ? line.qtyPerUnit : null,
      scope: input.variantId ? 'product:' + input.productId + ':variant:' + input.variantId : 'product:' + input.productId,
      sourceDomain: fromPurchase ? 'Operações/Compras' : 'Produto/Operações',
      sourceEntity: fromPurchase ? 'purchase_order_items' : fromOverride ? 'product_variants' : fromLegacy ? 'products' : 'product_components',
      sourceId: resolved.sourceId ?? line.id,
      observedAt: resolved.occurredAt ?? null,
      notes: fromLegacy
        ? 'Custo cadastral histórico preservado como fallback pendente de revalidação.'
        : known
          ? 'Custo unitário resolvido para o componente físico.'
          : 'Componente aplicável sem custo atual resolvido.',
    };
  });

  const processes = input.processes
    .filter((process) => process.isActive)
    .map<EconomicComponent>((process) => {
      const known = typeof process.costPerUnit === 'number' && Number.isFinite(process.costPerUnit) && process.costPerUnit >= 0;
      return {
        id: 'b1:process:' + process.id,
        economicKey: 'b1:process:' + input.productId + ':' + process.processId,
        block: 'B1',
        subcategory: 'B1.3',
        itemCode: process.processId,
        itemName: process.processName,
        amount: known ? process.costPerUnit : null,
        currency: 'BRL',
        unit: 'un_fisica_produto_final',
        effect: 'COST',
        numericNature: known ? 'OBSERVED_CURRENT' : 'FUTURE_UNDEFINED',
        costState: known ? 'APPLICABLE_WITH_VALUE' : 'APPLICABLE_VALUE_PENDING',
        knowledgeState: known ? 'KNOWN' : 'UNKNOWN',
        incidence: 'I-U',
        nativeGrain: 'un_fisica_produto_final',
        driver: 'cost_per_unit',
        quantity: 1,
        scope: input.variantId ? 'product:' + input.productId + ':variant:' + input.variantId : 'product:' + input.productId,
        sourceDomain: 'Operações/Produção',
        sourceEntity: 'product_processes',
        sourceId: process.id,
      };
    });

  const lossMode = input.lossMode ?? 'unknown';
  const losses: EconomicComponent = {
    id: 'b1:loss:' + input.productId + ':' + (input.variantId ?? 'base'),
    economicKey: 'b1:loss:' + input.productId + ':' + (input.variantId ?? 'base'),
    block: 'B1',
    subcategory: 'B1.5',
    itemName: 'Perdas produtivas',
    amount: lossMode === 'provisional-zero-open' ? 0 : null,
    currency: 'BRL',
    unit: 'un_fisica_produto_final',
    effect: 'COST',
    numericNature: lossMode === 'provisional-zero-open' ? 'ESTIMATED' : lossMode === 'not-applicable' ? 'HOMOLOGATED' : 'FUTURE_UNDEFINED',
    costState: lossMode === 'not-applicable' ? 'NOT_APPLICABLE' : 'APPLICABLE_VALUE_PENDING',
    knowledgeState: lossMode === 'not-applicable' ? 'NOT_APPLICABLE' : 'UNKNOWN',
    incidence: 'I-U',
    sourceDomain: 'Operações/Produção',
    notes: lossMode === 'provisional-zero-open'
      ? 'R$0,00 operacional provisório; não é zero comprovado. Manter em aberto até mensuração real.'
      : lossMode === 'not-applicable'
        ? 'Perdas não aplicáveis neste escopo.'
        : 'Perdas reais ainda não mensuradas.',
  };

  return [...materials, ...processes, losses];
}
