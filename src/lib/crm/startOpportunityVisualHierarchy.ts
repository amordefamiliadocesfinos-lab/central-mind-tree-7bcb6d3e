/** UX-CRM-03C: apresentação somente; nunca cria sinal comercial. */
import type { StartOpportunityDisplayState } from './startOpportunityPresentation';

export type CrmStartSection = 'post_sale' | 'repurchase' | 'campaigns';

export function getCrmStartRecommendationCardClass(state: StartOpportunityDisplayState): string {
  switch (state) {
    case 'recommended':
      return 'border-violet-300 border-l-4 border-l-violet-600 bg-violet-50/40 dark:border-violet-800 dark:border-l-violet-400 dark:bg-violet-950/20';
    case 'blocked':
      return 'border-amber-300 border-l-4 border-l-amber-500 bg-amber-50/40 dark:border-amber-800 dark:border-l-amber-400 dark:bg-amber-950/20';
    case 'error':
      return 'border-red-300 border-l-4 border-l-red-500 bg-red-50/30 dark:border-red-800 dark:border-l-red-400 dark:bg-red-950/20';
    default:
      return 'border-slate-200 border-l-4 border-l-slate-400 bg-white dark:border-slate-700 dark:border-l-slate-500 dark:bg-slate-900/60';
  }
}

export function getCrmStartSectionCardClass(section: CrmStartSection): string {
  switch (section) {
    case 'post_sale':
      return 'border-teal-200 border-t-[3px] border-t-teal-600 bg-teal-50/30 dark:border-teal-800 dark:border-t-teal-400 dark:bg-teal-950/15';
    case 'repurchase':
      return 'border-sky-200 border-t-[3px] border-t-sky-600 bg-sky-50/30 dark:border-sky-800 dark:border-t-sky-400 dark:bg-sky-950/15';
    case 'campaigns':
      return 'border-violet-200 border-t-[3px] border-t-violet-600 bg-violet-50/30 dark:border-violet-800 dark:border-t-violet-400 dark:bg-violet-950/15';
  }
}
