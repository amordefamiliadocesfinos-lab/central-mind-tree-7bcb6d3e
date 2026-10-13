import type { EconomicComponent } from './domain';

export type B8Category =
  | 'B8.1'
  | 'B8.2'
  | 'B8.3'
  | 'B8.4'
  | 'B8.5'
  | 'B8.6'
  | 'B8.7'
  | 'B8.8';

export type B8AllocationDriver =
  | 'revenue'
  | 'physical_volume'
  | 'production_hours'
  | 'capacity'
  | 'cost_center'
  | 'other';

export type B8StructuralFact = {
  id: string;
  category: B8Category;
  name: string;
  observedValue: number;
  periodStart: string;
  periodEnd: string;
  sourceId?: string | null;
  sourceEntity?: string | null;
};

export type B8AllocationMethod =
  | {
      status: 'pending';
      notes?: string | null;
    }
  | {
      status: 'homologated';
      driver: B8AllocationDriver;
      numerator: number;
      denominator: number;
      ruleVersion: string;
      notes?: string | null;
    };

const validNonNegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function buildB8Components(input: {
  facts: B8StructuralFact[];
  allocation: B8AllocationMethod;
}): EconomicComponent[] {
  const totalObserved = input.facts.reduce(
    (sum, fact) => sum + (validNonNegative(fact.observedValue) ? fact.observedValue : 0),
    0,
  );

  if (input.facts.length === 0) {
    return [{
      id: 'b8:pool:pending',
      economicKey: 'b8:pool:pending',
      block: 'B8',
      subcategory: 'B8.P',
      itemName: 'Estrutura / overhead',
      amount: null,
      currency: 'BRL',
      unit: 'periodo',
      effect: 'COST',
      numericNature: 'FUTURE_UNDEFINED',
      costState: 'APPLICABLE_VALUE_PENDING',
      knowledgeState: 'UNKNOWN',
      incidence: 'I-M',
      sourceDomain: 'Financeiro/Estrutura',
      sourceEntity: 'financial_entries',
      notes: 'Gastos estruturais ainda não consolidados para o período.',
    }];
  }

  if (input.allocation.status === 'pending') {
    return [{
      id: 'b8:allocation:pending',
      economicKey: 'b8:allocation:pending',
      block: 'B8',
      subcategory: 'B8.P',
      itemName: 'Rateio estrutural pendente',
      amount: null,
      currency: 'BRL',
      unit: 'escopo',
      effect: 'COST',
      numericNature: 'OBSERVED_CURRENT',
      costState: 'METHODOLOGY_PENDING',
      knowledgeState: 'UNKNOWN',
      incidence: 'I-M',
      sourceDomain: 'Financeiro/Estrutura',
      sourceEntity: 'financial_entries',
      notes:
        'Pool estrutural observado: R$ ' + totalObserved.toFixed(6) +
        '. O valor não é atribuído ao produto/oferta sem metodologia homologada.' +
        (input.allocation.notes ? ' ' + input.allocation.notes : ''),
    }];
  }

  const denominatorValid = input.allocation.denominator > 0;
  const numeratorValid = input.allocation.numerator >= 0;
  if (!denominatorValid || !numeratorValid) {
    return [{
      id: 'b8:allocation:invalid',
      economicKey: 'b8:allocation:invalid:' + input.allocation.ruleVersion,
      block: 'B8',
      subcategory: 'B8.P',
      itemName: 'Rateio estrutural inválido',
      amount: null,
      currency: 'BRL',
      unit: 'escopo',
      effect: 'COST',
      numericNature: 'HOMOLOGATED',
      costState: 'METHODOLOGY_PENDING',
      knowledgeState: 'UNKNOWN',
      incidence: 'I-M',
      sourceDomain: 'Precificação',
      sourceEntity: 'allocation_rule',
      ruleVersion: input.allocation.ruleVersion,
      notes: 'Driver homologado, porém numerador/denominador não permitem cálculo válido.',
    }];
  }

  const share = input.allocation.numerator / input.allocation.denominator;
  const allocated = totalObserved * share;

  return [{
    id: 'b8:allocation:' + input.allocation.ruleVersion,
    economicKey: 'b8:allocation:' + input.allocation.ruleVersion,
    block: 'B8',
    subcategory: 'B8.A',
    itemName: 'Overhead estrutural alocado',
    amount: allocated,
    currency: 'BRL',
    unit: 'escopo',
    effect: 'COST',
    numericNature: 'DERIVED',
    costState: 'APPLICABLE_WITH_VALUE',
    knowledgeState: 'KNOWN',
    incidence: 'I-M',
    driver: input.allocation.driver,
    quantity: input.allocation.numerator,
    conversionFactor: share,
    sourceDomain: 'Financeiro + Precificação',
    sourceEntity: 'allocation_rule',
    ruleVersion: input.allocation.ruleVersion,
    notes:
      'Pool observado: R$ ' + totalObserved.toFixed(6) +
      '. Driver ' + input.allocation.driver +
      '; participação ' + share.toFixed(8) + '.',
  }];
}
