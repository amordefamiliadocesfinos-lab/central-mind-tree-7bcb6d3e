import { resolveCrmLifecycleOpportunity } from './lifecycleOpportunity';
import type { PostSaleEligibilitySignal } from './postSale';
import type { RepurchaseSignal } from './repurchase';
import type { PostSalePanelLifecycleInsight } from './postSalePanelLifecycle';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw Error(`CRM Pós-venda V2: ${message}`);
}
const delivered: PostSaleEligibilitySignal = {
  eligible: true, orderId: 'p-1', deliveryDate: '2026-10-02', reason: 'Entrega finalizada com pós-venda pendente.',
};
const completed: PostSaleEligibilitySignal = {
  ...delivered, eligible: false, reason: 'Pós-venda concluído.',
};
const probable: RepurchaseSignal = {
  status: 'probable', confidence: 'medium', lastPurchaseAt: '2026-10-02',
  purchaseCount: 4, typicalIntervalDays: 20, daysSinceLastPurchase: 17,
  likelyProducts: ['produto-1'], reason: 'Histórico de compras recorrentes.',
};
const explicit: RepurchaseSignal = { ...probable, status: 'explicit', confidence: 'high' };
const verify = (p: PostSaleEligibilitySignal, r: RepurchaseSignal) =>
  resolveCrmLifecycleOpportunity(p, r);
assert(verify(delivered, explicit).kind === 'repurchase', 'intenção expressa tem prioridade');
assert(verify(delivered, probable).kind === 'post_sale', 'pós-venda prevalece sobre suposição de recompra');
assert(verify(completed, probable).kind === 'repurchase', 'recompra provável só após pós-venda concluído');
assert(verify(completed, { ...probable, status: 'none' }).kind === 'none',
  'tempo sem comprar, sozinho, não é oportunidade');
const contract: PostSalePanelLifecycleInsight = {
  opportunity: verify(delivered, probable), restricted: true, readOnly: true,
};
assert(contract.restricted && contract.readOnly && contract.opportunity.kind === 'post_sale',
  'opt-out não falsifica o fato, mas mantém a abordagem comercial restrita');
console.log('postSalePanelLifecycle.test: OK');
