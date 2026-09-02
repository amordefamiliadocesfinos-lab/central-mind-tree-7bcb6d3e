import { isWaitingCustomerState } from '@/lib/crm/priority';

/**
 * F5.2.1 — Contador do ciclo de follow-up (informativo).
 *
 * Regras puras, sem banco e sem efeitos colaterais:
 * - tentativa real = envio outbound do operador, fora de campanha, quando a
 *   conversa já estava aguardando cliente e havia retorno/obrigação vencida;
 * - reagendamento sozinho não conta;
 * - resposta normal a um inbound não conta;
 * - inbound real (ou resultado que muda a responsabilidade) encerra o ciclo.
 *
 * Nada do histórico antigo é reclassificado: só contam eventos gravados
 * explicitamente com `event_metadata.kind = 'follow_up_attempt'`.
 */

export const FOLLOW_UP_CYCLE_LIMIT = 3;

export const FOLLOW_UP_ATTEMPT_KIND = 'follow_up_attempt';

export interface FollowUpHistoryEvent {
  event_code?: string | null;
  event_metadata?: unknown;
  interaction_date?: string | null;
  created_at?: string | null;
}

export interface FollowUpAttemptMetadata {
  kind: typeof FOLLOW_UP_ATTEMPT_KIND;
  attempt_number: number;
  cycle_started_at: string;
  campaign_id: string | null;
}

export interface FollowUpCycleState {
  attemptCount: number;
  nextAttemptNumber: number;
  limitReached: boolean;
  cycleStartedAt: string | null;
}

/** Eventos inequívocos que encerram/reiniciam o ciclo atual. */
const CYCLE_RESET_EVENT_CODES = new Set([
  'customer_replied',
  'sale_won',
  'sale_lost',
  'post_sale_completed',
  'reactivation_completed',
  'lead_created',
]);

function eventDate(event: FollowUpHistoryEvent): string | null {
  return event.interaction_date || event.created_at || null;
}

function metadataOf(event: FollowUpHistoryEvent): Record<string, unknown> | null {
  const meta = event.event_metadata;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  return meta as Record<string, unknown>;
}

export function isFollowUpAttemptEvent(event: FollowUpHistoryEvent): boolean {
  return metadataOf(event)?.kind === FOLLOW_UP_ATTEMPT_KIND;
}

export function isCycleResetEvent(event: FollowUpHistoryEvent): boolean {
  return Boolean(event.event_code && CYCLE_RESET_EVENT_CODES.has(event.event_code));
}

export function buildFollowUpAttemptMetadata(input: {
  attemptNumber: number;
  cycleStartedAt: string;
}): FollowUpAttemptMetadata {
  return {
    kind: FOLLOW_UP_ATTEMPT_KIND,
    attempt_number: input.attemptNumber,
    cycle_started_at: input.cycleStartedAt,
    campaign_id: null,
  };
}

/**
 * Estado do ciclo atual. `lastInboundAt` (quando informado) também encerra o
 * ciclo, mesmo que o inbound não tenha gerado evento no histórico.
 */
export function computeFollowUpCycle(
  events: FollowUpHistoryEvent[],
  options: { lastInboundAt?: string | null } = {},
): FollowUpCycleState {
  const timestamps = events
    .map((event) => ({ event, at: eventDate(event) }))
    .filter((item): item is { event: FollowUpHistoryEvent; at: string } => Boolean(item.at))
    .sort((a, b) => a.at.localeCompare(b.at));

  let cycleBoundary: string | null = options.lastInboundAt || null;
  for (const { event, at } of timestamps) {
    if (isCycleResetEvent(event) && (!cycleBoundary || at > cycleBoundary)) {
      cycleBoundary = at;
    }
  }

  const attempts = timestamps.filter(
    ({ event, at }) => isFollowUpAttemptEvent(event) && (!cycleBoundary || at > cycleBoundary),
  );

  const attemptCount = attempts.length;
  return {
    attemptCount,
    nextAttemptNumber: attemptCount + 1,
    limitReached: attemptCount >= FOLLOW_UP_CYCLE_LIMIT,
    cycleStartedAt: attempts[0]?.at ?? null,
  };
}

export interface FollowUpAttemptCheckInput {
  mode?: 'manual' | 'campaign';
  attendanceState?: string | null;
  returnAt?: string | null;
  lastInboundAt?: string | null;
  lastOutboundAt?: string | null;
}

/** Decide se um envio outbound deve ser registrado como tentativa real. */
export function shouldRegisterFollowUpAttempt(
  input: FollowUpAttemptCheckInput,
  now: Date = new Date(),
): boolean {
  if (input.mode === 'campaign') return false;
  if (!isWaitingCustomerState(input.attendanceState)) return false;

  // Precisa existir obrigação/retorno vencido motivando a retomada.
  if (!input.returnAt) return false;
  if (new Date(input.returnAt).getTime() > now.getTime()) return false;

  // Se o cliente respondeu depois do último outbound, isto é resposta normal.
  if (input.lastInboundAt) {
    const inbound = new Date(input.lastInboundAt).getTime();
    const outbound = input.lastOutboundAt ? new Date(input.lastOutboundAt).getTime() : 0;
    if (inbound > outbound) return false;
  }

  return true;
}

/** Rótulo discreto para a UI. Sem tentativas, não há rótulo. */
export function getFollowUpCycleLabel(state: FollowUpCycleState): string | null {
  if (state.attemptCount <= 0) return null;
  if (state.attemptCount >= FOLLOW_UP_CYCLE_LIMIT) {
    return `Última tentativa ${state.attemptCount} de ${FOLLOW_UP_CYCLE_LIMIT}`;
  }
  return `Follow-up ${state.attemptCount} de ${FOLLOW_UP_CYCLE_LIMIT}`;
}
