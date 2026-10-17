import { createAttendanceWriteGate, isConfirmedAttendanceMutation } from './attendanceCommandSafety';
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw Error('CRM D-01: ' + message); }

assert(isConfirmedAttendanceMutation({ id: 'c-1' }, 'c-1'), 'linha efetivamente alterada');
assert(!isConfirmedAttendanceMutation(null, 'c-1'), 'UPDATE de zero linhas não é sucesso');
assert(!isConfirmedAttendanceMutation(undefined, 'c-1'), 'resposta ausente não é sucesso');
assert(!isConfirmedAttendanceMutation({ id: 'c-2' }, 'c-1'), 'não confirmar conversa errada');
assert(!isConfirmedAttendanceMutation({ id: 'c-1' }, null), 'sem ID de conversa não gravar');
const gate = createAttendanceWriteGate();
assert(!gate.locked(), 'começa destravada');
assert(gate.acquire(), 'primeira operação entra');
assert(gate.locked() && !gate.acquire(), 'segunda operação simultânea bloqueada');
gate.release();
assert(!gate.locked() && gate.acquire(), 'após finalizar permite nova operação');
gate.release();
console.log('attendanceCommandSafety.test: OK');
