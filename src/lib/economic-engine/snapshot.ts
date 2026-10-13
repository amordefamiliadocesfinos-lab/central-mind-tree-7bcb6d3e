import { composeEconomicResult } from './composer';
import type { EconomicBlock, EconomicComponent, EconomicCompleteness } from './domain';

export const GENERAL_ECONOMIC_SNAPSHOT_SCHEMA_VERSION = '2.0.0';

export type EconomicBlockSnapshot = {
  block: EconomicBlock;
  knownNetAmount: number;
  amount: number | null;
  completeness: EconomicCompleteness;
  pendingComponentIds: string[];
  blockedComponentIds: string[];
};

export type GeneralEconomicSnapshot = {
  schemaVersion: string;
  components: EconomicComponent[];
  blocks: Record<EconomicBlock, EconomicBlockSnapshot>;
  levels: {
    N1: number | null;
    N2: number | null;
    N3: number | null;
    N4: number | null;
    N5: number | null;
  };
  completeness: EconomicCompleteness;
  pendingComponentIds: string[];
  blockedComponentIds: string[];
};

function pendingBlockComponent(block: EconomicBlock, reason: string): EconomicComponent {
  return {
    id: 'snapshot:pending:' + block,
    economicKey: 'snapshot:pending:' + block,
    block,
    subcategory: block + '.P',
    itemName: block + ' pendente',
    amount: null,
    currency: 'BRL',
    unit: 'escopo',
    effect: 'COST',
    numericNature: 'FUTURE_UNDEFINED',
    costState: 'APPLICABLE_VALUE_PENDING',
    knowledgeState: 'UNKNOWN',
    incidence: 'I-T',
    sourceDomain: 'Precificação',
    sourceEntity: 'snapshot',
    notes: reason,
  };
}

export function buildGeneralEconomicSnapshot(input: {
  components: EconomicComponent[];
  pendingBlocks?: Partial<Record<EconomicBlock, string>>;
}): GeneralEconomicSnapshot {
  const components = [...input.components];

  for (const [block, reason] of Object.entries(input.pendingBlocks ?? {}) as Array<[EconomicBlock, string]>) {
    if (!components.some((component) => component.block === block)) {
      components.push(pendingBlockComponent(block, reason));
    }
  }

  const composition = composeEconomicResult({ components });

  const blocks = Object.fromEntries(
    (Object.keys(composition.blocks) as EconomicBlock[]).map((block) => {
      const summary = composition.blocks[block];
      return [block, {
        block,
        knownNetAmount: summary.knownNetAmount,
        amount: summary.amount,
        completeness: summary.completeness,
        pendingComponentIds: summary.pendingComponentIds,
        blockedComponentIds: summary.blockedComponentIds,
      }];
    }),
  ) as Record<EconomicBlock, EconomicBlockSnapshot>;

  return {
    schemaVersion: GENERAL_ECONOMIC_SNAPSHOT_SCHEMA_VERSION,
    components,
    blocks,
    levels: {
      N1: composition.levels.N1.amount,
      N2: composition.levels.N2.amount,
      N3: composition.levels.N3.amount,
      N4: composition.levels.N4.amount,
      N5: composition.levels.N5.amount,
    },
    completeness: composition.completeness,
    pendingComponentIds: composition.pendingComponentIds,
    blockedComponentIds: composition.blockedComponentIds,
  };
}
