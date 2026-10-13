import type { EconomicComponent, EconomicEffect } from './domain';

export type B7Fact = {
  id: string;
  incidentId: string;
  incidentType: string;
  title: string;
  allocatedValue: number;
  effect?: EconomicEffect;
  entryId: string;
  observedAt?: string | null;
  proven?: boolean;
  notes?: string | null;
};

const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

export function buildB7Facts(facts: B7Fact[]): EconomicComponent[] {
  return facts.map((fact) => ({
    id: 'b7:' + fact.id,
    economicKey: 'b7:incident:' + fact.incidentId + ':' + fact.entryId + ':' + fact.id,
    block: 'B7',
    subcategory: mapIncidentType(fact.incidentType),
    itemName: fact.title,
    amount: ok(fact.allocatedValue) ? fact.allocatedValue : null,
    currency: 'BRL',
    unit: 'evento',
    effect: fact.effect ?? 'COST',
    numericNature: fact.proven ? 'PROVEN' : 'OBSERVED_CURRENT',
    costState: ok(fact.allocatedValue) ? 'APPLICABLE_WITH_VALUE' : 'APPLICABLE_VALUE_PENDING',
    knowledgeState: ok(fact.allocatedValue) ? 'KNOWN' : 'UNKNOWN',
    incidence: 'I-E',
    scope: 'incident:' + fact.incidentId,
    sourceDomain: 'Operações + Financeiro',
    sourceEntity: 'economic_financial_attributions',
    sourceId: fact.id,
    evidenceIds: [fact.entryId, fact.incidentId],
    observedAt: fact.observedAt ?? null,
    notes: fact.notes ?? null,
  }));
}

export function pendingB7Incident(incident: {
  id: string;
  incidentType: string;
  title: string;
}): EconomicComponent {
  return {
    id: 'b7:pending:' + incident.id,
    economicKey: 'b7:pending:' + incident.id,
    block: 'B7',
    subcategory: mapIncidentType(incident.incidentType),
    itemName: incident.title,
    amount: null,
    currency: 'BRL',
    unit: 'evento',
    effect: 'COST',
    numericNature: 'FUTURE_UNDEFINED',
    costState: 'APPLICABLE_VALUE_PENDING',
    knowledgeState: 'UNKNOWN',
    incidence: 'I-E',
    scope: 'incident:' + incident.id,
    sourceDomain: 'Operações',
    sourceEntity: 'operational_incidents',
    sourceId: incident.id,
    notes: 'Incidente operacional existe, mas ainda não há impacto econômico comprovado.',
  };
}

export function noB7Occurrence(): EconomicComponent[] {
  return [{
    id: 'b7:none',
    economicKey: 'b7:none',
    block: 'B7',
    subcategory: 'B7.0',
    itemName: 'Sem ocorrência econômica no cenário',
    amount: null,
    currency: 'BRL',
    unit: 'evento',
    effect: 'COST',
    numericNature: 'HOMOLOGATED',
    costState: 'NOT_APPLICABLE',
    knowledgeState: 'NOT_APPLICABLE',
    incidence: 'I-E',
    sourceDomain: 'Precificação',
    sourceEntity: 'scenario',
  }];
}

function mapIncidentType(type: string) {
  const t = type.toLowerCase();
  if (t.includes('return') || t.includes('devol')) return 'B7.1';
  if (t.includes('damage') || t.includes('avaria')) return 'B7.2';
  if (t.includes('reship') || t.includes('reenv')) return 'B7.3';
  if (t.includes('chargeback') || t.includes('contest')) return 'B7.4';
  if (t.includes('loss') || t.includes('extravio') || t.includes('entrega')) return 'B7.5';
  if (t.includes('cancel')) return 'B7.6';
  return 'B7.7';
}
