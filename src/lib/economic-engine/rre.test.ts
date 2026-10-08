import { resolveHistoricalShopeeRegime } from './rre';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('economic-engine/rre.test: ' + message);
}

function equal(actual: unknown, expected: unknown, message: string) {
  assert(Object.is(actual, expected), message + ': esperado ' + String(expected) + ', recebido ' + String(actual));
}

const exactHistorical = resolveHistoricalShopeeRegime({
  accountName: 'Adão',
  effectiveAt: '2026-09-15',
  presentationFactor: 36,
  offerKey: null,
});
equal(exactHistorical.regime?.commissionPct, 12, 'comissão histórica de Adão');
equal(exactHistorical.confidence, 'medium', 'sem Oferta a confiança não pode ser alta');
assert(exactHistorical.missing.includes('offer'), 'Oferta deve permanecer pendente na E4');
assert(exactHistorical.matchedBy.includes('validity'), 'vigência histórica deve casar');

const normalizedName = resolveHistoricalShopeeRegime({
  accountName: '  ADAO  ',
  effectiveAt: '2026-09-15',
  presentationFactor: 36,
  offerKey: null,
});
equal(normalizedName.regime?.accountName, 'Adão', 'nome canônico deve casar sem depender de acento/caixa');

const outsideWindow = resolveHistoricalShopeeRegime({
  accountName: 'Priscila',
  effectiveAt: '2026-10-08',
  presentationFactor: 36,
  offerKey: null,
});
equal(outsideWindow.confidence, 'low', 'fora da vigência observada deve reduzir confiança');
assert(outsideWindow.missing.includes('validity'), 'vigência deve ficar pendente fora da janela');

const unknownAccount = resolveHistoricalShopeeRegime({
  accountName: 'Conta Nova',
  effectiveAt: '2026-09-15',
  presentationFactor: 36,
  offerKey: null,
});
equal(unknownAccount.regime, null, 'conta sem evidência não recebe regime inventado');
equal(unknownAccount.confidence, 'low', 'conta desconhecida deve ter baixa confiança');

const withOffer = resolveHistoricalShopeeRegime({
  accountName: 'Neto',
  effectiveAt: '2026-09-15',
  presentationFactor: 36,
  offerKey: 'future-offer-key',
});
equal(withOffer.confidence, 'medium', 'Oferta resolvida sem evidência específica não deve virar confiança alta');
assert(withOffer.missing.includes('offer_evidence'), 'Oferta resolvida ainda precisa de evidência específica');

const withOfferEvidence = resolveHistoricalShopeeRegime({
  accountName: 'Neto',
  effectiveAt: '2026-09-15',
  presentationFactor: 36,
  offerKey: 'future-offer-key',
  offerEvidenceMatched: true,
});
equal(withOfferEvidence.confidence, 'high', 'Conta + vigência + Oferta + evidência específica podem alcançar confiança alta');

console.log('economic-engine/rre.test: OK');