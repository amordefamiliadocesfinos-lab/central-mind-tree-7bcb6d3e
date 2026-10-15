import { formatCrmResultNextActionDate, getCrmResultScheduledFor } from './resultRegistrationPresentation';

function assert(value: unknown, label: string): asserts value {
  if (!value) throw new Error('CRM uso real — ' + label);
}

const date = '2026-10-19';
assert(getCrmResultScheduledFor('CRM-RES-022', date, '') === date,
  'data-only é permitida para Retorno combinado');
assert(getCrmResultScheduledFor('CRM-RES-022', date, '13:30') === '2026-10-19T13:30',
  'horário explícito preservado no Retorno combinado');
assert(getCrmResultScheduledFor('CRM-RES-027', date, '13:30') === null,
  'troca para Experiência neutra não pode transportar data de Retorno combinado');
assert(getCrmResultScheduledFor('CRM-RES-004', date, '') === null,
  'troca para Nova necessidade não pode transportar uma data escondida');
assert(getCrmResultScheduledFor('CRM-RES-022', '', '') === null,
  'ausência de data não agenda retorno');
assert(formatCrmResultNextActionDate('2026-10-19T03:00:00.000Z', date) === ' em 19/10 (ao longo do dia)',
  'data sem horário não deve aparecer como agendamento à meia-noite');
const withExplicitTime = formatCrmResultNextActionDate('2026-10-19T16:30:00.000Z', '2026-10-19T13:30');
assert(/^ em \d{2}\/\d{2} \d{2}:\d{2}$/.test(withExplicitTime),
  'horário declarado permanece visível');
assert(formatCrmResultNextActionDate(null, date) === '', 'ausência de data não gera rótulo');
console.log('resultRegistrationPresentation.test: OK');
