import { buildB2Components, buildB3Components } from './b2b3';
import { composeEconomicResult } from './composer';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('economic-engine/b2b3.test: ' + message);
}

function equal(actual: unknown, expected: unknown, message: string) {
  assert(Object.is(actual, expected), message + ': esperado ' + String(expected) + ', recebido ' + String(actual));
}

const b2 = buildB2Components({
  id: 'presentation-config-1',
  code: 'BANDEJA_H18',
  name: 'Bandeja H-18',
  zeroConfirmed: false,
  components: [
    {
      id: 'tray',
      componentProductId: 'tray-product',
      componentVariantId: null,
      componentName: 'Bandeja H-18',
      unit: 'un',
      quantity: 1,
      productCost: { source: 'product_cost', unitCost: 0.76, sourceId: 'tray-product' },
    },
    {
      id: 'label',
      componentProductId: 'label-product',
      componentVariantId: null,
      componentName: 'Rótulo',
      unit: 'un',
      quantity: 1,
      productCost: { source: 'product_cost', unitCost: 0.01, sourceId: 'label-product' },
    },
  ],
});

const b2Result = composeEconomicResult({ components: b2 });
equal(b2Result.blocks.B2.amount, 0.77, 'B2 H-18 deve somar bandeja + rótulo');
equal(b2Result.blocks.B2.completeness, 'COMPLETE', 'B2 conhecido deve ser completo');

const b3Zero = buildB3Components({
  id: 'fulfillment-none',
  code: 'SEM_EMBALAGEM_EXTRA',
  name: 'Sem embalagem extra',
  zeroConfirmed: true,
  components: [],
});

const b3ZeroResult = composeEconomicResult({ components: b3Zero });
equal(b3ZeroResult.blocks.B3.amount, 0, 'B3 sem embalagem extra deve ser zero comprovado');
equal(b3ZeroResult.blocks.B3.completeness, 'COMPLETE', 'zero comprovado deve ser completo');
equal(b3Zero[0].costState, 'PROVEN_ZERO', 'zero deve preservar estado PROVEN_ZERO');

const b3Pending = buildB3Components({
  id: 'shipping-box',
  code: 'CAIXA_ENVIO',
  name: 'Caixa de envio',
  zeroConfirmed: false,
  components: [{
    id: 'missing-tape',
    componentProductId: 'tape',
    componentVariantId: null,
    componentName: 'Fita',
    unit: 'm',
    quantity: 1.2,
  }],
});

const b3PendingResult = composeEconomicResult({ components: b3Pending });
equal(b3PendingResult.blocks.B3.amount, null, 'B3 com componente sem custo não deve fingir valor final');
equal(b3PendingResult.blocks.B3.completeness, 'PARTIAL', 'B3 pendente deve ser parcial');

const latestPurchase = buildB2Components({
  id: 'presentation-config-2',
  code: 'TESTE_COMPRA',
  name: 'Teste compra',
  zeroConfirmed: false,
  components: [{
    id: 'box',
    componentProductId: 'box-product',
    componentVariantId: null,
    componentName: 'Caixa',
    unit: 'un',
    quantity: 1,
    latestPurchase: { source: 'latest_purchase', unitCost: 1.9, sourceId: 'purchase-1' },
    productCost: { source: 'product_cost', unitCost: 2.2, sourceId: 'box-product' },
  }],
});
equal(latestPurchase[0].amount, 1.9, 'compra mais recente deve prevalecer sobre custo cadastral');
equal(latestPurchase[0].sourceEntity, 'purchase_order_items', 'origem da compra deve ser preservada');

console.log('economic-engine/b2b3.test: OK');
