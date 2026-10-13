import type { EconomicComponent } from './domain';

export type B9CapitalBase =
  | 'inventory'
  | 'working_capital'
  | 'receivables'
  | 'safety_stock'
  | 'excess_stock';

export type B9CapitalMethod =
  | {
      status: 'pending';
      notes?: string | null;
    }
  | {
      status: 'homologated';
      annualRatePct: number;
      days: number;
      base: B9CapitalBase;
      ruleVersion: string;
      notes?: string | null;
    };

const validNonNegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function calculateB9CapitalCost(input: {
  capitalBaseValue: number;
  annualRatePct: number;
  days: number;
}) {
  if (
    !validNonNegative(input.capitalBaseValue) ||
    !validNonNegative(input.annualRatePct) ||
    !validNonNegative(input.days)
  ) return null;

  return input.capitalBaseValue * (input.annualRatePct / 100) * (input.days / 365);
}

export function buildB9Components(input: {
  capitalBaseValue: number | null;
  method: B9CapitalMethod;
  sourceId?: string | null;
  sourceEntity?: string | null;
}): EconomicComponent[] {
  if (!validNonNegative(input.capitalBaseValue)) {
    return [{
      id: 'b9:base:pending',
      economicKey: 'b9:base:pending',
      block: 'B9',
      subcategory: 'B9.P',
      itemName: 'Base de capital empregada',
      amount: null,
      currency: 'BRL',
      unit: 'periodo',
      effect: 'COST',
      numericNature: 'FUTURE_UNDEFINED',
      costState: 'APPLICABLE_VALUE_PENDING',
      knowledgeState: 'UNKNOWN',
      incidence: 'I-M',
      sourceDomain: 'Operações/Financeiro',
      sourceEntity: input.sourceEntity ?? 'inventory_finance',
      sourceId: input.sourceId ?? null,
      notes: 'Capital médio empregado ainda não consolidado para o escopo.',
    }];
  }

  if (input.method.status === 'pending') {
    return [{
      id: 'b9:method:pending',
      economicKey: 'b9:method:pending',
      block: 'B9',
      subcategory: 'B9.P',
      itemName: 'Custo de capital pendente',
      amount: null,
      currency: 'BRL',
      unit: 'periodo',
      effect: 'COST',
      numericNature: 'OBSERVED_CURRENT',
      costState: 'METHODOLOGY_PENDING',
      knowledgeState: 'UNKNOWN',
      incidence: 'I-M',
      sourceDomain: 'Operações/Financeiro',
      sourceEntity: input.sourceEntity ?? 'inventory_finance',
      sourceId: input.sourceId ?? null,
      notes:
        'Capital observado: R$ ' + input.capitalBaseValue.toFixed(6) +
        '. Nenhuma taxa/metodologia homologada foi aplicada.' +
        (input.method.notes ? ' ' + input.method.notes : ''),
    }];
  }

  const amount = calculateB9CapitalCost({
    capitalBaseValue: input.capitalBaseValue,
    annualRatePct: input.method.annualRatePct,
    days: input.method.days,
  });

  if (amount === null) {
    return [{
      id: 'b9:method:invalid:' + input.method.ruleVersion,
      economicKey: 'b9:method:invalid:' + input.method.ruleVersion,
      block: 'B9',
      subcategory: 'B9.P',
      itemName: 'Custo de capital inválido',
      amount: null,
      currency: 'BRL',
      unit: 'periodo',
      effect: 'COST',
      numericNature: 'HOMOLOGATED',
      costState: 'METHODOLOGY_PENDING',
      knowledgeState: 'UNKNOWN',
      incidence: 'I-M',
      sourceDomain: 'Precificação',
      sourceEntity: 'capital_rule',
      ruleVersion: input.method.ruleVersion,
      notes: 'Metodologia homologada contém parâmetros inválidos.',
    }];
  }

  return [{
    id: 'b9:capital:' + input.method.ruleVersion,
    economicKey: 'b9:capital:' + input.method.ruleVersion,
    block: 'B9',
    subcategory:
      input.method.base === 'inventory' ? 'B9.1'
        : input.method.base === 'working_capital' ? 'B9.3'
          : input.method.base === 'receivables' ? 'B9.7'
            : input.method.base === 'safety_stock' ? 'B9.5'
              : 'B9.6',
    itemName: 'Custo de capital — ' + input.method.base,
    amount,
    currency: 'BRL',
    unit: 'periodo',
    effect: 'COST',
    numericNature: 'DERIVED',
    costState: 'APPLICABLE_WITH_VALUE',
    knowledgeState: 'KNOWN',
    incidence: 'I-M',
    driver: 'capital_x_rate_x_time',
    quantity: input.capitalBaseValue,
    conversionFactor: (input.method.annualRatePct / 100) * (input.method.days / 365),
    sourceDomain: 'Operações/Financeiro + Precificação',
    sourceEntity: input.sourceEntity ?? 'capital_rule',
    sourceId: input.sourceId ?? null,
    ruleVersion: input.method.ruleVersion,
    notes:
      'Base R$ ' + input.capitalBaseValue.toFixed(6) +
      '; taxa anual ' + input.method.annualRatePct.toFixed(6) +
      '%; período ' + input.method.days + ' dia(s).',
  }];
}
