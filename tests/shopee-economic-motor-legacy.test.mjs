import assert from 'node:assert/strict';

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

function getTsiUnit(unitPrice) {
  if (unitPrice < 80) return 4;
  if (unitPrice < 100) return 16;
  if (unitPrice < 200) return 20;
  return 26;
}

function calculateRepasse({
  unitPrice,
  q = 1,
  commissionPct = 12,
  transactionPct = 2,
  servicePct = 3.5,
  adsPct = 0,
  affiliatePct = 0,
  retMCharges = 0,
  retMBenefits = 0,
}) {
  const ticket = round2(unitPrice * q);
  const commission = round2(ticket * (commissionPct / 100));
  const transaction = round2(ticket * (transactionPct / 100));
  const serviceAdditional = round2(ticket * (servicePct / 100));
  const adsEasy = round2(ticket * (adsPct / 100));
  const affiliate = round2(ticket * (affiliatePct / 100));
  const tsiUnit = getTsiUnit(unitPrice);
  const tsiTotal = round2(tsiUnit * q);
  const serviceTotal = round2(transaction + serviceAdditional + adsEasy + tsiTotal);
  const retMChargesTotal = round2(affiliate + retMCharges);
  const retBenefitsTotal = round2(retMBenefits);
  const repasse = round2(ticket - commission - serviceTotal - retMChargesTotal + retBenefitsTotal);

  return { ticket, tsiUnit, tsiTotal, repasse };
}

const tsiCases = [
  [79.99, 4],
  [80, 16],
  [99.99, 16],
  [100, 20],
  [199.99, 20],
  [200, 26],
];

for (const [price, expected] of tsiCases) {
  assert.equal(getTsiUnit(price), expected, `TSI ${price}`);
}

const canonicalRepasseCases = new Map([
  [79.99, 61.99],
  [83, 52.47],
  [99.99, 66.49],
  [103, 64.97],
  [105, 66.62],
]);

for (const [price, expected] of canonicalRepasseCases) {
  assert.equal(calculateRepasse({ unitPrice: price }).repasse, expected, `repasse ${price}`);
}

assert.ok(
  calculateRepasse({ unitPrice: 79.99 }).repasse > calculateRepasse({ unitPrice: 83 }).repasse,
  '83 deve permanecer dominado por 79,99',
);

assert.ok(
  calculateRepasse({ unitPrice: 99.99 }).repasse > calculateRepasse({ unitPrice: 103 }).repasse,
  '103 deve permanecer dominado por 99,99',
);

assert.equal(
  calculateRepasse({ unitPrice: 97.85 }).repasse,
  64.73,
  'forecast VP-01 deve preservar repasse legado no regime estrutural simples',
);

console.log('shopee-economic-motor-legacy.test: OK');
