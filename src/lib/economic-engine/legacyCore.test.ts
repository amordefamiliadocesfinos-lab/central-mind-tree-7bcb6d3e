import { calculateLegacyEconomicScenario, calculateRepasse, getTsiUnit } from './legacyCore';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`economic-engine/legacyCore.test: ${message}`);
}

function equal(actual: unknown, expected: unknown, message: string) {
  assert(Object.is(actual, expected), `${message}: esperado ${String(expected)}, recebido ${String(actual)}`);
}

const tsiCases = [
  [79.99, 4],
  [80, 16],
  [99.99, 16],
  [100, 20],
  [199.99, 20],
  [200, 26],
] as const;

for (const [price, expected] of tsiCases) equal(getTsiUnit(price), expected, `TSI ${price}`);

const base = {
  q: 1,
  commissionPct: 12,
  transactionPct: 2,
  servicePct: 3.5,
  adsPct: 0,
  affiliatePct: 0,
  retMCharges: 0,
  retMBenefits: 0,
};

const repasses = new Map([
  [79.99, 61.99],
  [83, 52.47],
  [99.99, 66.49],
  [103, 64.97],
  [105, 66.62],
]);

for (const [price, expected] of repasses) {
  equal(calculateRepasse({ ...base, unitPrice: price }).repasse, expected, `repasse ${price}`);
}

assert(
  calculateRepasse({ ...base, unitPrice: 79.99 }).repasse > calculateRepasse({ ...base, unitPrice: 83 }).repasse,
  '83 deve permanecer dominado por 79,99',
);
assert(
  calculateRepasse({ ...base, unitPrice: 99.99 }).repasse > calculateRepasse({ ...base, unitPrice: 103 }).repasse,
  '103 deve permanecer dominado por 99,99',
);

const scenario = calculateLegacyEconomicScenario({
  ...base,
  presentation: 36,
  agreedPrice: 97.85,
  costPerUnit: 0,
  targetMarginPct: 20,
  baselinePrice: 97.85,
});

equal(scenario.result.repasse, 64.73, 'repasse legado deve permanecer estável');
equal(scenario.volumePhysical, 36, 'volume físico deve continuar apresentação × Q');
equal(scenario.costTotal, null, 'sem CEA não deve inventar custo');
equal(scenario.pmr, null, 'sem CEA não deve inventar PMR');
equal(scenario.tceBe, null, 'sem CEA não deve inventar TCE-BE');
equal(scenario.tsiBand, 'R$80–99,99', 'faixa TSI deve usar preço acordado');

console.log('economic-engine/legacyCore.test: OK');
