import {
  ECONOMIC_BLOCKS,
  type EconomicBlock,
  type EconomicBlockSummary,
  type EconomicCompleteness,
  type EconomicComponent,
  type EconomicCompositionInput,
  type EconomicCompositionResult,
  type EconomicContributionSummary,
  type EconomicLevelSummary,
  type EconomicStructuralSummary,
  type EconomicValidationIssue,
} from './domain';

const LEVEL_BLOCKS: Record<'N1' | 'N2' | 'N3' | 'N4' | 'N5', EconomicBlock[]> = {
  N1: ['B1'],
  N2: ['B1', 'B2'],
  N3: ['B1', 'B2', 'B3'],
  N4: ['B1', 'B2', 'B3', 'B4', 'B5'],
  N5: ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'],
};

const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

function worstCompleteness(states: EconomicCompleteness[]): EconomicCompleteness {
  if (states.includes('BLOCKED')) return 'BLOCKED';
  if (states.includes('PARTIAL')) return 'PARTIAL';
  return 'COMPLETE';
}

function isFiniteNonNegative(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function validateEconomicComponent(
  component: EconomicComponent,
): EconomicValidationIssue[] {
  const issues: EconomicValidationIssue[] = [];

  if (!component.economicKey.trim()) {
    issues.push({
      componentId: component.id,
      code: 'MISSING_ECONOMIC_KEY',
      message: 'Componente econômico sem economicKey estável.',
    });
  }

  if (component.amount !== null && !isFiniteNonNegative(component.amount)) {
    issues.push({
      componentId: component.id,
      code: 'INVALID_AMOUNT',
      message: 'Valor econômico deve ser nulo ou número finito não negativo.',
    });
  }

  if (
    component.costState === 'APPLICABLE_WITH_VALUE' &&
    (component.knowledgeState !== 'KNOWN' || !isFiniteNonNegative(component.amount))
  ) {
    issues.push({
      componentId: component.id,
      code: 'KNOWN_REQUIRES_VALUE',
      message: 'APPLICABLE_WITH_VALUE exige estado KNOWN e valor conhecido.',
    });
  }

  if (
    component.knowledgeState === 'UNKNOWN' &&
    component.costState === 'APPLICABLE_WITH_VALUE'
  ) {
    issues.push({
      componentId: component.id,
      code: 'UNKNOWN_MUST_NOT_BE_COUNTED',
      message: 'UNKNOWN não pode ser contado como valor aplicável conhecido.',
    });
  }

  if (
    component.costState === 'PROVEN_ZERO' &&
    (component.knowledgeState !== 'KNOWN' || component.amount !== 0)
  ) {
    issues.push({
      componentId: component.id,
      code: 'PROVEN_ZERO_REQUIRES_ZERO',
      message: 'PROVEN_ZERO exige KNOWN e valor exatamente zero.',
    });
  }

  if (
    component.costState === 'NOT_APPLICABLE' &&
    component.knowledgeState !== 'NOT_APPLICABLE'
  ) {
    issues.push({
      componentId: component.id,
      code: 'NOT_APPLICABLE_STATE_MISMATCH',
      message: 'NOT_APPLICABLE deve usar knowledgeState NOT_APPLICABLE.',
    });
  }

  if (
    component.knowledgeState === 'NOT_APPLICABLE' &&
    component.costState !== 'NOT_APPLICABLE'
  ) {
    issues.push({
      componentId: component.id,
      code: 'NOT_APPLICABLE_STATE_MISMATCH',
      message: 'knowledgeState NOT_APPLICABLE deve usar costState NOT_APPLICABLE.',
    });
  }

  return issues;
}

function isCountable(component: EconomicComponent) {
  if (component.knowledgeState !== 'KNOWN') return false;
  return component.costState === 'APPLICABLE_WITH_VALUE' ||
    component.costState === 'PROVEN_ZERO';
}

function isPending(component: EconomicComponent) {
  if (component.costState === 'NOT_APPLICABLE') return false;
  if (component.knowledgeState === 'NOT_APPLICABLE') return false;

  return component.knowledgeState === 'UNKNOWN' ||
    component.costState === 'APPLICABLE_VALUE_PENDING' ||
    component.costState === 'METHODOLOGY_PENDING' ||
    component.costState === 'HISTORICAL_REVALIDATE';
}

function signedAmount(component: EconomicComponent) {
  if (!isCountable(component) || component.amount === null) return 0;
  if (component.effect === 'RECOVERY' || component.effect === 'BENEFIT') {
    return -component.amount;
  }
  return component.amount;
}

function summarizeBlock(
  block: EconomicBlock,
  components: EconomicComponent[],
  blockedIds: Set<string>,
): EconomicBlockSummary {
  const blockComponents = components.filter((component) => component.block === block);
  const countedComponentIds: string[] = [];
  const pendingComponentIds: string[] = [];
  const blockedComponentIds: string[] = [];
  const warnings: string[] = [];

  let grossCost = 0;
  let recoveriesAndBenefits = 0;

  for (const component of blockComponents) {
    if (blockedIds.has(component.id)) {
      blockedComponentIds.push(component.id);
      continue;
    }

    if (isPending(component)) {
      pendingComponentIds.push(component.id);
      continue;
    }

    if (!isCountable(component) || component.amount === null) continue;

    countedComponentIds.push(component.id);
    if (component.effect === 'RECOVERY' || component.effect === 'BENEFIT') {
      recoveriesAndBenefits += component.amount;
    } else {
      grossCost += component.amount;
    }
  }

  const completeness: EconomicCompleteness =
    blockedComponentIds.length > 0
      ? 'BLOCKED'
      : pendingComponentIds.length > 0
        ? 'PARTIAL'
        : 'COMPLETE';

  if (pendingComponentIds.length > 0) {
    warnings.push(
      `${pendingComponentIds.length} componente(s) pendente(s) em ${block}; total conhecido não é custo final.`,
    );
  }
  if (blockedComponentIds.length > 0) {
    warnings.push(
      `${blockedComponentIds.length} componente(s) bloqueado(s) em ${block}; resultado não deve ser usado como valor final.`,
    );
  }

  const knownNetAmount = roundMoney(grossCost - recoveriesAndBenefits);

  return {
    block,
    grossCost: roundMoney(grossCost),
    recoveriesAndBenefits: roundMoney(recoveriesAndBenefits),
    knownNetAmount,
    amount: completeness === 'COMPLETE' ? knownNetAmount : null,
    completeness,
    countedComponentIds,
    pendingComponentIds,
    blockedComponentIds,
    warnings,
  };
}

function summarizeLevel(
  level: 'N1' | 'N2' | 'N3' | 'N4' | 'N5',
  blocks: Record<EconomicBlock, EconomicBlockSummary>,
): EconomicLevelSummary {
  const includedBlocks = LEVEL_BLOCKS[level];
  const blockSummaries = includedBlocks.map((block) => blocks[block]);
  const completeness = worstCompleteness(blockSummaries.map((block) => block.completeness));
  const knownNetCost = roundMoney(
    blockSummaries.reduce((sum, block) => sum + block.knownNetAmount, 0),
  );

  return {
    level,
    includedBlocks,
    knownNetCost,
    amount: completeness === 'COMPLETE' ? knownNetCost : null,
    completeness,
    pendingBlocks: blockSummaries
      .filter((block) => block.completeness === 'PARTIAL')
      .map((block) => block.block),
    blockedBlocks: blockSummaries
      .filter((block) => block.completeness === 'BLOCKED')
      .map((block) => block.block),
  };
}

function summarizeContribution(
  n5: EconomicLevelSummary,
  revenueAmount: number | null,
): EconomicContributionSummary {
  const revenueKnown = typeof revenueAmount === 'number' && Number.isFinite(revenueAmount);

  if (!revenueKnown) {
    return {
      revenueAmount: null,
      knownDirectCost: n5.knownNetCost,
      knownContribution: null,
      amount: null,
      completeness: n5.completeness === 'BLOCKED' ? 'BLOCKED' : 'PARTIAL',
    };
  }

  const knownContribution = roundMoney(revenueAmount - n5.knownNetCost);
  const completeness = n5.completeness;

  return {
    revenueAmount,
    knownDirectCost: n5.knownNetCost,
    knownContribution,
    amount: completeness === 'COMPLETE' ? knownContribution : null,
    completeness,
  };
}

function summarizeStructural(
  contribution: EconomicContributionSummary,
  b8: EconomicBlockSummary,
  b9: EconomicBlockSummary,
): EconomicStructuralSummary {
  const structuralCompleteness = worstCompleteness([
    contribution.completeness,
    b8.completeness,
    b9.completeness,
  ]);
  const knownOverheadAndCapital = roundMoney(b8.knownNetAmount + b9.knownNetAmount);
  const knownStructuralResult =
    contribution.knownContribution === null
      ? null
      : roundMoney(contribution.knownContribution - knownOverheadAndCapital);

  return {
    knownContribution: contribution.knownContribution,
    knownOverheadAndCapital,
    knownStructuralResult,
    amount: structuralCompleteness === 'COMPLETE' ? knownStructuralResult : null,
    completeness: structuralCompleteness,
  };
}

export function composeEconomicResult(
  input: EconomicCompositionInput,
): EconomicCompositionResult {
  const validationIssues = input.components.flatMap(validateEconomicComponent);

  const byEconomicKey = new Map<string, EconomicComponent[]>();
  for (const component of input.components) {
    const key = component.economicKey.trim();
    if (!key || component.costState === 'NOT_APPLICABLE') continue;
    const list = byEconomicKey.get(key) ?? [];
    list.push(component);
    byEconomicKey.set(key, list);
  }

  const duplicateEconomicKeys = [...byEconomicKey.entries()]
    .filter(([, components]) => components.length > 1)
    .map(([key]) => key);

  const blockedIds = new Set<string>(
    validationIssues.map((issue) => issue.componentId),
  );

  for (const key of duplicateEconomicKeys) {
    const components = byEconomicKey.get(key) ?? [];
    for (const component of components) {
      blockedIds.add(component.id);
      validationIssues.push({
        componentId: component.id,
        code: 'DUPLICATE_ECONOMIC_KEY',
        message: `economicKey duplicada (${key}); componente bloqueado para impedir dupla contagem.`,
      });
    }
  }

  const blocks = Object.fromEntries(
    ECONOMIC_BLOCKS.map((block) => [
      block,
      summarizeBlock(block, input.components, blockedIds),
    ]),
  ) as Record<EconomicBlock, EconomicBlockSummary>;

  const levels = {
    N1: summarizeLevel('N1', blocks),
    N2: summarizeLevel('N2', blocks),
    N3: summarizeLevel('N3', blocks),
    N4: summarizeLevel('N4', blocks),
    N5: summarizeLevel('N5', blocks),
  };

  const revenueAmount =
    input.revenue &&
    typeof input.revenue.amount === 'number' &&
    Number.isFinite(input.revenue.amount)
      ? input.revenue.amount
      : null;

  const contribution = summarizeContribution(levels.N5, revenueAmount);
  const structural = summarizeStructural(contribution, blocks.B8, blocks.B9);

  const completeness = worstCompleteness([
    levels.N5.completeness,
    structural.completeness,
  ]);

  return {
    components: input.components,
    blocks,
    levels,
    contribution,
    structural,
    completeness,
    validationIssues,
    duplicateEconomicKeys,
    pendingComponentIds: input.components
      .filter(isPending)
      .map((component) => component.id),
    blockedComponentIds: [...blockedIds],
  };
}
