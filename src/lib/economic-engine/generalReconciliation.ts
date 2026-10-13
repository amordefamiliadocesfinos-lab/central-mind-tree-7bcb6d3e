import type { EconomicBlock } from './domain';
import type { EconomicBlockSnapshot, GeneralEconomicSnapshot } from './snapshot';

export type ObservedEconomicBlock = {
  block: EconomicBlock;
  amount: number | null;
  source: string;
  sourceIds?: string[];
  notes?: string[];
};

export type EconomicBlockComparison = {
  block: EconomicBlock;
  predictedAmount: number | null;
  predictedKnownAmount: number;
  observedAmount: number | null;
  delta: number | null;
  status: 'validated' | 'partial' | 'inconclusive';
  notes: string[];
};

export type GeneralEconomicReconciliation = {
  schemaVersion: '2.0.0';
  blocks: Record<EconomicBlock, EconomicBlockComparison>;
  validatedBlocks: EconomicBlock[];
  partialBlocks: EconomicBlock[];
  inconclusiveBlocks: EconomicBlock[];
  overall: 'validated' | 'partial' | 'inconclusive';
};

const BLOCKS: EconomicBlock[] = ['B1','B2','B3','B4','B5','B6','B7','B8','B9'];

const round6 = (value: number) =>
  Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;

function compareBlock(
  predicted: EconomicBlockSnapshot,
  observed: ObservedEconomicBlock | undefined,
): EconomicBlockComparison {
  const notes: string[] = [];
  if (predicted.completeness !== 'COMPLETE') {
    notes.push('Previsão do bloco não estava completa no snapshot.');
  }

  if (!observed || observed.amount === null || !Number.isFinite(observed.amount)) {
    notes.push('Fato observado suficiente ainda não disponível para este bloco.');
    return {
      block: predicted.block,
      predictedAmount: predicted.amount,
      predictedKnownAmount: predicted.knownNetAmount,
      observedAmount: null,
      delta: null,
      status: predicted.completeness === 'COMPLETE' ? 'partial' : 'inconclusive',
      notes,
    };
  }

  if (predicted.amount === null) {
    notes.push('Há fato observado, mas a previsão do bloco era incompleta.');
    return {
      block: predicted.block,
      predictedAmount: null,
      predictedKnownAmount: predicted.knownNetAmount,
      observedAmount: observed.amount,
      delta: null,
      status: 'partial',
      notes: [...notes, ...(observed.notes ?? [])],
    };
  }

  return {
    block: predicted.block,
    predictedAmount: predicted.amount,
    predictedKnownAmount: predicted.knownNetAmount,
    observedAmount: observed.amount,
    delta: round6(observed.amount - predicted.amount),
    status: 'validated',
    notes: observed.notes ?? [],
  };
}

export function reconcileGeneralEconomicSnapshot(
  predicted: GeneralEconomicSnapshot,
  observedBlocks: ObservedEconomicBlock[],
): GeneralEconomicReconciliation {
  const observedByBlock = new Map(observedBlocks.map((item) => [item.block, item]));

  const blocks = Object.fromEntries(
    BLOCKS.map((block) => [block, compareBlock(predicted.blocks[block], observedByBlock.get(block))]),
  ) as Record<EconomicBlock, EconomicBlockComparison>;

  const relevant = BLOCKS.filter((block) => !['B8','B9'].includes(block));
  const validatedBlocks = relevant.filter((block) => blocks[block].status === 'validated');
  const partialBlocks = relevant.filter((block) => blocks[block].status === 'partial');
  const inconclusiveBlocks = relevant.filter((block) => blocks[block].status === 'inconclusive');

  const overall =
    inconclusiveBlocks.length === 0 && partialBlocks.length === 0
      ? 'validated'
      : validatedBlocks.length > 0 || partialBlocks.length > 0
        ? 'partial'
        : 'inconclusive';

  return {
    schemaVersion: '2.0.0',
    blocks,
    validatedBlocks,
    partialBlocks,
    inconclusiveBlocks,
    overall,
  };
}
