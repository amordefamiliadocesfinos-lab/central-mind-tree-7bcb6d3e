/**
 * UX-CRM-03B: cores somente para filtros ATIVOS. Não altera predicados
 * de consulta, prioridades, elegibilidade nem SLA.
 */
export type CrmInboxVisualFilter = 'priority' | 'needs_reply' | 'today' | 'overdue' | 'cooling';

export function getCrmInboxFilterClass(filter: CrmInboxVisualFilter, active: boolean): string {
  if (!active) return 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800';
  switch (filter) {
    case 'priority':
      return 'border-sky-600 bg-sky-100 text-sky-950 hover:bg-sky-200 dark:border-sky-500 dark:bg-sky-950 dark:text-sky-100 dark:hover:bg-sky-900';
    case 'needs_reply':
      return 'border-amber-600 bg-amber-100 text-amber-950 hover:bg-amber-200 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900';
    case 'today':
      return 'border-teal-600 bg-teal-100 text-teal-950 hover:bg-teal-200 dark:border-teal-500 dark:bg-teal-950 dark:text-teal-100 dark:hover:bg-teal-900';
    case 'overdue':
      return 'border-red-600 bg-red-100 text-red-950 hover:bg-red-200 dark:border-red-500 dark:bg-red-950 dark:text-red-100 dark:hover:bg-red-900';
    case 'cooling':
      return 'border-violet-600 bg-violet-100 text-violet-950 hover:bg-violet-200 dark:border-violet-500 dark:bg-violet-950 dark:text-violet-100 dark:hover:bg-violet-900';
  }
}
