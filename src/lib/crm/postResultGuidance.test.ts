import { getCrmPostResultGuidance } from './postResultGuidance';
import { getCrmPriority } from './priority';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error('CRM F4 post result: ' + message);
}
const now = new Date('2026-11-05T16:00:00Z');
const reply = getCrmPostResultGuidance(getCrmPriority({
  status: 'open', needs_reply: true, last_inbound_at: '2026-11-05T15:30:00Z',
}, now), null, false);
assert(reply.target === 'reply' && reply.keepInFocus, 'mensagem pendente exige responder e permanecer em foco');
const due = getCrmPostResultGuidance(getCrmPriority({
  status: 'open', next_action_date: '2026-11-04T13:00:00Z',
  last_result_at: '2026-11-05T14:00:00Z',
}, now), 'Realizar pós-venda', false);
assert(due.keepInFocus && due.target === 'history' && due.explanation.includes('Realizar pós-venda'),
  'obrigação vencida exige conferir, não avançar automaticamente');
const waiting = getCrmPostResultGuidance(getCrmPriority({
  status: 'open', attendance_state: 'aguardando_cliente',
  last_outbound_at: '2026-11-05T15:00:00Z',
  last_result_at: '2026-11-05T15:05:00Z',
}, now), null, false);
assert(!waiting.keepInFocus && waiting.target === 'none', 'espera sem pendência permite avançar');
const operation = getCrmPostResultGuidance(getCrmPriority({ status: 'resolved' }, now), null, true);
assert(operation.keepInFocus && operation.target === 'none' && operation.title.includes('operacional'),
  'encaminhamento operacional deve permanecer visível');
const pending = getCrmPostResultGuidance({ level: 'P1', reason: 'pending_result', label: 'Registrar resultado', sortAt: 0, operational: true }, null, false);
assert(pending.keepInFocus && pending.target === 'history', 'não pedir Resultado duplicado após classificação');
console.log('postResultGuidance.test: OK');
