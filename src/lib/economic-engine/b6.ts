import type { EconomicComponent, EconomicEffect } from './domain';

export type B6Fact = {
  id: string;
  subcategory: string;
  itemName: string;
  allocatedValue: number;
  effect?: EconomicEffect;
  entryId: string;
  observedAt?: string | null;
  proven?: boolean;
  notes?: string | null;
};

const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

export function buildB6Facts(orderId: string, facts: B6Fact[]): EconomicComponent[] {
  return facts.map((fact) => ({
    id: 'b6:' + fact.id,
    economicKey: 'b6:entry:' + fact.entryId + ':' + fact.id,
    block: 'B6',
    subcategory: fact.subcategory,
    itemName: fact.itemName,
    amount: ok(fact.allocatedValue) ? fact.allocatedValue : null,
    currency: 'BRL',
    unit: 'pedido',
    effect: fact.effect ?? 'COST',
    numericNature: fact.proven ? 'PROVEN' : 'OBSERVED_CURRENT',
    costState: ok(fact.allocatedValue) ? 'APPLICABLE_WITH_VALUE' : 'APPLICABLE_VALUE_PENDING',
    knowledgeState: ok(fact.allocatedValue) ? 'KNOWN' : 'UNKNOWN',
    incidence: 'I-T',
    scope: 'order:' + orderId,
    sourceDomain: 'Financeiro/Fiscal',
    sourceEntity: 'economic_financial_attributions',
    sourceId: fact.id,
    evidenceIds: [fact.entryId],
    observedAt: fact.observedAt ?? null,
    notes: fact.notes ?? null,
  }));
}

export function buildB6Scenario(input: {
  financialCost?: number | null;
  fiscalCost?: number | null;
}): EconomicComponent[] {
  const rows: EconomicComponent[] = [];
  const add = (id: string, subcategory: string, name: string, value: number | null | undefined, domain: string) => {
    const known = ok(value);
    rows.push({
      id,
      economicKey: id,
      block: 'B6',
      subcategory,
      itemName: name,
      amount: known ? value : null,
      currency: 'BRL',
      unit: 'transacao',
      effect: 'COST',
      numericNature: known ? 'SIMULATED' : 'FUTURE_UNDEFINED',
      costState: known ? 'APPLICABLE_WITH_VALUE' : 'APPLICABLE_VALUE_PENDING',
      knowledgeState: known ? 'KNOWN' : 'UNKNOWN',
      incidence: 'I-T',
      sourceDomain: domain,
      sourceEntity: 'scenario',
    });
  };
  if (input.financialCost !== undefined) add('b6:scenario:financial','B6.1','Custo financeiro direto',input.financialCost,'Financeiro');
  if (input.fiscalCost !== undefined) add('b6:scenario:fiscal','B6.4','Tributo direto da venda',input.fiscalCost,'Fiscal/Contábil');
  if (rows.length === 0) add('b6:scenario:pending','B6.P','Financeiro / Fiscal',null,'Financeiro/Fiscal');
  return rows;
}
