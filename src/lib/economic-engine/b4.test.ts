import { buildB4Components, calculateB4FundingSummary } from './b4';
import { composeEconomicResult } from './composer';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('economic-engine/b4.test: ' + message);
}

function equal(actual: unknown, expected: unknown, message: string) {
  assert(Object.is(actual, expected), message + ': esperado ' + String(expected) + ', recebido ' + String(actual));
}

const pickup = buildB4Components({
  mode: 'retirada_fabrica',
  logisticsCost: 0,
  source: 'zero_confirmed',
  customerFreightPaid: 0,
  channelFreightSubsidy: 0,
});

const pickupResult = composeEconomicResult({ components: pickup });
equal(pickupResult.blocks.B4.amount, 0, 'retirada sem deslocamento deve ser zero comprovado');
equal(pickup[0].costState, 'PROVEN_ZERO', 'retirada deve preservar zero comprovado');

const uber = buildB4Components({
  mode: 'uber_entrega',
  logisticsCost: 17,
  source: 'manual_simulation',
  customerFreightPaid: 10,
  channelFreightSubsidy: 0,
});

const uberResult = composeEconomicResult({ components: uber });
equal(uberResult.blocks.B4.amount, 17, 'B4 deve reconhecer custo logístico integral');
equal(uber[0].numericNature, 'SIMULATED', 'custo prospectivo manual deve ser simulado');

const funding = calculateB4FundingSummary({
  mode: 'uber_entrega',
  logisticsCost: 17,
  source: 'manual_simulation',
  customerFreightPaid: 10,
  channelFreightSubsidy: 2,
});
equal(funding.sellerAbsorptionKnown, 5, 'absorção conhecida deve preservar custo menos fontes de financiamento');

const ownDelivery = buildB4Components({
  mode: 'entrega_propria',
  logisticsCost: null,
  source: 'missing',
});

const ownDeliveryResult = composeEconomicResult({ components: ownDelivery });
equal(ownDeliveryResult.blocks.B4.completeness, 'PARTIAL', 'entrega própria sem método deve ficar parcial');
equal(ownDelivery[0].costState, 'METHODOLOGY_PENDING', 'entrega própria sem método deve declarar metodologia pendente');

const marketplaceUnknown = buildB4Components({
  mode: 'marketplace_logistica',
  logisticsCost: null,
  source: 'missing',
  customerFreightPaid: 0,
  channelFreightSubsidy: 12,
});

const marketplaceUnknownResult = composeEconomicResult({ components: marketplaceUnknown });
equal(marketplaceUnknownResult.blocks.B4.amount, null, 'subsídio não pode transformar custo logístico desconhecido em zero');
equal(marketplaceUnknownResult.blocks.B4.completeness, 'PARTIAL', 'custo de marketplace desconhecido deve ficar parcial');

const paidReal = buildB4Components({
  mode: 'transportadora',
  logisticsCost: 23.4,
  source: 'financial_entry',
  sourceId: 'fin-1',
  isPaid: true,
  isConciliated: false,
  orderId: 'order-1',
});

equal(paidReal[0].numericNature, 'PROVEN', 'custo financeiro pago deve ser tratado como fato comprovado');

console.log('economic-engine/b4.test: OK');
