import {
  resolveHistoricalShopeeRegime,
  type EconomicRuleCandidate,
} from './rre';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('economic-engine/rre.test: ' + message);
}

function equal(actual: unknown, expected: unknown, message: string) {
  assert(Object.is(actual, expected), message + ': esperado ' + String(expected) + ', recebido ' + String(actual));
}

const accountRule: EconomicRuleCandidate = {
  id: 'rule-account',
  engineVersion: '2.0.0',
  ruleVersion: 'account-v1',
  channelAccountId: 'account-1',
  offerMappingId: null,
  effectiveFrom: '2026-07-02',
  effectiveTo: '2026-10-02',
  parameters: {
    commissionPct: 12,
    transactionPct: 2,
    servicePct: 3.5,
  },
  sourceSummary: 'Regime histórico por conta.',
  evidence: [
    {
      id: 'evidence-account',
      sourceRef: 'MV2-12A',
      evidenceType: 'historical_observation',
      observedFrom: '2026-07-02',
      observedTo: '2026-10-02',
      offerMappingId: null,
      isOfferSpecific: false,
    },
  ],
};

const offerRule: EconomicRuleCandidate = {
  ...accountRule,
  id: 'rule-offer',
  ruleVersion: 'offer-v1',
  offerMappingId: 'offer-1',
  sourceSummary: 'Regime histórico específico da Oferta.',
  evidence: [
    {
      id: 'evidence-offer',
      sourceRef: 'future-offer-evidence',
      evidenceType: 'transaction_observation',
      observedFrom: '2026-09-01',
      observedTo: '2026-09-30',
      offerMappingId: 'offer-1',
      isOfferSpecific: true,
    },
  ],
};

const accountOnly = resolveHistoricalShopeeRegime({
  rules: [accountRule],
  channelAccountId: 'account-1',
  effectiveAt: '2026-09-15',
  presentationFactor: 36,
  offerMappingId: 'offer-1',
});
equal(accountOnly.regime?.commissionPct, 12, 'comissão deve vir dos parâmetros versionados');
equal(accountOnly.confidence, 'medium', 'regra de conta sem evidência específica não pode ser alta');
equal(accountOnly.regime?.ruleVersion, 'account-v1', 'versão da regra deve ser preservada');
assert(accountOnly.missing.includes('offer_evidence'), 'evidência específica deve permanecer pendente');

const exactOffer = resolveHistoricalShopeeRegime({
  rules: [accountRule, offerRule],
  channelAccountId: 'account-1',
  effectiveAt: '2026-09-15',
  presentationFactor: 36,
  offerMappingId: 'offer-1',
});
equal(exactOffer.confidence, 'high', 'regra exata de Oferta com evidência específica pode ser alta');
equal(exactOffer.regime?.id, 'rule-offer', 'regra específica da Oferta deve dominar regra genérica da conta');
assert(exactOffer.matchedBy.includes('offer_evidence'), 'evidência da Oferta deve ser explicitamente reconhecida');

const outsideWindow = resolveHistoricalShopeeRegime({
  rules: [accountRule],
  channelAccountId: 'account-1',
  effectiveAt: '2026-10-08',
  presentationFactor: 36,
  offerMappingId: 'offer-1',
});
equal(outsideWindow.confidence, 'low', 'fora da vigência a confiança deve ser baixa');
assert(outsideWindow.missing.includes('validity'), 'vigência deve ficar pendente fora da janela');

const unknownAccount = resolveHistoricalShopeeRegime({
  rules: [accountRule],
  channelAccountId: 'account-2',
  effectiveAt: '2026-09-15',
  presentationFactor: 36,
  offerMappingId: 'offer-1',
});
equal(unknownAccount.regime, null, 'conta sem regra versionada não recebe regime inventado');
equal(unknownAccount.confidence, 'low', 'conta sem regra deve ter confiança baixa');

const noAccount = resolveHistoricalShopeeRegime({
  rules: [accountRule],
  channelAccountId: null,
  effectiveAt: '2026-09-15',
  presentationFactor: 36,
  offerMappingId: null,
});
equal(noAccount.regime, null, 'sem conta não há resolução');
assert(noAccount.missing.includes('account'), 'conta deve ser pendência explícita');

const incompleteRule: EconomicRuleCandidate = {
  ...accountRule,
  id: 'rule-incomplete',
  parameters: { commissionPct: 12 },
};
const incomplete = resolveHistoricalShopeeRegime({
  rules: [incompleteRule],
  channelAccountId: 'account-1',
  effectiveAt: '2026-09-15',
  offerMappingId: null,
});
equal(incomplete.regime, null, 'regra incompleta não pode ser aplicada');

console.log('economic-engine/rre.test: OK');
