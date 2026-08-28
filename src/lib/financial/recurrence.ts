import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  format,
  isWeekend,
  parseISO,
  startOfMonth,
} from 'date-fns';

export interface RecurrenceRule {
  recurrence_type?: string | null;
  recurrence_day?: number | null;
  recurrence_end_date?: string | null;
  recurrence_use_business_days?: boolean | null;
}

const MONTH_STEP: Record<string, number> = {
  mensal: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

const MAX_OCCURRENCES = 120;

/**
 * Gera as datas de vencimento das ocorrências futuras de uma regra de recorrência.
 * Para recorrências mensais (e múltiplos de mês) o "dia de vencimento" é respeitado,
 * usando o último dia válido quando o mês não possui o dia configurado.
 */
export function buildRecurrenceDueDates(baseDueDate: string, rule: RecurrenceRule): string[] {
  const type = rule.recurrence_type;
  if (!type || !rule.recurrence_end_date || !baseDueDate) return [];

  const base = parseISO(baseDueDate);
  const end = parseISO(rule.recurrence_end_date);
  if (Number.isNaN(base.getTime()) || Number.isNaN(end.getTime())) return [];

  const rawDay = Number(rule.recurrence_day);
  const targetDay = rawDay >= 1 && rawDay <= 31 ? rawDay : base.getDate();
  const useBusinessDays = !!rule.recurrence_use_business_days;

  const dates: string[] = [];
  for (let i = 1; i <= MAX_OCCURRENCES; i++) {
    let cursor: Date;
    if (type === 'semanal') {
      cursor = addWeeks(base, i);
    } else if (type === 'quinzenal') {
      cursor = addDays(base, 15 * i);
    } else {
      const step = MONTH_STEP[type] ?? 1;
      const month = addMonths(startOfMonth(base), step * i);
      const lastDay = endOfMonth(month).getDate();
      cursor = new Date(month.getFullYear(), month.getMonth(), Math.min(targetDay, lastDay));
    }

    if (cursor > end) break;

    let due = cursor;
    if (useBusinessDays) {
      while (isWeekend(due)) due = addDays(due, 1);
    }
    dates.push(format(due, 'yyyy-MM-dd'));
  }

  return dates;
}
