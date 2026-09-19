import { describe, expect, it } from 'vitest';
import { resolveCrmLifecycleOpportunity } from './lifecycleOpportunity';
import type { PostSaleEligibilitySignal } from './postSale';
import type { RepurchaseSignal } from './repurchase';

const postSaleEligible: PostSaleEligibilitySignal = {
  eligible: true,
  orderId: 'order-1',
  deliveryDate: '2026-09-18',
  reason: 'Pedido elegível para pós-venda.',
};

const postSaleDone: PostSaleEligibilitySignal = {
  eligible: false,
  orderId: 'order-1',
  deliveryDate: '2026-09-18',
  reason: 'Pós-venda já registrado.',
};

const probableRepurchase: RepurchaseSignal = {
  status: 'probable',
  confidence: 'medium',
  lastPurchaseAt: '2026-09-18',
  purchaseCount: 4,
  typicalIntervalDays: 30,
  daysSinceLastPurchase: 28,
  likelyProducts: ['p1'],
  reason: 'Padrão histórico sugere recompra.',
};

const explicitRepurchase: RepurchaseSignal = {
  ...probableRepurchase,
  status: 'explicit',
  confidence: 'high',
  reason: 'Cliente pediu nova compra.',
};

const noRepurchase: RepurchaseSignal = {
  status: 'none',
  confidence: 'low',
  lastPurchaseAt: null,
  purchaseCount: 0,
  typicalIntervalDays: null,
  daysSinceLastPurchase: null,
  likelyProducts: [],
  reason: 'Sem evidência de recompra.',
};

describe('resolveCrmLifecycleOpportunity', () => {
  it('preserva recompra explícita mesmo quando o pós-venda está elegível', () => {
    const result = resolveCrmLifecycleOpportunity(postSaleEligible, explicitRepurchase);
    expect(result.kind).toBe('repurchase');
    expect(result.repurchase?.status).toBe('explicit');
  });

  it('prioriza pós-venda sobre recompra apenas provável', () => {
    const result = resolveCrmLifecycleOpportunity(postSaleEligible, probableRepurchase);
    expect(result.kind).toBe('post_sale');
    expect(result.postSale?.eligible).toBe(true);
  });

  it('libera recompra provável quando não há pós-venda pendente', () => {
    const result = resolveCrmLifecycleOpportunity(postSaleDone, probableRepurchase);
    expect(result.kind).toBe('repurchase');
    expect(result.repurchase?.status).toBe('probable');
  });

  it('retorna nenhum sinal quando não existe pós-venda elegível nem recompra', () => {
    const result = resolveCrmLifecycleOpportunity(postSaleDone, noRepurchase);
    expect(result.kind).toBe('none');
  });
});
