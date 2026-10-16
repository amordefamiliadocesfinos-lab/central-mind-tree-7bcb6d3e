import { resolveCrmLifecycleOpportunity } from './lifecycleOpportunity';
import {
  START_OPPORTUNITY_INITIAL_BATCH,
  START_OPPORTUNITY_MAX_CONCURRENCY,
  analyzeStartOpportunityCandidates,
  assessStartOpportunityCandidate,
  assessStartOpportunitySafety,
  type StartOpportunitySafetyFacts,
} from './startOpportunityCandidates';
import type { PostSalePanelLifecycleInsight } from './postSalePanelLifecycle';
import type { PostSaleEligibilitySignal } from './postSale';
import type { RepurchaseSignal } from './repurchase';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error('CRM C2-01: ' + message);
}
const date = new Date('2026-10-16T12:00:00-03:00');
const postSale: PostSaleEligibilitySignal = {
  eligible: true, orderId: 'order-1', deliveryDate: '2026-10-15',
  reason: 'Pedido entregue e sem pós-venda posterior.',
};
const repurchase: RepurchaseSignal = {
  status: 'probable', confidence: 'medium', lastPurchaseAt: '2026-09-20',
  purchaseCount: 3, typicalIntervalDays: 20, daysSinceLastPurchase: 26,
  likelyProducts: ['produto-1'], reason: 'Três pedidos pagos com ciclo consistente.',
};
const insight = (post: PostSaleEligibilitySignal | null, rep: RepurchaseSignal | null, restricted = false): PostSalePanelLifecycleInsight =>
  ({ opportunity: resolveCrmLifecycleOpportunity(post, rep), readOnly: true, restricted });

const clearFacts = (id: string): StartOpportunitySafetyFacts => ({
  contact: { id, is_active: true, commercial_opt_out: false, type: 'cliente', funnel_status: 'fechado' },
  conversations: [], hasPendingOfficialTask: false, hasPendingCampaignRecipient: false,
  conversationsTruncated: false,
});
const available = (id: string, facts = clearFacts(id)) => assessStartOpportunityCandidate(id, facts, insight(postSale, repurchase), date);
assert(available('ok').state === 'available', 'pós-venda validado deve ser candidato, não ação enviada');
assert(available('ok').opportunity?.kind === 'post_sale', 'precedência oficial preservada');
assert(!available('ok').reason.includes('100%'), 'não criar probabilidade comercial');
assert(assessStartOpportunityCandidate('rep', clearFacts('rep'), insight(null, repurchase), date).canRecommend,
  'recompra provável comprovada pode ser candidata');
assert(assessStartOpportunityCandidate('none', clearFacts('none'), insight(null, null), date).state === 'no_signal',
  'ausência de sinal é distinta de erro');
assert(assessStartOpportunityCandidate('unverified', clearFacts('unverified'), null, date).state === 'insufficient',
  'não inferir ausência de oportunidade quando faltam dados');

const explicit = { ...repurchase, status: 'explicit' as const, confidence: 'high' as const };
assert(assessStartOpportunityCandidate('explicit', clearFacts('explicit'), insight(postSale, explicit), date).state === 'blocked',
  'intenção explícita pertence à Inbox, não à Start proativa');
assert(assessStartOpportunityCandidate('restricted', clearFacts('restricted'), insight(postSale, null, true), date).state === 'blocked',
  'restrição do resolvedor bloqueia sugestão');
assert(assessStartOpportunityCandidate('uncertain', clearFacts('uncertain'), insight(
  { ...postSale, deliveryDate: null }, null,
), date).state === 'insufficient', 'não confundir sinal sem entrega comprovada com ausência de oportunidade');

const assertBlocked = (name: string, patch: Partial<StartOpportunitySafetyFacts>) => {
  const f = { ...clearFacts(name), ...patch };
  assert(assessStartOpportunitySafety(name, f, date).allowed === false, name);
  assert(assessStartOpportunityCandidate(name, f, insight(postSale, repurchase), date).canRecommend === false, name + ' nunca sugerido');
};
assertBlocked('inactive', { contact: { ...clearFacts('inactive').contact!, is_active: false } });
assertBlocked('optout', { contact: { ...clearFacts('optout').contact!, commercial_opt_out: true } });
assertBlocked('supplier', { contact: { ...clearFacts('supplier').contact!, type: 'fornecedor' } });
assertBlocked('task', { hasPendingOfficialTask: true });
assertBlocked('campaign', { hasPendingCampaignRecipient: true });
assertBlocked('no-safety-contact', { contact: null });
assertBlocked('unknown-optout', { contact: { ...clearFacts('unknown-optout').contact!, commercial_opt_out: null } });
assertBlocked('truncated', { conversationsTruncated: true });
assertBlocked('preexisting-next-action', { contact: { ...clearFacts('preexisting-next-action').contact!, next_action_date: '2026-10-23' } });
assertBlocked('awaiting', { conversations: [{
  status: 'open', attendanceState: 'aguardando_cliente', needsReply: false, lastInboundAt: null, lastOutboundAt: '2026-10-16T08:00:00Z',
}] });
assertBlocked('needs-reply', { conversations: [{
  status: 'open', attendanceState: 'em_atendimento', needsReply: true,
  lastInboundAt: '2026-10-16T09:00:00Z', lastOutboundAt: null,
}] });
assertBlocked('return', { conversations: [{
  status: 'open', attendanceState: 'em_atendimento', needsReply: false,
  lastInboundAt: null, lastOutboundAt: null, returnAt: '2026-10-20T09:00:00Z',
}] });
assertBlocked('priority-p2', { conversations: [{
  status: 'open', attendanceState: 'em_atendimento', needsReply: false,
  lastInboundAt: null, lastOutboundAt: null, noResponseStatus: 'lead_esfriando',
}] });

async function run() {
  let active = 0, peak = 0, insightCalls = 0;
  const progress: number[] = [];
  const ids = Array.from({ length: START_OPPORTUNITY_INITIAL_BATCH + 2 }, (_, i) => 'c-' + i);
  const result = await analyzeStartOpportunityCandidates([...ids, ids[0]], {
    now: date,
    loadSafety: async (id) => {
      active++;
      peak = Math.max(active, peak);
      await Promise.resolve();
      active--;
      if (id === 'c-1') throw new Error('simulated read failure');
      if (id === 'c-2') return { ...clearFacts(id), hasPendingOfficialTask: true };
      return clearFacts(id);
    },
    loadInsight: async () => { insightCalls++; return insight(postSale, repurchase); },
    onProgress: done => progress.push(done),
  });
  assert(result.inputCount === ids.length, 'input deduplicado');
  assert(result.analyzedCount === START_OPPORTUNITY_INITIAL_BATCH, 'limite inicial');
  assert(result.remainingCount === 2, 'abrangência parcial explícita');
  assert(result.coverage === 'input_segment_only', 'jamais declarar CRM inteiro analisado');
  assert(result.candidates[0].contactId === 'c-0', 'ordem de entrada estável');
  assert(result.candidates[1].state === 'error', 'erro sem falso zero');
  assert(result.candidates[2].state === 'blocked', 'impedimento preservado');
  assert(insightCalls === START_OPPORTUNITY_INITIAL_BATCH - 2, 'não carregar sinal caro para impedidos/erros');
  assert(peak <= START_OPPORTUNITY_MAX_CONCURRENCY, 'concorrência limitada');
  assert(progress.length === START_OPPORTUNITY_INITIAL_BATCH, 'progresso é contagem de avaliados');
  const empty = await analyzeStartOpportunityCandidates([], { now: date });
  assert(empty.analyzedCount === 0 && empty.inputCount === 0, 'lote vazio não dispara consulta');
  console.log('startOpportunityCandidates.test: OK');
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
