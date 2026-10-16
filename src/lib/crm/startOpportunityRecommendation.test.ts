import { selectStartRecommendedOpportunity } from './startOpportunityRecommendation';
import type { StartOpportunityCandidate } from './startOpportunityCandidates';
import type { PostSaleEligibilitySignal } from './postSale';
import type { RepurchaseSignal } from './repurchase';
import { resolveCrmLifecycleOpportunity } from './lifecycleOpportunity';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error('CRM C2-02: ' + message);
}

function postSale(id: string, deliveryDate: string, state: StartOpportunityCandidate['state'] = 'available'): StartOpportunityCandidate {
  const signal: PostSaleEligibilitySignal = {
    eligible: true, orderId: 'order-' + id, deliveryDate,
    reason: 'Pedido finalizado, entregue, pós-venda pendente.',
  };
  return {
    contactId: id, state, reason: signal.reason, canRecommend: state === 'available',
    opportunity: resolveCrmLifecycleOpportunity(signal, null),
  };
}

function repurchase(id: string, lastPurchaseAt: string, typicalIntervalDays: number, purchaseCount = 4): StartOpportunityCandidate {
  const signal: RepurchaseSignal = {
    status: 'probable', confidence: 'medium', lastPurchaseAt,
    purchaseCount, typicalIntervalDays, daysSinceLastPurchase: 50,
    likelyProducts: [], reason: 'Padrão consistente.',
  };
  return {
    contactId: id, state: 'available', reason: signal.reason, canRecommend: true,
    opportunity: resolveCrmLifecycleOpportunity(null, signal),
  };
}

assert(selectStartRecommendedOpportunity([]) === null, 'vazio não gera oportunidade fictícia');
assert(selectStartRecommendedOpportunity([
  { ...postSale('ignored', '2026-10-15'), canRecommend: false }, postSale('blocked', '2026-10-16', 'blocked'),
]) === null, 'candidato bloqueado nunca vira destaque');

const s1 = postSale('b', '2026-10-14');
const s2 = postSale('a', '2026-10-15');
const s3 = repurchase('rep', '2026-07-10', 10);
assert(selectStartRecommendedOpportunity([s1, s2, s3])?.candidate.contactId === 'a',
  'pós-venda prevalece sobre recompra provável e prioriza entrega mais recente');
assert(selectStartRecommendedOpportunity([s2, s1, s3])?.candidate.contactId === 'a',
  'seleção independe da ordem de chegada');
assert(selectStartRecommendedOpportunity([postSale('z', '2026-10-14'), postSale('a', '2026-10-14')])?.candidate.contactId === 'a',
  'identificador desempata datas idênticas com ordem estável');

const r1 = repurchase('r1', '2026-09-05', 30); // ciclo 05/10
const r2 = repurchase('r2', '2026-09-08', 20); // ciclo 28/09
assert(selectStartRecommendedOpportunity([r1, r2])?.candidate.contactId === 'r2',
  'ciclo estimado mais antigo vence, nunca score artificial');
assert(selectStartRecommendedOpportunity([repurchase('z', '2026-09-08', 20), repurchase('a', '2026-09-08', 20)])?.candidate.contactId === 'a',
  'empate de recompra por ID');

const explicit: RepurchaseSignal = {
  status: 'explicit', confidence: 'high', lastPurchaseAt: '2026-10-15',
  purchaseCount: 3, typicalIntervalDays: null, daysSinceLastPurchase: 1,
  likelyProducts: [], reason: 'Cliente quer novo pedido.',
};
assert(selectStartRecommendedOpportunity([{
  contactId: 'client-request', state: 'available', canRecommend: true,
  reason: explicit.reason, opportunity: resolveCrmLifecycleOpportunity(null, explicit),
}]) === null, 'recompra explícita nunca entra como abordagem proativa');

assert(selectStartRecommendedOpportunity([postSale('invalid', 'data-invalida')]) === null,
  'entrega inválida não produz recomendação');
assert(selectStartRecommendedOpportunity([repurchase('bad', '2026-09-05', 0)]) === null,
  'intervalo inválido não produz estimativa');
assert(selectStartRecommendedOpportunity([repurchase('bad-count', '2026-09-05', 20, 2)]) === null,
  'histórico inferior a três compras não prova sinal provável');

const estimate = selectStartRecommendedOpportunity([r2]);
assert(estimate?.kind === 'repurchase_probable' && estimate.evidenceDate === '2026-09-28',
  'data estimada é reproduzível e não representa vencimento de tarefa');
const forward = selectStartRecommendedOpportunity([s1, r1, s2, r2]);
const reversed = selectStartRecommendedOpportunity([r2, s2, r1, s1]);
assert(forward?.candidate.contactId === reversed?.candidate.contactId, 'resultado estável por permutação');

console.log('startOpportunityRecommendation.test: OK');
