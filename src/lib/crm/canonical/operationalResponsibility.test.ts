import { CRM_CANONICAL_RESULTS } from './results';
import { getCanonicalNextAction } from './nextActions';
import { getCrmPriority } from '../priority';
import {
  CRM_RESULT_OPERATIONAL_RESPONSIBILITY,
  shouldAwaitCustomerAfterCanonicalResult,
} from './operationalResponsibility';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Operational responsibility: ${message}`);
}

assert(Object.keys(CRM_RESULT_OPERATIONAL_RESPONSIBILITY).length === 33, 'all canonical results must be classified.');
for (const result of CRM_CANONICAL_RESULTS) {
  assert(CRM_RESULT_OPERATIONAL_RESPONSIBILITY[result.code] != null, `${result.code} must have a responsibility.`);
}

assert(shouldAwaitCustomerAfterCanonicalResult({ resultCode: 'CRM-RES-018', nextAction: null, nextActionScheduled: false }), 'awaiting payment without guidance must wait for the customer.');
assert(!shouldAwaitCustomerAfterCanonicalResult({ resultCode: 'CRM-RES-018', nextAction: getCanonicalNextAction('CRM-PA-012'), nextActionScheduled: false }), 'payment guidance is an immediate operator action.');
assert(shouldAwaitCustomerAfterCanonicalResult({ resultCode: 'CRM-RES-003', nextAction: getCanonicalNextAction('CRM-PA-014'), nextActionScheduled: true }), 'scheduled silence follow-up must wait until due.');
assert(!shouldAwaitCustomerAfterCanonicalResult({ resultCode: 'CRM-RES-001', nextAction: getCanonicalNextAction('CRM-PA-001'), nextActionScheduled: false }), 'interest with qualification remains with the operator.');

for (const code of ['CRM-RES-003', 'CRM-RES-008', 'CRM-RES-013', 'CRM-RES-026'] as const) {
  assert(shouldAwaitCustomerAfterCanonicalResult({ resultCode: code, nextAction: null, nextActionScheduled: false }), `${code} must preserve the waiting-customer behavior.`);
}

const now = new Date('2026-08-27T12:00:00.000Z');
assert(!getCrmPriority({ attendance_state: 'aguardando_cliente' }, now).operational, 'awaiting customer without a due signal must stay outside the priority queue.');
assert(getCrmPriority({
  attendance_state: 'aguardando_cliente',
  attendance_state_updated_at: '2026-08-27T10:00:00.000Z',
  last_outbound_at: '2026-08-27T09:59:00.000Z',
  last_message_at: '2026-08-27T10:05:00.000Z',
  last_inbound_at: '2026-08-27T10:05:00.000Z',
  last_result_at: '2026-08-27T09:58:00.000Z',
  needs_reply: true,
}, now).reason === 'needs_reply', 'a new customer message must return to attention.');
assert(getCrmPriority({
  attendance_state: 'aguardando_cliente',
  attendance_state_updated_at: '2026-08-25T10:00:00.000Z',
  last_outbound_at: '2026-08-25T09:59:00.000Z',
  last_message_at: '2026-08-25T09:59:00.000Z',
  last_inbound_at: '2026-08-25T09:00:00.000Z',
  return_at: '2026-08-26T10:00:00.000Z',
}, now).reason === 'return_overdue', 'a due return must return to attention.');
