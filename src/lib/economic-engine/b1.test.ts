import { buildB1Components, resolveB1Cost, type B1BomLine } from './b1';
import { composeEconomicResult } from './composer';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('economic-engine/b1.test: ' + message);
}

function equal(actual: unknown, expected: unknown, message: string) {
  assert(Object.is(actual, expected), message + ': esperado ' + String(expected) + ', recebido ' + String(actual));
}

const line: B1BomLine = {
  id: 'bom-1',
  componentId: 'component-1',
  componentVariantId: 'variant-1',
  componentName: 'Componente',
  category: 'MATÉRIA PRIMA',
  unit: 'g',
  qtyPerUnit: 20,
  latestPurchase: {
    source: 'latest_purchase',
    unitCost: 0.016495,
    sourceId: 'purchase-1',
    occurredAt: '2026-10-08T10:00:00Z',
  },
  variantOverride: {
    source: 'variant_override',
    unitCost: 0.0165,
    sourceId: 'variant-1',
  },
  productCost: {
    source: 'product_cost',
    unitCost: 0.02,
    sourceId: 'component-1',
  },
};

equal(resolveB1Cost(line).source, 'latest_purchase', 'compra válida mais recente deve ter prioridade');

const components = buildB1Components({
  productId: 'product-1',
  variantId: 'final-variant-1',
  bomLines: [
    line,
    {
      id: 'bom-pack',
      componentId: 'pack-1',
      componentVariantId: null,
      componentName: 'Embalagem BOPP',
      category: 'Embalagens',
      unit: 'g',
      qtyPerUnit: 0.69,
      variantOverride: {
        source: 'variant_override',
        unitCost: 0.036,
        sourceId: 'pack-v1',
      },
    },
  ],
  processes: [
    {
      id: 'proc-1',
      processId: 'process-1',
      processName: 'Processo fabril',
      costPerUnit: 0.15,
      isActive: true,
    },
  ],
  lossMode: 'provisional-zero-open',
});

const material = components.find((item) => item.id === 'b1:bom:bom-1');
const packaging = components.find((item) => item.id === 'b1:bom:bom-pack');
const losses = components.find((item) => item.subcategory === 'B1.5');

equal(material?.subcategory, 'B1.1', 'matéria-prima deve ir para B1.1');
equal(packaging?.subcategory, 'B1.2', 'embalagem primária deve ir para B1.2');
equal(losses?.amount, 0, 'perda provisória deve preservar valor operacional zero');
equal(losses?.knowledgeState, 'UNKNOWN', 'perda provisória não pode virar zero comprovado');
equal(losses?.costState, 'APPLICABLE_VALUE_PENDING', 'perda provisória deve continuar pendente');

const result = composeEconomicResult({ components });

equal(result.blocks.B1.completeness, 'PARTIAL', 'perda aberta deve manter B1 parcial');
equal(result.blocks.B1.amount, null, 'CFU final não deve ser declarado com perdas pendentes');
equal(result.blocks.B1.knownNetAmount, 0.50474, 'subtotal operacional conhecido deve ser preservado');

const legacyOnly = buildB1Components({
  productId: 'product-2',
  variantId: null,
  bomLines: [{
    id: 'bom-legacy',
    componentId: 'legacy-component',
    componentVariantId: null,
    componentName: 'Componente legado',
    category: 'MATÉRIA PRIMA',
    unit: 'un',
    qtyPerUnit: 1,
    productCost: {
      source: 'product_cost',
      unitCost: 1.2,
      sourceId: 'legacy-component',
    },
  }],
  processes: [],
  lossMode: 'not-applicable',
});

const legacyResult = composeEconomicResult({ components: legacyOnly });
equal(legacyResult.blocks.B1.completeness, 'PARTIAL', 'fallback histórico não deve virar custo atual silenciosamente');
equal(legacyResult.blocks.B1.knownNetAmount, 0, 'fallback histórico não deve ser somado como verdade atual');

console.log('economic-engine/b1.test: OK');
