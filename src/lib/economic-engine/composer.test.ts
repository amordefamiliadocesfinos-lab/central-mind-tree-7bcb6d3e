import {
  type EconomicComponent,
  type EconomicCompositionInput,
} from './domain';
import { composeEconomicResult } from './composer';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('economic-engine/composer.test: ' + message);
}

function equal(actual: unknown, expected: unknown, message: string) {
  assert(
    Object.is(actual, expected),
    message + ': esperado ' + String(expected) + ', recebido ' + String(actual),
  );
}

function component(
  overrides: Partial<EconomicComponent> & Pick<EconomicComponent, 'id' | 'economicKey' | 'block' | 'itemName'>,
): EconomicComponent {
  return {
    amount: 0,
    currency: 'BRL',
    unit: 'un',
    effect: 'COST',
    numericNature: 'OBSERVED_CURRENT',
    costState: 'APPLICABLE_WITH_VALUE',
    knowledgeState: 'KNOWN',
    incidence: 'I-U',
    sourceDomain: 'test',
    ...overrides,
  };
}

const completeInput: EconomicCompositionInput = {
  revenue: {
    amount: 100,
    currency: 'BRL',
    numericNature: 'SIMULATED',
    sourceDomain: 'test',
  },
  components: [
    component({ id: 'b1', economicKey: 'material:alfajor', block: 'B1', itemName: 'Produto', amount: 20 }),
    component({ id: 'b2', economicKey: 'presentation:h18', block: 'B2', itemName: 'Bandeja', amount: 2 }),
    component({ id: 'b3', economicKey: 'fulfillment:box', block: 'B3', itemName: 'Caixa externa', amount: 3 }),
    component({
      id: 'b4',
      economicKey: 'logistics:pickup',
      block: 'B4',
      itemName: 'Retirada',
      amount: 0,
      costState: 'PROVEN_ZERO',
      knowledgeState: 'KNOWN',
      incidence: 'I-P',
    }),
    component({ id: 'b5', economicKey: 'channel:fee', block: 'B5', itemName: 'Canal', amount: 10, incidence: 'I-T' }),
    component({ id: 'b6', economicKey: 'finance:fee', block: 'B6', itemName: 'Financeiro', amount: 5, incidence: 'I-T' }),
    component({
      id: 'b7',
      economicKey: 'incident:refund',
      block: 'B7',
      itemName: 'Recuperação',
      amount: 1,
      effect: 'RECOVERY',
      incidence: 'I-E',
    }),
    component({
      id: 'b8',
      economicKey: 'overhead:none',
      block: 'B8',
      itemName: 'Overhead não alocado',
      amount: 0,
      costState: 'PROVEN_ZERO',
      knowledgeState: 'KNOWN',
      incidence: 'I-M',
    }),
    component({
      id: 'b9',
      economicKey: 'capital:none',
      block: 'B9',
      itemName: 'Capital não aplicado no cenário',
      amount: 0,
      costState: 'PROVEN_ZERO',
      knowledgeState: 'KNOWN',
      incidence: 'I-M',
    }),
  ],
};

const complete = composeEconomicResult(completeInput);

equal(complete.blocks.B1.amount, 20, 'B1 deve somar custo conhecido');
equal(complete.blocks.B7.amount, -1, 'recuperação B7 deve reduzir custo líquido');
equal(complete.levels.N1.amount, 20, 'N1 deve ser B1');
equal(complete.levels.N2.amount, 22, 'N2 deve ser B1+B2');
equal(complete.levels.N3.amount, 25, 'N3 deve ser B1+B2+B3');
equal(complete.levels.N4.amount, 35, 'N4 deve incluir B4+B5');
equal(complete.levels.N5.amount, 39, 'N5 deve incluir B6+B7 líquido');
equal(complete.contribution.amount, 61, 'N6 deve preservar contribuição');
equal(complete.structural.amount, 61, 'N7 deve preservar resultado estrutural quando B8/B9 resolvidos');
equal(complete.completeness, 'COMPLETE', 'cenário integral deve ser completo');

const fiscalPending = composeEconomicResult({
  revenue: completeInput.revenue,
  components: [
    ...completeInput.components.filter((item) => item.id !== 'b6'),
    component({
      id: 'b6-pending',
      economicKey: 'finance:tax',
      block: 'B6',
      itemName: 'Tributo',
      amount: null,
      numericNature: 'FUTURE_UNDEFINED',
      costState: 'APPLICABLE_VALUE_PENDING',
      knowledgeState: 'UNKNOWN',
      incidence: 'I-T',
    }),
  ],
});

equal(fiscalPending.blocks.B6.completeness, 'PARTIAL', 'B6 pendente deve permanecer parcial');
equal(fiscalPending.levels.N5.amount, null, 'N5 não deve fingir custo final com B6 pendente');
equal(fiscalPending.contribution.amount, null, 'contribuição final não deve existir com custo direto pendente');
equal(fiscalPending.contribution.knownContribution, 66, 'subtotal conhecido pode ser exposto sem fingir completude');

const structuralPending = composeEconomicResult({
  revenue: completeInput.revenue,
  components: [
    ...completeInput.components.filter((item) => item.id !== 'b8' && item.id !== 'b9'),
    component({
      id: 'b8-pending',
      economicKey: 'overhead:allocation',
      block: 'B8',
      itemName: 'Rateio de overhead',
      amount: null,
      numericNature: 'FUTURE_UNDEFINED',
      costState: 'METHODOLOGY_PENDING',
      knowledgeState: 'UNKNOWN',
      incidence: 'I-M',
    }),
    component({
      id: 'b9-pending',
      economicKey: 'capital:allocation',
      block: 'B9',
      itemName: 'Custo de capital',
      amount: null,
      numericNature: 'FUTURE_UNDEFINED',
      costState: 'METHODOLOGY_PENDING',
      knowledgeState: 'UNKNOWN',
      incidence: 'I-M',
    }),
  ],
});

equal(structuralPending.levels.N5.completeness, 'COMPLETE', 'B8/B9 não devem contaminar N5');
equal(structuralPending.contribution.amount, 61, 'N6 deve continuar disponível antes de B8/B9');
equal(structuralPending.structural.amount, null, 'N7 não deve existir sem metodologia B8/B9');
equal(structuralPending.structural.completeness, 'PARTIAL', 'N7 deve declarar metodologia pendente');

const duplicate = composeEconomicResult({
  revenue: completeInput.revenue,
  components: [
    component({ id: 'dup-b2', economicKey: 'box:physical-1', block: 'B2', itemName: 'Caixa apresentação', amount: 2 }),
    component({ id: 'dup-b3', economicKey: 'box:physical-1', block: 'B3', itemName: 'Mesma caixa no fulfillment', amount: 2 }),
  ],
});

equal(duplicate.completeness, 'BLOCKED', 'duplicidade econômica deve bloquear o resultado');
equal(duplicate.blocks.B2.knownNetAmount, 0, 'componente duplicado não pode ser contado em B2');
equal(duplicate.blocks.B3.knownNetAmount, 0, 'componente duplicado não pode ser contado em B3');
assert(
  duplicate.duplicateEconomicKeys.includes('box:physical-1'),
  'economicKey duplicada deve ser explicitada',
);

const zeroMismatch = composeEconomicResult({
  components: [
    component({
      id: 'bad-zero',
      economicKey: 'logistics:bad-zero',
      block: 'B4',
      itemName: 'Zero inválido',
      amount: 1,
      costState: 'PROVEN_ZERO',
      knowledgeState: 'KNOWN',
      incidence: 'I-P',
    }),
  ],
});

equal(zeroMismatch.completeness, 'BLOCKED', 'PROVEN_ZERO diferente de zero deve bloquear');
assert(
  zeroMismatch.validationIssues.some((issue) => issue.code === 'PROVEN_ZERO_REQUIRES_ZERO'),
  'validação de zero comprovado deve ser explícita',
);

console.log('economic-engine/composer.test: OK');
