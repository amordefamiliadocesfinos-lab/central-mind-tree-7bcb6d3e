import { format, isValid, parseISO } from 'date-fns';

/** Origem da escolha, não autoria ou validação do fato comercial. */
export type CrmResultSelectionOrigin = 'manual' | 'assistant_prefill_confirmed';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Só Retorno combinado permite uma data neste formulário.
 * Ao trocar de Resultado, nunca reutilizar uma data selecionada anteriormente.
 */
export function getCrmResultScheduledFor(resultCode: string, date: string, time: string): string | null {
  if (resultCode !== 'CRM-RES-022' || !DATE_ONLY.test(date)) return null;
  return /^\d{2}:\d{2}$/.test(time) ? `${date}T${time}` : date;
}

/** Data sem horário é compromisso do dia, não agendamento explícito à meia-noite. */
export function formatCrmResultNextActionDate(
  nextActionDate: string | null | undefined,
  scheduledFor?: string | null,
): string {
  if (!nextActionDate) return '';
  if (scheduledFor && DATE_ONLY.test(scheduledFor)) {
    return ` em ${scheduledFor.slice(8, 10)}/${scheduledFor.slice(5, 7)} (ao longo do dia)`;
  }
  const date = parseISO(nextActionDate);
  return isValid(date) ? ` em ${format(date, 'dd/MM HH:mm')}` : '';
}
