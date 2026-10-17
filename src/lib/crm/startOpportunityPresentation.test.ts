import { resolveStartOpportunityDisplayState, type StartOpportunityPresentationInput } from './startOpportunityPresentation';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error('CRM C2-04: ' + message);
}

const baseline: StartOpportunityPresentationInput = {
  isLoading: false, analyzedCount: 8, hasRecommendation: false,
  hasMore: true, error: null, candidates: [{ state: 'no_signal' }],
};
function caseIs(
  name: string, patch: Partial<StartOpportunityPresentationInput>,
  expected: ReturnType<typeof resolveStartOpportunityDisplayState>,
) {
  const actual = resolveStartOpportunityDisplayState({ ...baseline, ...patch });
  assert(actual === expected, `${name}: esperado ${expected}, recebido ${actual}`);
}
caseIs('Início assíncrono não representa zero', { isLoading: true, analyzedCount: 0, candidates: [] }, 'loading');
caseIs('Existe destaque comprovado', { hasRecommendation: true }, 'recommended');
caseIs('Erro total nunca equivale a ausência', { analyzedCount: 0, hasMore: true, error: 'falha', candidates: [] }, 'error');
caseIs('Falha individual impõe cautela', { candidates: [{ state: 'no_signal' }, { state: 'error' }] }, 'error');
caseIs('Evidência insuficiente prevalece sobre sem sinal', { candidates: [{ state: 'no_signal' }, { state: 'insufficient' }] }, 'insufficient');
caseIs('Impedimento preservado', { candidates: [{ state: 'blocked' }] }, 'blocked');
caseIs('Sem sinal verificado', {}, 'no_signal');
caseIs('Recorte sem registros', { analyzedCount: 0, hasMore: false, candidates: [] }, 'empty');
caseIs('Só recorte vazio com consulta concluída', { analyzedCount: 0, hasMore: true, candidates: [] }, 'no_signal');
caseIs('Candidato verificado preserva destaque mesmo com outras falhas', {
  hasRecommendation: true, candidates: [{ state: 'available' }, { state: 'error' }],
}, 'recommended');
caseIs('Falha de lote após resultados preservados', { error: 'indisponível', candidates: [{ state: 'no_signal' }] }, 'error');

console.log('startOpportunityPresentation.test: OK');
