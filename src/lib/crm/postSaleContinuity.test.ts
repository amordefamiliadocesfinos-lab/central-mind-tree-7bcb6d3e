import { describe, expect, it } from 'vitest';
import { classifyPostSaleOutcome } from './postSaleOutcome';
import { resolvePostSaleContinuity } from './postSaleContinuity';
import type { RepurchaseSignal } from './repurchase';

const baseRepurchase: RepurchaseSignal = {
  status: 'none',
  confidence: 'low',
  lastPurchaseAt: '2026-09-18',
  purchaseCount: 3,
  typicalIntervalDays: null,
  daysSinceLastPurchase: 1,
  likelyProducts: [],
  reason: 'Sem evidência de recompra.',
};

describe('resolvePostSaleContinuity', () => {
  it('não transforma pós-venda positivo em recompra automaticamente', () => {
    const decision = resolvePostSaleContinuity(
      classifyPostSaleOutcome('CRM-RES-026'),
      baseRepurchase,
    );
    expect(decision.kind).toBe('none');
    expect(decision.repurchase).toBeNull();
  });

  it('preserva recompra explícita quando há intenção independente do cliente', () => {
    const explicit: RepurchaseSignal = {
      ...baseRepurchase,
      status: 'explicit',
      confidence: 'high',
      reason: 'Cliente pediu nova compra.',
    };
    const decision = resolvePostSaleContinuity(classifyPostSaleOutcome('CRM-RES-026'), explicit);
    expect(decision.kind).toBe('repurchase_explicit');
    expect(decision.repurchase?.status).toBe('explicit');
  });

  it('permite recompra provável somente quando o motor próprio a sustenta', () => {
    const probable: RepurchaseSignal = {
      ...baseRepurchase,
      status: 'probable',
      confidence: 'medium',
      typicalIntervalDays: 30,
      daysSinceLastPurchase: 29,
      reason: 'Padrão histórico sugere recompra.',
    };
    const decision = resolvePostSaleContinuity(classifyPostSaleOutcome('CRM-RES-024'), probable);
    expect(decision.kind).toBe('repurchase_probable');
  });

  it('não interfere quando o Resultado não é de pós-venda', () => {
    const decision = resolvePostSaleContinuity(classifyPostSaleOutcome('CRM-RES-030'), baseRepurchase);
    expect(decision.kind).toBe('none');
  });
});
