import type { EconomicBlock, EconomicCompleteness } from './domain';
import type { GeneralEconomicReconciliation } from './generalReconciliation';
import type { GeneralEconomicSnapshot } from './snapshot';

export type EconomicIntelligenceSeverity = 'info' | 'attention' | 'critical' | 'positive';

export type EconomicIntelligenceSignal = {
  id: string;
  kind: 'FACT' | 'RISK' | 'OPPORTUNITY' | 'GAP' | 'LEARNING';
  severity: EconomicIntelligenceSeverity;
  title: string;
  message: string;
  blocks: EconomicBlock[];
  metricValue?: number | null;
  metricUnit?: 'BRL' | 'PERCENT' | 'COUNT';
};

export type EconomicDecisionReadiness = 'READY' | 'CONDITIONAL' | 'BLOCKED';

export type EconomicIntelligenceContext = {
  channelConfidence?: 'high' | 'medium' | 'low' | 'unknown';
  channelWarnings?: string[];
  isDominated?: boolean;
  recoveryPrice?: number | null;
  currentPrice?: number | null;
  repasse?: number | null;
  ticket?: number | null;
  marginCurrent?: number | null;
};

export type EconomicIntelligenceReport = {
  readiness: EconomicDecisionReadiness;
  completeness: EconomicCompleteness;
  signals: EconomicIntelligenceSignal[];
  topKnownCostBlock: {
    block: EconomicBlock;
    amount: number;
  } | null;
  directKnownCost: number;
  contributionKnown: number | null;
  contributionMarginKnown: number | null;
  structuralResultKnown: number | null;
  pendingBlocks: EconomicBlock[];
  blockedBlocks: EconomicBlock[];
};

const DIRECT_BLOCKS: EconomicBlock[] = ['B1','B2','B3','B4','B5','B6','B7'];
const STRUCTURAL_BLOCKS: EconomicBlock[] = ['B8','B9'];

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function blockState(snapshot: GeneralEconomicSnapshot, block: EconomicBlock) {
  return snapshot.blocks[block]?.completeness ?? 'PARTIAL';
}

export function analyzeEconomicIntelligence(input: {
  snapshot: GeneralEconomicSnapshot;
  context?: EconomicIntelligenceContext;
  reconciliation?: GeneralEconomicReconciliation | null;
}): EconomicIntelligenceReport {
  const { snapshot } = input;
  const context = input.context ?? {};
  const signals: EconomicIntelligenceSignal[] = [];

  const blockedBlocks = (Object.keys(snapshot.blocks) as EconomicBlock[])
    .filter((block) => blockState(snapshot, block) === 'BLOCKED');
  const pendingBlocks = (Object.keys(snapshot.blocks) as EconomicBlock[])
    .filter((block) => blockState(snapshot, block) === 'PARTIAL');

  const directKnownCost = DIRECT_BLOCKS.reduce(
    (sum, block) => sum + (snapshot.blocks[block]?.knownNetAmount ?? 0),
    0,
  );

  const topKnownCostBlock = DIRECT_BLOCKS
    .map((block) => ({ block, amount: snapshot.blocks[block]?.knownNetAmount ?? 0 }))
    .sort((a, b) => b.amount - a.amount)[0] ?? null;

  const contributionKnown = snapshot.contribution.knownContribution;
  const revenueKnown =
    finite(contributionKnown)
      ? contributionKnown + directKnownCost
      : null;
  const contributionMarginKnown =
    finite(contributionKnown) && finite(revenueKnown) && revenueKnown > 0
      ? contributionKnown / revenueKnown
      : null;

  const structuralResultKnown = snapshot.structural.knownStructuralResult;

  if (blockedBlocks.length > 0) {
    signals.push({
      id: 'blocked-blocks',
      kind: 'RISK',
      severity: 'critical',
      title: 'Resultado econômico bloqueado',
      message: 'Existem blocos com inconsistência estrutural ou dupla contagem: ' + blockedBlocks.join(', ') + '.',
      blocks: blockedBlocks,
      metricValue: blockedBlocks.length,
      metricUnit: 'COUNT',
    });
  }

  const directPending = pendingBlocks.filter((block) => DIRECT_BLOCKS.includes(block));
  if (directPending.length > 0) {
    signals.push({
      id: 'direct-pending',
      kind: 'GAP',
      severity: 'attention',
      title: 'Custo direto ainda incompleto',
      message: 'A oferta ainda possui lacunas econômicas diretas em ' + directPending.join(', ') + '. O subtotal conhecido não deve ser tratado como custo final.',
      blocks: directPending,
      metricValue: directPending.length,
      metricUnit: 'COUNT',
    });
  }

  const structuralPending = pendingBlocks.filter((block) => STRUCTURAL_BLOCKS.includes(block));
  if (structuralPending.length > 0) {
    signals.push({
      id: 'structural-pending',
      kind: 'GAP',
      severity: 'info',
      title: 'Resultado estrutural ainda aberto',
      message: 'N6 pode ser analisado antes de overhead/capital, mas N7 depende de metodologia homologada para ' + structuralPending.join(', ') + '.',
      blocks: structuralPending,
      metricValue: structuralPending.length,
      metricUnit: 'COUNT',
    });
  }

  if (topKnownCostBlock && topKnownCostBlock.amount > 0 && directKnownCost > 0) {
    const share = topKnownCostBlock.amount / directKnownCost;
    signals.push({
      id: 'largest-cost-block',
      kind: 'FACT',
      severity: 'info',
      title: 'Maior bloco de custo conhecido',
      message: topKnownCostBlock.block + ' concentra aproximadamente ' + (share * 100).toFixed(1) + '% do custo direto conhecido.',
      blocks: [topKnownCostBlock.block],
      metricValue: share,
      metricUnit: 'PERCENT',
    });
  }

  if (finite(contributionKnown)) {
    signals.push({
      id: 'known-contribution',
      kind: contributionKnown >= 0 ? 'FACT' : 'RISK',
      severity: contributionKnown >= 0 ? 'positive' : 'critical',
      title: contributionKnown >= 0 ? 'Contribuição conhecida positiva' : 'Contribuição conhecida negativa',
      message: 'A contribuição conhecida antes de B8/B9 é R$ ' + contributionKnown.toFixed(2) + '.',
      blocks: DIRECT_BLOCKS,
      metricValue: contributionKnown,
      metricUnit: 'BRL',
    });
  }

  if (context.isDominated) {
    signals.push({
      id: 'price-dominance',
      kind: 'RISK',
      severity: 'critical',
      title: 'Preço em zona dominada',
      message:
        finite(context.recoveryPrice)
          ? 'O preço atual está em zona dominada. O PRE calculado é R$ ' + context.recoveryPrice!.toFixed(2) + '.'
          : 'O preço atual entrega menos repasse que uma alternativa imediatamente anterior à parede econômica.',
      blocks: ['B5'],
      metricValue: context.recoveryPrice ?? null,
      metricUnit: 'BRL',
    });
  }

  if (context.channelConfidence === 'low') {
    signals.push({
      id: 'channel-low-confidence',
      kind: 'GAP',
      severity: 'attention',
      title: 'Regra de canal com baixa confiança',
      message: 'A inteligência não deve homologar preço com regra de canal de baixa confiança ou fora da vigência sem nova evidência.',
      blocks: ['B5'],
    });
  }

  for (const warning of context.channelWarnings ?? []) {
    signals.push({
      id: 'channel-warning:' + warning,
      kind: 'GAP',
      severity: 'attention',
      title: 'Pendência de regra do canal',
      message: warning,
      blocks: ['B5'],
    });
  }

  if (input.reconciliation) {
    const deltas = DIRECT_BLOCKS
      .map((block) => input.reconciliation!.blocks[block])
      .filter((item) => item && finite(item.delta))
      .sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0));

    const largest = deltas[0];
    if (largest && largest.delta !== null && Math.abs(largest.delta) > 0.000001) {
      signals.push({
        id: 'largest-reconciliation-delta',
        kind: 'LEARNING',
        severity: 'attention',
        title: 'Maior desvio previsto × observado',
        message: largest.block + ' apresentou desvio de R$ ' + largest.delta.toFixed(2) + ' entre previsão e fato observado.',
        blocks: [largest.block],
        metricValue: largest.delta,
        metricUnit: 'BRL',
      });
    }

    if (input.reconciliation.overall === 'validated') {
      signals.push({
        id: 'reconciliation-validated',
        kind: 'LEARNING',
        severity: 'positive',
        title: 'Previsão reconciliada',
        message: 'Os blocos econômicos relevantes possuem comparação suficiente com fatos observados.',
        blocks: DIRECT_BLOCKS,
      });
    }
  }

  const readiness: EconomicDecisionReadiness =
    blockedBlocks.length > 0
      ? 'BLOCKED'
      : directPending.length > 0 || context.channelConfidence === 'low'
        ? 'CONDITIONAL'
        : 'READY';

  if (signals.length === 0) {
    signals.push({
      id: 'no-alerts',
      kind: 'FACT',
      severity: 'positive',
      title: 'Sem alerta econômico relevante',
      message: 'Não foram detectadas lacunas ou desvios relevantes dentro dos dados disponíveis.',
      blocks: [],
    });
  }

  return {
    readiness,
    completeness: snapshot.completeness,
    signals,
    topKnownCostBlock,
    directKnownCost,
    contributionKnown,
    contributionMarginKnown,
    structuralResultKnown,
    pendingBlocks,
    blockedBlocks,
  };
}
