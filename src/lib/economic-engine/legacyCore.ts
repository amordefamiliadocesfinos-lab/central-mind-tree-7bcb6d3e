export type LegacyCalculationInput = {
  unitPrice: number;
  q: number;
  commissionPct: number;
  transactionPct: number;
  servicePct: number;
  adsPct: number;
  affiliatePct: number;
  retMCharges: number;
  retMBenefits: number;
};

export type EconomicWall = 80 | 100 | 200;

export type LegacyScenarioInput = Omit<LegacyCalculationInput, 'unitPrice'> & {
  presentation: number;
  agreedPrice: number;
  costPerUnit: number;
  targetMarginPct: number;
  baselinePrice: number;
};

export const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function getTsiUnit(unitPrice: number) {
  if (unitPrice < 80) return 4;
  if (unitPrice < 100) return 16;
  if (unitPrice < 200) return 20;
  return 26;
}

export function calculateRepasse(input: LegacyCalculationInput) {
  const ticket = round2(input.unitPrice * input.q);
  const commission = round2(ticket * (input.commissionPct / 100));
  const transaction = round2(ticket * (input.transactionPct / 100));
  const serviceAdditional = round2(ticket * (input.servicePct / 100));
  const adsEasy = round2(ticket * (input.adsPct / 100));
  const affiliate = round2(ticket * (input.affiliatePct / 100));
  const tsiUnit = getTsiUnit(input.unitPrice);
  const tsiTotal = round2(tsiUnit * input.q);
  const serviceTotal = round2(transaction + serviceAdditional + adsEasy + tsiTotal);
  const retMChargesTotal = round2(affiliate + input.retMCharges);
  const retMBenefitsTotal = round2(input.retMBenefits);
  const repasse = round2(ticket - commission - serviceTotal - retMChargesTotal + retMBenefitsTotal);
  const shopeeAbsorption = round2(ticket - repasse);

  return {
    ticket,
    commission,
    transaction,
    serviceAdditional,
    adsEasy,
    affiliate,
    tsiUnit,
    tsiTotal,
    serviceTotal,
    retMChargesTotal,
    retMBenefitsTotal,
    repasse,
    shopeeAbsorption,
  };
}

export function findFirstPriceForRepasse(targetRepasse: number, input: Omit<LegacyCalculationInput, 'unitPrice'>) {
  if (!Number.isFinite(targetRepasse) || targetRepasse <= 0) return null;

  const bands = [
    { min: 0.01, max: 79.99 },
    { min: 80, max: 99.99 },
    { min: 100, max: 199.99 },
    { min: 200, max: 5000 },
  ];

  const valueAt = (price: number) => calculateRepasse({ ...input, unitPrice: price }).repasse;

  for (const band of bands) {
    if (valueAt(band.max) + 0.0001 < targetRepasse) continue;

    let lo = Math.round(band.min * 100);
    let hi = Math.round(band.max * 100);

    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const price = mid / 100;
      if (valueAt(price) + 0.0001 >= targetRepasse) hi = mid;
      else lo = mid + 1;
    }

    return lo / 100;
  }

  return null;
}

export function findRecoveryPrice(wall: EconomicWall, input: Omit<LegacyCalculationInput, 'unitPrice'>) {
  const preWallPrice = wall - 0.01;
  const preWallRepasse = calculateRepasse({ ...input, unitPrice: preWallPrice }).repasse;
  const upper = wall === 80 ? 99.99 : wall === 100 ? 199.99 : 5000;
  const valueAt = (price: number) => calculateRepasse({ ...input, unitPrice: price }).repasse;

  if (valueAt(upper) + 0.0001 < preWallRepasse) return null;

  let lo = Math.round(wall * 100);
  let hi = Math.round(upper * 100);
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const price = mid / 100;
    if (valueAt(price) + 0.0001 >= preWallRepasse) hi = mid;
    else lo = mid + 1;
  }

  return {
    wall,
    preWallPrice,
    preWallRepasse,
    recoveryPrice: lo / 100,
  };
}

export function getPreviousWall(unitPrice: number): EconomicWall | null {
  if (unitPrice >= 200) return 200;
  if (unitPrice >= 100) return 100;
  if (unitPrice >= 80) return 80;
  return null;
}

export function getNextWall(unitPrice: number): EconomicWall | null {
  if (unitPrice < 80) return 80;
  if (unitPrice < 100) return 100;
  if (unitPrice < 200) return 200;
  return null;
}

export function getTsiBand(unitPrice: number) {
  if (unitPrice < 80) return '< R$80';
  if (unitPrice < 100) return 'R$80–99,99';
  if (unitPrice < 200) return 'R$100–199,99';
  return '≥ R$200';
}

export function calculateLegacyEconomicScenario(input: LegacyScenarioInput) {
  const commonInput: Omit<LegacyCalculationInput, 'unitPrice'> = {
    q: Math.max(1, Math.floor(input.q || 1)),
    commissionPct: clamp(input.commissionPct || 0, 0, 100),
    transactionPct: clamp(input.transactionPct || 0, 0, 100),
    servicePct: clamp(input.servicePct || 0, 0, 100),
    adsPct: clamp(input.adsPct || 0, 0, 100),
    affiliatePct: clamp(input.affiliatePct || 0, 0, 100),
    retMCharges: Math.max(0, input.retMCharges || 0),
    retMBenefits: Math.max(0, input.retMBenefits || 0),
  };

  const agreedPrice = Math.max(0, input.agreedPrice || 0);
  const result = calculateRepasse({ ...commonInput, unitPrice: agreedPrice });
  const volumePhysical = input.presentation * commonInput.q;
  const absorptionPct = result.ticket > 0 ? result.shopeeAbsorption / result.ticket : 0;
  const reu = volumePhysical > 0 ? result.repasse / volumePhysical : 0;
  const costTotal = input.costPerUnit > 0 ? round2(input.costPerUnit * volumePhysical) : null;
  const marginCurrent = costTotal !== null && result.repasse > 0 ? (result.repasse - costTotal) / result.repasse : null;

  const previousWall = getPreviousWall(agreedPrice);
  const nextWall = getNextWall(agreedPrice);
  const recovery = previousWall ? findRecoveryPrice(previousWall, commonInput) : null;
  const isDominated = Boolean(
    recovery &&
    agreedPrice >= recovery.wall &&
    agreedPrice < recovery.recoveryPrice &&
    result.repasse + 0.0001 < recovery.preWallRepasse,
  );

  const targetMargin = clamp((input.targetMarginPct || 0) / 100, 0, 0.95);
  const requiredRepasse = costTotal !== null ? round2(costTotal / (1 - targetMargin)) : null;
  const pmr = requiredRepasse !== null ? findFirstPriceForRepasse(requiredRepasse, commonInput) : null;

  const baseline = calculateRepasse({ ...commonInput, unitPrice: Math.max(0, input.baselinePrice || 0) });
  const baselineContribution = costTotal !== null ? round2(baseline.repasse - costTotal) : null;
  const currentContribution = costTotal !== null ? round2(result.repasse - costTotal) : null;
  const tceBe = baselineContribution !== null && currentContribution !== null && currentContribution > 0
    ? 1 - (baselineContribution / currentContribution)
    : null;

  return {
    commonInput,
    result,
    volumePhysical,
    absorptionPct,
    reu,
    costTotal,
    marginCurrent,
    previousWall,
    nextWall,
    recovery,
    isDominated,
    targetMargin,
    requiredRepasse,
    pmr,
    baseline,
    baselineContribution,
    currentContribution,
    tceBe,
    tsiBand: getTsiBand(agreedPrice),
  };
}
