import { calculateShopeeAdapterScenario, resolveShopeeTsiBand, type ShopeeChannelPolicy } from './shopeeAdapter';
import { composeEconomicResult } from './composer';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('economic-engine/shopeeAdapter.test: ' + message);
}

function equal(actual: unknown, expected: unknown, message: string) {
  assert(Object.is(actual, expected), message + ': esperado ' + String(expected) + ', recebido ' + String(actual));
}

const policy: ShopeeChannelPolicy = {
  commissionPct: 12,
  transactionPct: 2,
  servicePct: 3.5,
  tsiBands: [
    { minInclusive: 0, maxExclusive: 80, amount: 4, label: '< R$80' },
    { minInclusive: 80, maxExclusive: 100, amount: 16, label: 'R$80–99,99' },
    { minInclusive: 100, maxExclusive: 200, amount: 20, label: 'R$100–199,99' },
    { minInclusive: 200, maxExclusive: null, amount: 26, label: '≥ R$200' },
  ],
  walls: [80, 100, 200],
};

const tsiCases = [
  [79.99, 4],
  [80, 16],
  [99.99, 16],
  [100, 20],
  [199.99, 20],
  [200, 26],
] as const;

for (const [price, expected] of tsiCases) {
  equal(resolveShopeeTsiBand(price, policy)?.amount, expected, 'TSI versionada ' + price);
}

const make = (price: number) => calculateShopeeAdapterScenario({
  channelAccountId: 'account-1',
  offerMappingId: 'offer-1',
  unitPrice: price,
  q: 1,
  presentation: 36,
  adsPct: 0,
  affiliatePct: 0,
  retMCharges: 0,
  retMBenefits: 0,
  costPerUnit: 0,
  targetMarginPct: 20,
  baselinePrice: 97.85,
  policy,
  rule: {
    engineVersion: '2.0.0',
    ruleVersion: 'structural-2026-07-02_2026-10-02',
    effectiveFrom: '2026-07-02',
    effectiveTo: '2026-10-02',
    sourceRefs: ['legacy-characterization'],
    confidence: 'medium',
    warnings: [],
  },
});

const expectedRepasses = new Map([
  [79.99, 61.99],
  [83, 52.47],
  [99.99, 66.49],
  [103, 64.97],
  [105, 66.62],
]);

for (const [price, expected] of expectedRepasses) {
  equal(make(price).scenario.result.repasse, expected, 'repasse adaptador ' + price);
}

assert(
  make(79.99).scenario.result.repasse > make(83).scenario.result.repasse,
  '83 deve permanecer dominado por 79,99 no adaptador',
);
assert(
  make(99.99).scenario.result.repasse > make(103).scenario.result.repasse,
  '103 deve permanecer dominado por 99,99 no adaptador',
);

const scenario = make(97.85);
equal(scenario.scenario.result.repasse, 64.73, 'repasse legado caracterizado deve permanecer estável');
equal(scenario.scenario.volumePhysical, 36, 'volume físico deve continuar apresentação × Q');
equal(scenario.scenario.costTotal, null, 'sem custo não inventa custo');
equal(scenario.scenario.pmr, null, 'sem custo não inventa PMR');
equal(scenario.scenario.tceBe, null, 'sem custo não inventa TCE-BE');
equal(scenario.scenario.result.tsiBand?.label, 'R$80–99,99', 'faixa TSI deve vir da política versionada');

const b5 = composeEconomicResult({ components: scenario.components });
equal(b5.blocks.B5.completeness, 'COMPLETE', 'B5 com política completa deve ser completo');
equal(b5.blocks.B5.amount, 33.12, 'B5 deve decompor os encargos conhecidos do canal');

const unknownPolicyScenario = calculateShopeeAdapterScenario({
  channelAccountId: 'account-1',
  offerMappingId: 'offer-1',
  unitPrice: 97.85,
  q: 1,
  presentation: 36,
  adsPct: 0,
  affiliatePct: 0,
  retMCharges: 0,
  retMBenefits: 0,
  costPerUnit: 0,
  targetMarginPct: 20,
  baselinePrice: 97.85,
  policy: { ...policy, tsiBands: [], walls: [] },
  rule: {
    engineVersion: '2.0.0',
    ruleVersion: 'incomplete',
    effectiveFrom: null,
    effectiveTo: null,
    sourceRefs: [],
    confidence: 'low',
    warnings: ['TSI pendente'],
  },
});

const unknownB5 = composeEconomicResult({ components: unknownPolicyScenario.components });
equal(unknownB5.blocks.B5.completeness, 'PARTIAL', 'TSI não versionada deve manter B5 parcial');
equal(unknownB5.blocks.B5.amount, null, 'B5 incompleto não pode se apresentar como custo final');

console.log('economic-engine/shopeeAdapter.test: OK');
