import { getOfficialCrmNextActionAt } from './officialTask';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Official CRM task: ${message}`);
}

const dueAt = '2026-08-31T12:00:00.000Z';
assert(
  getOfficialCrmNextActionAt(dueAt) === dueAt,
  'tarefa pendente com source oficial deve determinar sua própria data.',
);
assert(
  getOfficialCrmNextActionAt(null) === null,
  'ausência de tarefa oficial não pode criar obrigação na fila.',
);
