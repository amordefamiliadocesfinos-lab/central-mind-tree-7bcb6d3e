import type { EconomicComponent } from './domain';
import type { ChannelAdapterResult } from './channelAdapter';

export type ShopeeTsiBand = {
  minInclusive: number;
  maxExclusive: number | null;
  amount: number;
  label: string;
};

export type ShopeeChannelPolicy = {
  commissionPct: number;
  transactionPct: number;
  servicePct: number;
  tsiBands: ShopeeTsiBand[];
  walls: number[];
};

export type ShopeeAdapterInput = {
  channelAccountId: string | null;
  offerMappingId: string | null;
  unitPrice: number;
  q: number;
  presentation: number;

  adsPct: number;
  affiliatePct: number;
  retMCharges: number;
  retMBenefits: number;

  costPerUnit: number;
  targetMarginPct: number;
  baselinePrice: number;

  policy: ShopeeChannelPolicy;
  rule: {
    engineVersion: string;
    ruleVersion: string | null;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    sourceRefs: string[];
    confidence: 'high' | 'medium' | 'low';
    warnings: string[];
  };
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function sortedBands(policy: ShopeeChannelPolicy) {
  return [...policy.tsiBands].sort((a, b) => a.minInclusive - b.minInclusive);
}

export function resolveShopeeTsiBand(unitPrice: number, policy: ShopeeChannelPolicy) {
  const bands = sortedBands(policy);
  const match = bands.find((band) =>
    unitPrice >= band.minInclusive &&
    (band.maxExclusive === null || unitPrice < band.maxExclusive)
  );
  return match ?? null;
}

function calculateRepasse(
  unitPrice: number,
  q: number,
  policy: ShopeeChannelPolicy,
  adsPct: number,
  affiliatePct: number,
  retMCharges: number,
  retMBenefits: number,
) {
  const ticket = round2(unitPrice * q);
  const commission = round2(ticket * (clamp(policy.commissionPct, 0, 100) / 100));
  const transaction = round2(ticket * (clamp(policy.transactionPct, 0, 100) / 100));
  const serviceAdditional = round2(ticket * (clamp(policy.servicePct, 0, 100) / 100));
  const adsEasy = round2(ticket * (clamp(adsPct, 0, 100) / 100));
  const affiliate = round2(ticket * (clamp(affiliatePct, 0, 100) / 100));

  const tsiBand = resolveShopeeTsiBand(unitPrice, policy);
  const tsiUnit = tsiBand?.amount ?? 0;
  const tsiTotal = round2(tsiUnit * q);

  const serviceTotal = round2(transaction + serviceAdditional + adsEasy + tsiTotal);
  const retMChargesTotal = round2(affiliate + Math.max(0, retMCharges || 0));
  const retMBenefitsTotal = round2(Math.max(0, retMBenefits || 0));
  const repasse = round2(ticket - commission - serviceTotal - retMChargesTotal + retMBenefitsTotal);
  const shopeeAbsorption = round2(ticket - repasse);

  return {
    ticket,
    commission,
    transaction,
    serviceAdditional,
    adsEasy,
    affiliate,
    tsiBand,
    tsiUnit,
    tsiTotal,
    serviceTotal,
    retMChargesTotal,
    retMBenefitsTotal,
    repasse,
    shopeeAbsorption,
  };
}

function previousWall(unitPrice: number, policy: ShopeeChannelPolicy) {
  const walls = [...policy.walls].sort((a, b) => a - b);
  return [...walls].reverse().find((wall) => unitPrice >= wall) ?? null;
}

function nextWall(unitPrice: number, policy: ShopeeChannelPolicy) {
  return [...policy.walls].sort((a, b) => a - b).find((wall) => unitPrice < wall) ?? null;
}

function upperBoundForWall(wall: number, policy: ShopeeChannelPolicy) {
  const next = nextWall(wall, policy);
  return next ? round2(next - 0.01) : 5000;
}

function findRecoveryPrice(
  wall: number,
  q: number,
  policy: ShopeeChannelPolicy,
  adsPct: number,
  affiliatePct: number,
  retMCharges: number,
  retMBenefits: number,
) {
  const preWallPrice = round2(wall - 0.01);
  const preWallRepasse = calculateRepasse(
    preWallPrice, q, policy, adsPct, affiliatePct, retMCharges, retMBenefits,
  ).repasse;
  const upper = upperBoundForWall(wall, policy);

  const valueAt = (price: number) =>
    calculateRepasse(price, q, policy, adsPct, affiliatePct, retMCharges, retMBenefits).repasse;

  if (valueAt(upper) + 0.0001 < preWallRepasse) return null;

  let lo = Math.round(wall * 100);
  let hi = Math.round(upper * 100);
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const price = mid / 100;
    if (valueAt(price) + 0.0001 >= preWallRepasse) hi = mid;
    else lo = mid + 1;
  }

  return { wall, preWallPrice, preWallRepasse, recoveryPrice: lo / 100 };
}

function findFirstPriceForRepasse(
  targetRepasse: number,
  q: number,
  policy: ShopeeChannelPolicy,
  adsPct: number,
  affiliatePct: number,
  retMCharges: number,
  retMBenefits: number,
) {
  if (!Number.isFinite(targetRepasse) || targetRepasse <= 0) return null;

  const bands = sortedBands(policy);
  const searchBands = bands.map((band) => ({
    min: Math.max(0.01, band.minInclusive),
    max: band.maxExclusive === null ? 5000 : round2(band.maxExclusive - 0.01),
  }));

  const valueAt = (price: number) =>
    calculateRepasse(price, q, policy, adsPct, affiliatePct, retMCharges, retMBenefits).repasse;

  for (const band of searchBands) {
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

function b5Components(input: ShopeeAdapterInput, result: ReturnType<typeof calculateRepasse>): EconomicComponent[] {
  const ruleKey = input.rule.ruleVersion ?? 'unversioned';
  const base = {
    currency: 'BRL',
    unit: 'transacao',
    incidence: 'I-C' as const,
    sourceDomain: 'Precificação/Canal',
    sourceEntity: 'economic_rule_versions',
    ruleVersion: input.rule.ruleVersion,
    confidence: input.rule.confidence,
    effectiveFrom: input.rule.effectiveFrom,
    effectiveTo: input.rule.effectiveTo,
  };

  const components: EconomicComponent[] = [
    {
      id: 'b5:commission:' + ruleKey,
      economicKey: 'b5:shopee:commission:' + ruleKey,
      block: 'B5',
      subcategory: 'B5.1',
      itemName: 'Comissão Shopee',
      amount: result.commission,
      effect: 'COST',
      numericNature: 'SIMULATED',
      costState: 'APPLICABLE_WITH_VALUE',
      knowledgeState: 'KNOWN',
      ...base,
    },
    {
      id: 'b5:transaction:' + ruleKey,
      economicKey: 'b5:shopee:transaction:' + ruleKey,
      block: 'B5',
      subcategory: 'B5.3',
      itemName: 'Taxa transacional Shopee',
      amount: result.transaction,
      effect: 'COST',
      numericNature: 'SIMULATED',
      costState: 'APPLICABLE_WITH_VALUE',
      knowledgeState: 'KNOWN',
      ...base,
    },
    {
      id: 'b5:service:' + ruleKey,
      economicKey: 'b5:shopee:service:' + ruleKey,
      block: 'B5',
      subcategory: 'B5.3',
      itemName: 'Serviço adicional Shopee',
      amount: result.serviceAdditional,
      effect: 'COST',
      numericNature: 'SIMULATED',
      costState: 'APPLICABLE_WITH_VALUE',
      knowledgeState: 'KNOWN',
      ...base,
    },
    {
      id: 'b5:tsi:' + ruleKey,
      economicKey: 'b5:shopee:tsi:' + ruleKey + ':' + (result.tsiBand?.label ?? 'unknown'),
      block: 'B5',
      subcategory: 'B5.2',
      itemName: 'TSI Shopee',
      amount: result.tsiTotal,
      effect: 'COST',
      numericNature: 'SIMULATED',
      costState: result.tsiBand ? 'APPLICABLE_WITH_VALUE' : 'APPLICABLE_VALUE_PENDING',
      knowledgeState: result.tsiBand ? 'KNOWN' : 'UNKNOWN',
      ...base,
      notes: result.tsiBand ? result.tsiBand.label + ' · ' + result.tsiUnit + ' × Q' : 'Faixa TSI não resolvida pela regra.',
    },
  ];

  if (result.adsEasy > 0) {
    components.push({
      id: 'b5:ads:' + ruleKey,
      economicKey: 'b5:shopee:ads:' + ruleKey,
      block: 'B5',
      subcategory: 'B5.4',
      itemName: 'Ads atribuível Shopee',
      amount: result.adsEasy,
      effect: 'COST',
      numericNature: 'SIMULATED',
      costState: 'APPLICABLE_WITH_VALUE',
      knowledgeState: 'KNOWN',
      ...base,
    });
  }

  if (result.affiliate > 0) {
    components.push({
      id: 'b5:affiliate:' + ruleKey,
      economicKey: 'b5:shopee:affiliate:' + ruleKey,
      block: 'B5',
      subcategory: 'B5.5',
      itemName: 'Afiliado Shopee',
      amount: result.affiliate,
      effect: 'COST',
      numericNature: 'SIMULATED',
      costState: 'APPLICABLE_WITH_VALUE',
      knowledgeState: 'KNOWN',
      ...base,
    });
  }

  if (input.retMCharges > 0) {
    components.push({
      id: 'b5:retm-charge:' + ruleKey,
      economicKey: 'b5:shopee:retm-charge:' + ruleKey,
      block: 'B5',
      subcategory: 'B5.8',
      itemName: 'Outros custos Shopee / RET-M',
      amount: Math.max(0, input.retMCharges),
      effect: 'COST',
      numericNature: 'SIMULATED',
      costState: 'APPLICABLE_WITH_VALUE',
      knowledgeState: 'KNOWN',
      ...base,
    });
  }

  if (input.retMBenefits > 0) {
    components.push({
      id: 'b5:retm-benefit:' + ruleKey,
      economicKey: 'b5:shopee:retm-benefit:' + ruleKey,
      block: 'B5',
      subcategory: 'B5.7',
      itemName: 'Benefícios / subsídios Shopee',
      amount: Math.max(0, input.retMBenefits),
      effect: 'BENEFIT',
      numericNature: 'SIMULATED',
      costState: 'APPLICABLE_WITH_VALUE',
      knowledgeState: 'KNOWN',
      ...base,
    });
  }

  return components;
}

export function calculateShopeeAdapterScenario(input: ShopeeAdapterInput): ChannelAdapterResult<{
  result: ReturnType<typeof calculateRepasse>;
  volumePhysical: number;
  absorptionPct: number;
  reu: number;
  costTotal: number | null;
  marginCurrent: number | null;
  previousWall: number | null;
  nextWall: number | null;
  recovery: ReturnType<typeof findRecoveryPrice>;
  isDominated: boolean;
  requiredRepasse: number | null;
  pmr: number | null;
  baseline: ReturnType<typeof calculateRepasse>;
  baselineContribution: number | null;
  currentContribution: number | null;
  tceBe: number | null;
}> {
  const q = Math.max(1, Math.floor(input.q || 1));
  const result = calculateRepasse(
    Math.max(0, input.unitPrice || 0),
    q,
    input.policy,
    input.adsPct,
    input.affiliatePct,
    input.retMCharges,
    input.retMBenefits,
  );

  const volumePhysical = Math.max(0, input.presentation || 0) * q;
  const absorptionPct = result.ticket > 0 ? result.shopeeAbsorption / result.ticket : 0;
  const reu = volumePhysical > 0 ? result.repasse / volumePhysical : 0;
  const costTotal = input.costPerUnit > 0 ? round2(input.costPerUnit * volumePhysical) : null;
  const marginCurrent = costTotal !== null && result.repasse > 0
    ? (result.repasse - costTotal) / result.repasse
    : null;

  const prevWall = previousWall(input.unitPrice, input.policy);
  const nxtWall = nextWall(input.unitPrice, input.policy);
  const recovery = prevWall
    ? findRecoveryPrice(prevWall, q, input.policy, input.adsPct, input.affiliatePct, input.retMCharges, input.retMBenefits)
    : null;

  const isDominated = Boolean(
    recovery &&
    input.unitPrice >= recovery.wall &&
    input.unitPrice < recovery.recoveryPrice &&
    result.repasse + 0.0001 < recovery.preWallRepasse,
  );

  const targetMargin = clamp((input.targetMarginPct || 0) / 100, 0, 0.95);
  const requiredRepasse = costTotal !== null ? round2(costTotal / (1 - targetMargin)) : null;
  const pmr = requiredRepasse !== null
    ? findFirstPriceForRepasse(requiredRepasse, q, input.policy, input.adsPct, input.affiliatePct, input.retMCharges, input.retMBenefits)
    : null;

  const baseline = calculateRepasse(
    Math.max(0, input.baselinePrice || 0),
    q,
    input.policy,
    input.adsPct,
    input.affiliatePct,
    input.retMCharges,
    input.retMBenefits,
  );

  const baselineContribution = costTotal !== null ? round2(baseline.repasse - costTotal) : null;
  const currentContribution = costTotal !== null ? round2(result.repasse - costTotal) : null;
  const tceBe = baselineContribution !== null && currentContribution !== null && currentContribution > 0
    ? 1 - (baselineContribution / currentContribution)
    : null;

  return {
    meta: {
      adapter: 'shopee',
      marketplace: 'shopee',
      channelAccountId: input.channelAccountId,
      offerMappingId: input.offerMappingId,
      rule: {
        engineVersion: input.rule.engineVersion,
        ruleVersion: input.rule.ruleVersion,
        effectiveFrom: input.rule.effectiveFrom,
        effectiveTo: input.rule.effectiveTo,
        sourceRefs: input.rule.sourceRefs,
      },
      warnings: input.rule.warnings,
      confidence: input.rule.confidence,
    },
    components: b5Components(input, result),
    scenario: {
      result,
      volumePhysical,
      absorptionPct,
      reu,
      costTotal,
      marginCurrent,
      previousWall: prevWall,
      nextWall: nxtWall,
      recovery,
      isDominated,
      requiredRepasse,
      pmr,
      baseline,
      baselineContribution,
      currentContribution,
      tceBe,
    },
  };
}
