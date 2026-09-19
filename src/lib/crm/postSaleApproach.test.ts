import { describe, expect, it } from 'vitest';
import { evaluatePostSaleApproach, type PostSaleApproachContext } from './postSaleApproach';
import type { PostSaleEligibilitySignal } from './postSale';

const eligible: PostSaleEligibilitySignal = {
  eligible: true,
  orderId: 'order-1',
  deliveryDate: '2026-09-18',
  reason: 'Pedido elegível para pós-venda.',
};

const notEligible: PostSaleEligibilitySignal = {
  eligible: false,
  orderId: 'order-1',
  deliveryDate: '2026-09-18',
  reason: 'Pós-venda já realizado.',
};

const baseContext: PostSaleApproachContext = {
  optOut: false,
  conversationState: 'concluido',
  needsReply: false,
  lastInboundAt: '2026-09-10T10:00:00Z',
  lastOutboundAt: '2026-09-10T10:05:00Z',
};

describe('evaluatePostSaleApproach', () => {
  it('libera preparação quando há pós-venda elegível e nenhum conflito operacional', () => {
    expect(evaluatePostSaleApproach(eligible, baseContext).allowed).toBe(true);
  });

  it('bloqueia quando o pós-venda não está elegível', () => {
    expect(evaluatePostSaleApproach(notEligible, baseContext).allowed).toBe(false);
  });

  it('bloqueia abordagem proativa com opt-out comercial', () => {
    const decision = evaluatePostSaleApproach(eligible, { ...baseContext, optOut: true });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('opt-out');
  });

  it('bloqueia quando existe inbound atual ainda não respondido', () => {
    const decision = evaluatePostSaleApproach(eligible, {
      ...baseContext,
      lastInboundAt: '2026-09-19T10:05:00Z',
      lastOutboundAt: '2026-09-19T10:00:00Z',
    });
    expect(decision.allowed).toBe(false);
  });

  it('bloqueia qualquer alias canônico de estado aguardando cliente', () => {
    for (const state of ['aguardando_cliente', 'aguardando_resposta', 'retornar_em', 'awaiting_response', 'waiting_customer']) {
      expect(evaluatePostSaleApproach(eligible, { ...baseContext, conversationState: state }).allowed).toBe(false);
    }
  });
});
