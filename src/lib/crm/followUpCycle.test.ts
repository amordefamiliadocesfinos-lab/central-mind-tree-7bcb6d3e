import {
  buildFollowUpAttemptMetadata,
  computeFollowUpCycle,
  getFollowUpCycleLabel,
  shouldRegisterFollowUpAttempt,
  type FollowUpHistoryEvent,
} from './followUpCycle';

const attempt = (at: string, n: number): FollowUpHistoryEvent => ({
  event_code: 'follow_up_completed',
  event_metadata: buildFollowUpAttemptMetadata({ attemptNumber: n, cycleStartedAt: at }),
  interaction_date: at,
});

const legacyMessage = (at: string): FollowUpHistoryEvent => ({
  event_code: 'message_sent',
  event_metadata: { source: 'crm_card' },
  interaction_date: at,
});

const now = new Date('2026-09-02T18:00:00.000Z');

const check = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const describe = (_name: string, fn: () => void) => fn();
const it = (_name: string, fn: () => void) => fn();
const expect = (received: unknown) => ({
  toBe: (value: unknown) => check(received === value, `esperado ${String(value)}, recebido ${String(received)}`),
  toBeNull: () => check(received === null, `esperado null, recebido ${String(received)}`),
});

describe('followUpCycle', () => {
  it('A/B/C — conta tentativas reais do ciclo', () => {
    expect(computeFollowUpCycle([attempt('2026-09-01T10:00:00Z', 1)]).attemptCount).toBe(1);
    const two = computeFollowUpCycle([attempt('2026-09-01T10:00:00Z', 1), attempt('2026-09-02T10:00:00Z', 2)]);
    expect(two.attemptCount).toBe(2);
    expect(two.nextAttemptNumber).toBe(3);
    expect(two.limitReached).toBe(false);
    const three = computeFollowUpCycle([
      attempt('2026-09-01T10:00:00Z', 1),
      attempt('2026-09-02T10:00:00Z', 2),
      attempt('2026-09-03T10:00:00Z', 3),
    ]);
    expect(three.attemptCount).toBe(3);
    expect(three.limitReached).toBe(true);
    expect(getFollowUpCycleLabel(three)).toBe('Última tentativa 3 de 3');
  });

  it('D — reagendamento sozinho não incrementa', () => {
    expect(shouldRegisterFollowUpAttempt({
      mode: 'manual',
      attendanceState: 'aguardando_cliente',
      returnAt: '2026-09-05T10:00:00Z', // futuro: obrigação não vencida
    }, now)).toBe(false);
  });

  it('E — resposta normal a inbound não incrementa', () => {
    expect(shouldRegisterFollowUpAttempt({
      mode: 'manual',
      attendanceState: 'aguardando_cliente',
      returnAt: '2026-09-01T10:00:00Z',
      lastInboundAt: '2026-09-02T17:00:00Z',
      lastOutboundAt: '2026-09-01T09:00:00Z',
    }, now)).toBe(false);
  });

  it('F — campanha nunca incrementa', () => {
    expect(shouldRegisterFollowUpAttempt({
      mode: 'campaign',
      attendanceState: 'aguardando_cliente',
      returnAt: '2026-09-01T10:00:00Z',
    }, now)).toBe(false);
  });

  it('follow-up real é identificado', () => {
    expect(shouldRegisterFollowUpAttempt({
      mode: 'manual',
      attendanceState: 'aguardando_resposta',
      returnAt: '2026-09-01T10:00:00Z',
      lastInboundAt: '2026-08-30T10:00:00Z',
      lastOutboundAt: '2026-08-31T10:00:00Z',
    }, now)).toBe(true);
  });

  it('G — inbound real encerra/reinicia o ciclo', () => {
    const state = computeFollowUpCycle(
      [attempt('2026-09-01T10:00:00Z', 1), attempt('2026-09-02T10:00:00Z', 2)],
      { lastInboundAt: '2026-09-02T12:00:00Z' },
    );
    expect(state.attemptCount).toBe(0);
    expect(state.nextAttemptNumber).toBe(1);
    expect(getFollowUpCycleLabel(state)).toBeNull();

    const afterSale = computeFollowUpCycle([
      attempt('2026-09-01T10:00:00Z', 1),
      { event_code: 'sale_won', interaction_date: '2026-09-01T12:00:00Z' },
      attempt('2026-09-02T10:00:00Z', 1),
    ]);
    expect(afterSale.attemptCount).toBe(1);
  });

  it('H — histórico antigo não é contado artificialmente', () => {
    const state = computeFollowUpCycle([
      legacyMessage('2026-08-01T10:00:00Z'),
      legacyMessage('2026-08-05T10:00:00Z'),
    ]);
    expect(state.attemptCount).toBe(0);
    expect(getFollowUpCycleLabel(state)).toBeNull();
  });
});
