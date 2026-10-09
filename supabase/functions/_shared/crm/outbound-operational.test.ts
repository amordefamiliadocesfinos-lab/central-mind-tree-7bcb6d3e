import { isRealFollowUpOutbound } from './outbound-operational.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`outbound-operational: ${message}`);
}

const due = isRealFollowUpOutbound({
  id: 'c1',
  attendance_state: 'aguardando_cliente',
  return_at: '2026-10-09T12:00:00.000Z',
  last_inbound_at: '2026-10-08T10:00:00.000Z',
  last_outbound_at: '2026-10-08T11:00:00.000Z',
}, '2026-10-09T14:00:00.000Z');
assert(due, 'retorno vencido em estado de espera deve contar como follow-up real.');

const future = isRealFollowUpOutbound({
  id: 'c1',
  attendance_state: 'aguardando_cliente',
  return_at: '2026-10-10T12:00:00.000Z',
  last_inbound_at: '2026-10-08T10:00:00.000Z',
  last_outbound_at: '2026-10-08T11:00:00.000Z',
}, '2026-10-09T14:00:00.000Z');
assert(!future, 'retorno futuro não pode ser contado antecipadamente.');

const customerReplied = isRealFollowUpOutbound({
  id: 'c1',
  attendance_state: 'aguardando_cliente',
  return_at: '2026-10-09T12:00:00.000Z',
  last_inbound_at: '2026-10-09T13:30:00.000Z',
  last_outbound_at: '2026-10-08T11:00:00.000Z',
}, '2026-10-09T14:00:00.000Z');
assert(!customerReplied, 'nova entrada do cliente reinicia o ciclo e não é follow-up.');

console.log('outbound-operational.test: OK');
