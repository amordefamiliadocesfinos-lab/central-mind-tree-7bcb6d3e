import { getOfficialCrmNextActionAt } from './officialTask';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Official CRM task: ${message}`);
}

const dueAt = '2026-08-31T12:00:00.000Z';
assert(
  getOfficialCrmNextActionAt('2026-08-31T12:00:30.000Z', dueAt) === dueAt,
  'tarefa oficial coerente deve continuar operacional.',
);
assert(
  getOfficialCrmNextActionAt('2026-09-02T12:00:00.000Z', dueAt) === null,
  'tarefa substituída não pode competir com a próxima ação atual.',
);
assert(
  getOfficialCrmNextActionAt(null, dueAt) === null,
  'tarefa histórica sem próxima ação atual não pode reabrir a fila.',
);
