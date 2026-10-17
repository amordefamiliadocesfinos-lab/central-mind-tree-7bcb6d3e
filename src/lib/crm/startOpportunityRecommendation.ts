/**
 * CRM–UX 02 / C2-02 — escolha determinística do destaque na Start.
 *
 * Somente leitura: não cria uma segunda fila, score, tarefa ou agendamento.
 * Opera EXCLUSIVAMENTE sobre candidatos comprovadamente analisados pela C2-01.
 */
import type { StartOpportunityCandidate } from './startOpportunityCandidates';

export type StartRecommendationKind = 'post_sale' | 'repurchase_probable';

export interface StartRecommendedOpportunity {
  candidate: StartOpportunityCandidate;
  kind: StartRecommendationKind;
  /** Data do fato (entrega) ou do ciclo estimado, nunca vencimento oficial. */
  evidenceDate: string;
  /** Texto curto, baseado nos fatos já verificados pelo motor CRM. */
  evidence: string;
}

function validTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function optionFor(candidate: StartOpportunityCandidate): (StartRecommendedOpportunity & { rank: number; at: number }) | null {
  if (!candidate.canRecommend || candidate.state !== 'available' || !candidate.contactId) return null;
  const opportunity = candidate.opportunity;
  if (!opportunity) return null;

  if (opportunity.kind === 'post_sale' && opportunity.postSale?.eligible === true) {
    const deliveryDate = opportunity.postSale.deliveryDate;
    const at = validTimestamp(deliveryDate);
    if (at === null || !deliveryDate) return null;
    return {
      candidate, kind: 'post_sale', rank: 0, at, evidenceDate: deliveryDate,
      evidence: `Entrega registrada em ${deliveryDate}; acompanhamento de pós-venda ainda elegível.`,
    };
  }

  if (opportunity.kind === 'repurchase' && opportunity.repurchase?.status === 'probable') {
    const repurchase = opportunity.repurchase;
    const lastAt = validTimestamp(repurchase.lastPurchaseAt);
    const interval = repurchase.typicalIntervalDays;
    if (lastAt === null || interval === null || !Number.isFinite(interval) || interval <= 0
      || repurchase.purchaseCount < 3) return null;
    // Apenas ordenação por ciclo: não cria compromisso, prazo ou probabilidade.
    const estimatedAt = lastAt + Math.round(interval) * 86400000;
    if (!Number.isFinite(estimatedAt)) return null;
    return {
      candidate, kind: 'repurchase_probable', rank: 1, at: estimatedAt,
      evidenceDate: new Date(estimatedAt).toISOString().slice(0, 10),
      evidence: `${repurchase.purchaseCount} compras válidas; intervalo típico de ${interval} dias desde ${repurchase.lastPurchaseAt}. Ciclo estimado, não vencimento.`,
    };
  }
  return null;
}

/**
 * Pós-venda antes da recompra provável. Entre pós-vendas, entrega MAIS RECENTE;
 * entre recompras prováveis, ciclo estimado MAIS ANTIGO. Empate pelo contactId.
 * Ordem de entrada e conclusão assíncrona não influenciam a escolha.
 */
export function selectStartRecommendedOpportunity(
  candidates: readonly StartOpportunityCandidate[],
): StartRecommendedOpportunity | null {
  const eligible = candidates.map(optionFor).filter((x): x is NonNullable<typeof x> => x !== null);
  eligible.sort((a, b) =>
    (a.rank - b.rank)
    || (a.rank === 0 ? b.at - a.at : a.at - b.at)
    || (a.candidate.contactId < b.candidate.contactId ? -1 : a.candidate.contactId > b.candidate.contactId ? 1 : 0)
  );
  const choice = eligible[0];
  if (!choice) return null;
  const { rank: _rank, at: _at, ...result } = choice;
  return result;
}
