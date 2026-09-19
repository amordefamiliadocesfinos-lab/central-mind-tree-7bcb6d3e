import { describe, expect, it } from 'vitest';
import { classifyPostSaleOutcome, POST_SALE_RESULT_CODES } from './postSaleOutcome';

describe('classifyPostSaleOutcome', () => {
  it('reconhece todos os Resultados canônicos 023–029 como pós-venda atendido', () => {
    for (const code of POST_SALE_RESULT_CODES) {
      const outcome = classifyPostSaleOutcome(code);
      expect(outcome.isPostSale).toBe(true);
      expect(outcome.closesEligibility).toBe(true);
      expect(outcome.opensRepurchaseByItself).toBe(false);
    }
  });

  it('preserva CRM-RES-026 como pós-venda positivo sem inferir recompra', () => {
    const outcome = classifyPostSaleOutcome('CRM-RES-026');
    expect(outcome.kind).toBe('positive');
    expect(outcome.opensRepurchaseByItself).toBe(false);
  });

  it('não interfere em Resultado fora do conjunto de pós-venda', () => {
    const outcome = classifyPostSaleOutcome('CRM-RES-030');
    expect(outcome.isPostSale).toBe(false);
    expect(outcome.closesEligibility).toBe(false);
    expect(outcome.kind).toBeNull();
  });
});
