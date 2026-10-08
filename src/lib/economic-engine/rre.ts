export type RegimeConfidence = 'high' | 'medium' | 'low';

export type EconomicRuleEvidenceInput = {
  id: string;
  sourceRef: string;
  evidenceType: string;
  observedFrom: string | null;
  observedTo: string | null;
  offerMappingId: string | null;
  isOfferSpecific: boolean;
};

export type EconomicRuleCandidate = {
  id: string;
  engineVersion: string;
  ruleVersion: string;
  channelAccountId: string | null;
  offerMappingId: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  parameters: Record<string, unknown>;
  sourceSummary: string | null;
  evidence: EconomicRuleEvidenceInput[];
};

export type ResolvedHistoricalRegime = {
  id: string;
  engineVersion: string;
  ruleVersion: string;
  commissionPct: number;
  transactionPct: number;
  servicePct: number;
  observedFrom: string;
  observedTo: string | null;
  note: string;
  sourceRefs: string[];
  offerSpecific: boolean;
};

export type ResolveHistoricalRegimeInput = {
  rules: EconomicRuleCandidate[];
  channelAccountId: string | null | undefined;
  effectiveAt: string;
  presentationFactor?: number | null;
  offerMappingId?: string | null;
};

export type HistoricalRegimeResolution = {
  regime: ResolvedHistoricalRegime | null;
  confidence: RegimeConfidence;
  missing: Array<'account' | 'offer' | 'offer_evidence' | 'validity' | 'rule'>;
  warnings: string[];
  matchedBy: Array<'account' | 'validity' | 'presentation' | 'offer' | 'offer_evidence' | 'rule_version'>;
};

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isWithinValidity(rule: EconomicRuleCandidate, effectiveDate: string) {
  return Boolean(
    effectiveDate &&
    effectiveDate >= rule.effectiveFrom &&
    (!rule.effectiveTo || effectiveDate <= rule.effectiveTo),
  );
}

function hasOfferSpecificEvidence(rule: EconomicRuleCandidate, offerMappingId: string | null | undefined) {
  if (!offerMappingId) return false;
  return rule.evidence.some((evidence) =>
    evidence.isOfferSpecific &&
    evidence.offerMappingId === offerMappingId,
  );
}

function sortCandidates(
  rules: EconomicRuleCandidate[],
  effectiveDate: string,
  offerMappingId: string | null | undefined,
) {
  return [...rules].sort((a, b) => {
    const aValid = isWithinValidity(a, effectiveDate) ? 1 : 0;
    const bValid = isWithinValidity(b, effectiveDate) ? 1 : 0;
    if (aValid !== bValid) return bValid - aValid;

    const aOffer = offerMappingId && a.offerMappingId === offerMappingId ? 1 : 0;
    const bOffer = offerMappingId && b.offerMappingId === offerMappingId ? 1 : 0;
    if (aOffer !== bOffer) return bOffer - aOffer;

    const aEvidence = hasOfferSpecificEvidence(a, offerMappingId) ? 1 : 0;
    const bEvidence = hasOfferSpecificEvidence(b, offerMappingId) ? 1 : 0;
    if (aEvidence !== bEvidence) return bEvidence - aEvidence;

    return b.effectiveFrom.localeCompare(a.effectiveFrom);
  });
}

export function resolveHistoricalShopeeRegime(
  input: ResolveHistoricalRegimeInput,
): HistoricalRegimeResolution {
  const missing: HistoricalRegimeResolution['missing'] = [];
  const warnings: string[] = [];
  const matchedBy: HistoricalRegimeResolution['matchedBy'] = [];

  if (!input.channelAccountId) {
    return {
      regime: null,
      confidence: 'low',
      missing: ['account', 'offer', 'offer_evidence', 'validity', 'rule'],
      warnings: ['Conta canônica ainda não selecionada.'],
      matchedBy: [],
    };
  }

  matchedBy.push('account');

  const accountRules = input.rules.filter((rule) =>
    rule.channelAccountId === input.channelAccountId &&
    (
      rule.offerMappingId === null ||
      rule.offerMappingId === input.offerMappingId
    ),
  );

  if (accountRules.length === 0) {
    return {
      regime: null,
      confidence: 'low',
      missing: ['rule', 'offer_evidence', 'validity'],
      warnings: ['Nenhuma regra econômica versionada foi encontrada para esta conta.'],
      matchedBy,
    };
  }

  const effectiveDate = input.effectiveAt?.slice(0, 10);
  const sorted = sortCandidates(accountRules, effectiveDate, input.offerMappingId);
  const rule = sorted[0];
  matchedBy.push('rule_version');

  const commissionPct = asNumber(rule.parameters.commissionPct);
  const transactionPct = asNumber(rule.parameters.transactionPct);
  const servicePct = asNumber(rule.parameters.servicePct);

  if (commissionPct === null || transactionPct === null || servicePct === null) {
    return {
      regime: null,
      confidence: 'low',
      missing: ['rule'],
      warnings: ['A regra econômica encontrada está incompleta e não pode ser aplicada.'],
      matchedBy,
    };
  }

  const withinObservedWindow = isWithinValidity(rule, effectiveDate);
  if (withinObservedWindow) {
    matchedBy.push('validity');
  } else {
    missing.push('validity');
    warnings.push(
      'Data fora da vigência da regra (' +
      rule.effectiveFrom +
      ' a ' +
      (rule.effectiveTo ?? 'aberta') +
      '). A regra permanece somente como referência histórica.',
    );
  }

  if (input.presentationFactor === 36) {
    matchedBy.push('presentation');
  }

  if (input.offerMappingId) {
    matchedBy.push('offer');
  } else {
    missing.push('offer');
    warnings.push('Oferta ainda não resolvida.');
  }

  const offerEvidenceMatched = hasOfferSpecificEvidence(rule, input.offerMappingId);
  if (offerEvidenceMatched) {
    matchedBy.push('offer_evidence');
  } else {
    missing.push('offer_evidence');
    if (input.offerMappingId) {
      warnings.push('Oferta resolvida no cadastro, mas ainda sem evidência histórica específica vinculada à regra.');
    }
  }

  const exactOfferRule = Boolean(
    input.offerMappingId &&
    rule.offerMappingId === input.offerMappingId,
  );

  const confidence: RegimeConfidence =
    withinObservedWindow && exactOfferRule && offerEvidenceMatched
      ? 'high'
      : withinObservedWindow
        ? 'medium'
        : 'low';

  const sourceRefs = [...new Set(rule.evidence.map((evidence) => evidence.sourceRef))];

  return {
    regime: {
      id: rule.id,
      engineVersion: rule.engineVersion,
      ruleVersion: rule.ruleVersion,
      commissionPct,
      transactionPct,
      servicePct,
      observedFrom: rule.effectiveFrom,
      observedTo: rule.effectiveTo,
      note: rule.sourceSummary ?? 'Regra econômica versionada sem resumo adicional.',
      sourceRefs,
      offerSpecific: exactOfferRule,
    },
    confidence,
    missing,
    warnings,
    matchedBy,
  };
}
