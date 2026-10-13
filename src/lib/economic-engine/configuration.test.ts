import { buildConfiguredBlockComponents } from './configuration';
import { composeEconomicResult } from './composer';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('economic-engine/configuration.test: ' + message);
}

function equal(actual: unknown, expected: unknown, message: string) {
  assert(Object.is(actual, expected), message + ': esperado ' + String(expected) + ', recebido ' + String(actual));
}

const b2 = buildConfiguredBlockComponents({
  configuration: {
    id: 'cfg-b2-h18',
    block: 'B2',
    code: 'B2-H18',
    name: 'Bandeja H-18 + rótulo',
    isZeroConfirmed: false,
    productId: 'alfajor',
    variantId: 'branco',
    commercialPresentationId: 'ap18',
  },
  occurrenceMultiplier: 2,
  lines: [
    {
      id: 'line-h18',
      componentProductId: 'h18',
      componentVariantId: null,
      componentName: 'BANDEJA H-18',
      unit: 'un',
      quantity: 1,
      incidence: 'I-A',
      subcategory: 'B2.1',
      productCost: { source: 'product_cost', unitCost: 0.76, sourceId: 'h18' },
    },
    {
      id: 'line-label',
      componentProductId: 'label',
      componentVariantId: null,
      componentName: 'ROTULO ALFAJOR PARA BANDEJA',
      unit: 'un',
      quantity: 1,
      incidence: 'I-A',
      subcategory: 'B2.1',
      productCost: { source: 'product_cost', unitCost: 0.01, sourceId: 'label' },
    },
  ],
});

const b2Result = composeEconomicResult({ components: b2 });
equal(b2Result.blocks.B2.amount, 1.54, 'duas apresentações H18 devem custar 2 × R$0,77');

const b3Zero = buildConfiguredBlockComponents({
  configuration: {
    id: 'cfg-b3-zero',
    block: 'B3',
    code: 'B3-SEM-EXTRA',
    name: 'Sem embalagem extra / retirada',
    isZeroConfirmed: true,
    productId: 'alfajor',
    variantId: 'branco',
    commercialPresentationId: null,
  },
  lines: [],
});

const b3ZeroResult = composeEconomicResult({ components: b3Zero });
equal(b3ZeroResult.blocks.B3.amount, 0, 'configuração B3 zero deve produzir zero comprovado');
equal(b3Zero[0].costState, 'PROVEN_ZERO', 'zero explícito deve permanecer zero comprovado');

const incomplete = buildConfiguredBlockComponents({
  configuration: {
    id: 'cfg-b3-pending',
    block: 'B3',
    code: 'B3-ENVIO',
    name: 'Envio digital',
    isZeroConfirmed: false,
    productId: 'alfajor',
    variantId: 'branco',
    commercialPresentationId: null,
  },
  lines: [],
});

const incompleteResult = composeEconomicResult({ components: incomplete });
equal(incompleteResult.blocks.B3.completeness, 'PARTIAL', 'configuração sem composição deve ficar parcial');
equal(incompleteResult.blocks.B3.amount, null, 'configuração incompleta não pode virar zero');

const missingCost = buildConfiguredBlockComponents({
  configuration: {
    id: 'cfg-b2-missing',
    block: 'B2',
    code: 'B2-CAIXA',
    name: 'Caixa com divisões',
    isZeroConfirmed: false,
    productId: 'alfajor',
    variantId: 'branco',
    commercialPresentationId: 'ap18',
  },
  lines: [{
    id: 'unknown-line',
    componentProductId: 'divider',
    componentVariantId: null,
    componentName: 'Divisória',
    unit: 'un',
    quantity: 1,
    incidence: 'I-A',
  }],
});

const missingResult = composeEconomicResult({ components: missingCost });
equal(missingResult.blocks.B2.completeness, 'PARTIAL', 'componente sem custo deve ficar parcial');
equal(missingResult.blocks.B2.knownNetAmount, 0, 'custo desconhecido não pode ser inventado');

console.log('economic-engine/configuration.test: OK');
