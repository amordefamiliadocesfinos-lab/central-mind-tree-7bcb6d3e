import { describeOfficialNextActionChange } from './official-next-action.ts';

Deno.test('writer server-side descreve mudança de data como reagendamento', () => {
  const description = describeOfficialNextActionChange({
    previousTitle: 'Retomar contato',
    previousDueAt: '2026-10-09T12:00:00.000Z',
    nextTitle: 'Retomar contato',
    nextDueAt: '2026-10-19T03:00:00.000Z',
  });
  if (description !== 'Próxima ação reagendada: Retomar contato · 09/10/2026 → 19/10/2026') {
    throw new Error(`Descrição inesperada: ${description}`);
  }
});

Deno.test('writer server-side mantém substituição quando título muda', () => {
  const description = describeOfficialNextActionChange({
    previousTitle: 'Verificar resposta no WhatsApp',
    previousDueAt: '2026-10-11T12:00:00.000Z',
    nextTitle: 'Retomar contato',
    nextDueAt: '2026-10-19T03:00:00.000Z',
  });
  if (description !== 'Próxima ação substituída: Verificar resposta no WhatsApp → Retomar contato') {
    throw new Error(`Descrição inesperada: ${description}`);
  }
});
