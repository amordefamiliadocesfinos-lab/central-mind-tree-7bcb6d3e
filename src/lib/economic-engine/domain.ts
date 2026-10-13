export const ECONOMIC_BLOCKS = [
  'B1',
  'B2',
  'B3',
  'B4',
  'B5',
  'B6',
  'B7',
  'B8',
  'B9',
] as const;

export type EconomicBlock = typeof ECONOMIC_BLOCKS[number];

export const ECONOMIC_LEVELS = [
  'N0',
  'N1',
  'N2',
  'N3',
  'N4',
  'N5',
  'N6',
  'N7',
] as const;

export type EconomicLevel = typeof ECONOMIC_LEVELS[number];

export type EconomicCostState =
  | 'APPLICABLE_WITH_VALUE'
  | 'APPLICABLE_VALUE_PENDING'
  | 'METHODOLOGY_PENDING'
  | 'PROVEN_ZERO'
  | 'NOT_APPLICABLE'
  | 'HISTORICAL_REVALIDATE';

export type EconomicKnowledgeState =
  | 'KNOWN'
  | 'UNKNOWN'
  | 'NOT_APPLICABLE';

export type EconomicNumericNature =
  | 'PROVEN'
  | 'OBSERVED_CURRENT'
  | 'OBSERVED_HISTORICAL'
  | 'DERIVED'
  | 'ESTIMATED'
  | 'SIMULATED'
  | 'PROMOTIONAL'
  | 'FUTURE_UNDEFINED'
  | 'HOMOLOGATED';

export type EconomicIncidence =
  | 'I-U'
  | 'I-A'
  | 'I-P'
  | 'I-V'
  | 'I-R'
  | 'I-T'
  | 'I-C'
  | 'I-M'
  | 'I-H'
  | 'I-E'
  | 'I-Q';

export type EconomicEffect =
  | 'COST'
  | 'RECOVERY'
  | 'BENEFIT';

export type EconomicCompleteness =
  | 'COMPLETE'
  | 'PARTIAL'
  | 'BLOCKED';

export type EconomicConfidence =
  | 'high'
  | 'medium'
  | 'low'
  | 'unknown';

export type EconomicComponent = {
  id: string;
  /**
   * Stable identity of the underlying economic fact/resource.
   * Reusing the same key twice in one composition is treated as a
   * potential double count and blocks the result.
   */
  economicKey: string;
  block: EconomicBlock;
  subcategory?: string | null;
  itemCode?: string | null;
  itemName: string;

  amount: number | null;
  currency?: string;
  unit?: string | null;

  effect?: EconomicEffect;
  numericNature: EconomicNumericNature;
  costState: EconomicCostState;
  knowledgeState: EconomicKnowledgeState;

  incidence: EconomicIncidence;
  nativeGrain?: string | null;
  driver?: string | null;
  quantity?: number | null;
  conversionFactor?: number | null;

  scope?: string | null;
  applicability?: string | null;

  sourceDomain: string;
  sourceEntity?: string | null;
  sourceId?: string | null;
  evidenceIds?: string[];

  observedAt?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  ruleVersion?: string | null;
  confidence?: EconomicConfidence;
  notes?: string | null;
};

export type EconomicRevenueInput = {
  amount: number | null;
  currency?: string;
  numericNature: EconomicNumericNature;
  sourceDomain: string;
  sourceEntity?: string | null;
  sourceId?: string | null;
  evidenceIds?: string[];
};

export type EconomicValidationIssue = {
  componentId: string;
  code:
    | 'MISSING_ECONOMIC_KEY'
    | 'INVALID_AMOUNT'
    | 'KNOWN_REQUIRES_VALUE'
    | 'UNKNOWN_MUST_NOT_BE_COUNTED'
    | 'PROVEN_ZERO_REQUIRES_ZERO'
    | 'NOT_APPLICABLE_STATE_MISMATCH'
    | 'DUPLICATE_ECONOMIC_KEY';
  message: string;
};

export type EconomicBlockSummary = {
  block: EconomicBlock;
  grossCost: number;
  recoveriesAndBenefits: number;
  knownNetAmount: number;
  amount: number | null;
  completeness: EconomicCompleteness;
  countedComponentIds: string[];
  pendingComponentIds: string[];
  blockedComponentIds: string[];
  warnings: string[];
};

export type EconomicLevelSummary = {
  level: Exclude<EconomicLevel, 'N0'>;
  includedBlocks: EconomicBlock[];
  knownNetCost: number;
  amount: number | null;
  completeness: EconomicCompleteness;
  pendingBlocks: EconomicBlock[];
  blockedBlocks: EconomicBlock[];
};

export type EconomicContributionSummary = {
  revenueAmount: number | null;
  knownDirectCost: number;
  knownContribution: number | null;
  amount: number | null;
  completeness: EconomicCompleteness;
};

export type EconomicStructuralSummary = {
  knownContribution: number | null;
  knownOverheadAndCapital: number;
  knownStructuralResult: number | null;
  amount: number | null;
  completeness: EconomicCompleteness;
};

export type EconomicCompositionInput = {
  components: EconomicComponent[];
  revenue?: EconomicRevenueInput | null;
};

export type EconomicCompositionResult = {
  components: EconomicComponent[];
  blocks: Record<EconomicBlock, EconomicBlockSummary>;
  levels: Record<'N1' | 'N2' | 'N3' | 'N4' | 'N5', EconomicLevelSummary>;
  contribution: EconomicContributionSummary;
  structural: EconomicStructuralSummary;
  completeness: EconomicCompleteness;
  validationIssues: EconomicValidationIssue[];
  duplicateEconomicKeys: string[];
  pendingComponentIds: string[];
  blockedComponentIds: string[];
};
