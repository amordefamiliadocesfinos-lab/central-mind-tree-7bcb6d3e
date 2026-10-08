export type RegimeConfidence = 'high' | 'medium' | 'low';

export type HistoricalRegime = {
  id: string;
  accountName: string;
  commissionPct: number;
  transactionPct: number;
  servicePct: number;
  observedFrom: string;
  observedTo: string;
  note: string;
};

export type ResolveHistoricalRegimeInput = {
  accountName: string | null | undefined;
  effectiveAt: string;
  presentationFactor?: number | null;
  offerKey?: string | null;
};

export type HistoricalRegimeResolution = {
  regime: HistoricalRegime | null;
  confidence: RegimeConfidence;
  missing: Array<'account' | 'offer' | 'validity'>;
  warnings: string[];
  matchedBy: Array<'account' | 'validity' | 'presentation' | 'offer'>;
};

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');

export const HISTORICAL_SHOPEE_REGIMES: HistoricalRegime[] = [
  {
    id: 'shopee-adao-2026-07-02_2026-10-02',
    accountName: 'Adão',
    commissionPct: 12,
    transactionPct: 2,
    servicePct: 3.5,
    observedFrom: '2026-07-02',
    observedTo: '2026-10-02',
    note: 'Regime estrutural histórico observado. Ads Fácil não foi observado no recorte recente utilizado.',
  },
  {
    id: 'shopee-viviane-2026-07-02_2026-10-02',
    accountName: 'Viviane',
    commissionPct: 12,
    transactionPct: 2,
    servicePct: 3.5,
    observedFrom: '2026-07-02',
    observedTo: '2026-10-02',
    note: 'Regime estrutural histórico observado. Devolução Fácil e Afiliado apareceram em parte do histórico.',
  },
  {
    id: 'shopee-priscila-2026-07-02_2026-10-02',
    accountName: 'Priscila',
    commissionPct: 12,
    transactionPct: 2,
    servicePct: 3.5,
    observedFrom: '2026-07-02',
    observedTo: '2026-10-02',
    note: 'Regime estrutural histórico observado. Recarga e Devolução Fácil apareceram; Ads Fácil mudou ao longo do período.',
  },
  {
    id: 'shopee-neto-2026-07-02_2026-10-02',
    accountName: 'Neto',
    commissionPct: 12,
    transactionPct: 2,
    servicePct: 3.5,
    observedFrom: '2026-07-02',
    observedTo: '2026-10-02',
    note: 'Regime estrutural histórico observado. Recarga e Devolução Fácil apareceram; Ads Fácil mudou ao longo do período.',
  },
];

export function resolveHistoricalShopeeRegime(
  input: ResolveHistoricalRegimeInput,
): HistoricalRegimeResolution {
  const missing: HistoricalRegimeResolution['missing'] = [];
  const warnings: string[] = [];
  const matchedBy: HistoricalRegimeResolution['matchedBy'] = [];

  if (!input.accountName?.trim()) {
    return {
      regime: null,
      confidence: 'low',
      missing: ['account', 'offer', 'validity'],
      warnings: ['Conta canônica ainda não selecionada.'],
      matchedBy: [],
    };
  }

  const regime = HISTORICAL_SHOPEE_REGIMES.find(
    (item) => normalize(item.accountName) === normalize(input.accountName!),
  ) ?? null;

  if (!regime) {
    return {
      regime: null,
      confidence: 'low',
      missing: ['offer', 'validity'],
      warnings: ['Não existe regime histórico congelado para esta conta. Informe parâmetros somente com evidência.'],
      matchedBy: ['account'],
    };
  }

  matchedBy.push('account');

  const effectiveDate = input.effectiveAt?.slice(0, 10);
  const withinObservedWindow = Boolean(
    effectiveDate &&
    effectiveDate >= regime.observedFrom &&
    effectiveDate <= regime.observedTo,
  );

  if (withinObservedWindow) {
    matchedBy.push('validity');
  } else {
    missing.push('validity');
    warnings.push(
      'Data fora da janela observada (' + regime.observedFrom + ' a ' + regime.observedTo + '). O regime é apenas referência histórica.',
    );
  }

  if (input.presentationFactor === 36) {
    matchedBy.push('presentation');
  }

  if (input.offerKey) {
    matchedBy.push('offer');
  } else {
    missing.push('offer');
    warnings.push('Oferta ainda não resolvida. A confiança não pode ser alta antes da E5.');
  }

  const confidence: RegimeConfidence = input.offerKey && withinObservedWindow
    ? 'high'
    : withinObservedWindow
      ? 'medium'
      : 'low';

  return {
    regime,
    confidence,
    missing,
    warnings,
    matchedBy,
  };
}