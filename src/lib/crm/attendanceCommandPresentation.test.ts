import { getConcludeAttendanceWarning, getArchiveAttendanceWarning } from './attendanceCommandPresentation';
function assert(condition: unknown, reason: string): asserts condition { if (!condition) throw Error('CRM D-03: ' + reason); }
const none = { pendingResult: false, officialTaskPresent: false, operationalReturnScheduled: false };
assert(getConcludeAttendanceWarning(none) === null, 'conclusão sem pendência não cria confirmação extra');
assert(getConcludeAttendanceWarning({ ...none, pendingResult: true })?.includes('Resultado comercial pendente'), 'resultado requer explicação contextual');
assert(getConcludeAttendanceWarning({ ...none, officialTaskPresent: true })?.includes('continuará pendente'), 'não concluir tarefa');
assert(getConcludeAttendanceWarning({ ...none, operationalReturnScheduled: true })?.includes('não será removido'), 'Concluir preserva retorno');
const multiple = getConcludeAttendanceWarning({ pendingResult: true, officialTaskPresent: true, operationalReturnScheduled: true });
assert(Boolean(multiple?.includes('Resultado') && multiple?.includes('tarefa') && multiple?.includes('retorno')), 'pendências acumuladas explicadas');
const archived = getArchiveAttendanceWarning({ officialTaskPresent: true });
assert(archived.includes('retorno operacional será removido'), 'Arquivar remove retorno');
assert(archived.includes('não será concluída por Arquivar'), 'tarefa oficial preservada');
assert(getArchiveAttendanceWarning({ officialTaskPresent: false }).includes('histórico'), 'Arquivar não exclui histórico');
console.log('attendanceCommandPresentation.test: OK');
