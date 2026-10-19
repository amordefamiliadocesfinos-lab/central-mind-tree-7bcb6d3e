import { getCrmFormExitReason, isCrmTaskDraftModified } from './crmFormExitProtection';
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw Error('E-03.4: ' + message); }
const baseline = { title: 'Retornar', date: '2026-10-21', time: '09:00' };
assert(!isCrmTaskDraftModified(baseline, { ...baseline }), 'não bloquear reagendamento intacto');
assert(isCrmTaskDraftModified(baseline, { ...baseline, time: '10:00' }), 'detectar edição de horário');
assert(isCrmTaskDraftModified(baseline, { ...baseline, title: 'Visitar' }), 'detectar edição de título');
assert(isCrmTaskDraftModified(baseline, { ...baseline, date: '2026-10-22' }), 'detectar edição de data');
assert(getCrmFormExitReason('contact', false, false) === null, 'contato intacto liberado');
assert(getCrmFormExitReason('task', false, false) === null, 'reagendamento intacto liberado');
assert(getCrmFormExitReason('contact', true, false)?.includes('contato'), 'contato com alterações protegido');
assert(getCrmFormExitReason('task', true, false)?.includes('reagendamento'), 'tarefa com alterações protegida');
assert(getCrmFormExitReason('task', false, true)?.includes('gravação'), 'bloqueio de gravação mesmo sem edição');
console.log('crmFormExitProtection.test: OK');
