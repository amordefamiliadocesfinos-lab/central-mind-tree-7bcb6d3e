/**
 * Marco de início da operação real do Painel Central.
 *
 * Tudo que é anterior a esta data continua existindo no histórico dos módulos,
 * mas é neutralizado nos indicadores operacionais (dashboard, prioridades,
 * resumo do dia) para que a gestão diária se baseie apenas no período atual.
 */
export const OPERATIONAL_START_DATE = '2026-09-01';

/** Retorna true quando a data (YYYY-MM-DD ou ISO) é anterior ao início da operação. */
export function isBeforeOperationalStart(date?: string | null): boolean {
  if (!date) return false;
  return date.slice(0, 10) < OPERATIONAL_START_DATE;
}

/** Mantém apenas datas dentro do período operacional vigente. */
export function isWithinOperationalPeriod(date?: string | null): boolean {
  if (!date) return true;
  return !isBeforeOperationalStart(date);
}
