/**
 * UX-CRM-03A — hierarquia visual da fila, somente apresentação.
 * Etapa, estado operacional, prioridade e janela Meta 24h são conceitos distintos.
 * Nunca inferir urgência pelo estágio nem modificar os predicados do motor CRM.
 */
import { normalizeCrmStage } from './model';
import type { CrmPriority } from './priority';

export type CrmInboxTone = 'danger' | 'warning' | 'info' | 'success' | 'commercial' | 'neutral';

const CRITICAL_REASONS = new Set<string>([
  'return_overdue', 'next_action_overdue', 'reactivation_overdue', 'follow_up_urgent',
]);
const ACTION_REASONS = new Set<string>([
  'needs_reply', 'pending_result', 'return_today', 'next_action_today', 'reactivation_today',
]);

export function getCrmInboxPriorityTone(priority: Pick<CrmPriority, 'reason' | 'level'>): CrmInboxTone {
  if (CRITICAL_REASONS.has(priority.reason)) return 'danger';
  if (ACTION_REASONS.has(priority.reason)) return 'warning';
  if (priority.level === 'P2') return 'info';
  return 'neutral';
}

export function getCrmInboxStageTone(stage: string | null | undefined): CrmInboxTone {
  switch (normalizeCrmStage(stage)) {
    case 'novo_lead': return 'info';
    case 'contato_realizado': return 'success';
    case 'proposta_enviada':
    case 'negociacao':
    case 'pos_venda': return 'commercial';
    case 'fechado': return 'success';
    case 'cadencia': return 'warning';
    case 'perdido': return 'neutral';
    default: return 'neutral';
  }
}

export function getCrmInboxAttendanceTone(state: string | null | undefined): CrmInboxTone {
  const normalized = state?.trim().toLowerCase();
  if (normalized === 'em_atendimento') return 'info';
  if (normalized === 'concluido' || normalized === 'resolvido') return 'success';
  if (normalized === 'responder' || normalized === 'retornar_em'
    || normalized === 'aguardando_cliente' || normalized === 'aguardando_resposta'
    || normalized === 'awaiting_response' || normalized === 'waiting_customer') return 'warning';
  return 'neutral';
}

/** Classes estáticas para o gerador Tailwind reconhecer todos os tons. */
export function getCrmInboxBadgeToneClass(tone: CrmInboxTone): string {
  switch (tone) {
    case 'danger':
      return 'border-red-300 bg-red-100 text-red-900 dark:border-red-700 dark:bg-red-950/60 dark:text-red-200';
    case 'warning':
      return 'border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200';
    case 'info':
      return 'border-sky-300 bg-sky-100 text-sky-950 dark:border-sky-700 dark:bg-sky-950/55 dark:text-sky-200';
    case 'success':
      return 'border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/55 dark:text-emerald-200';
    case 'commercial':
      return 'border-violet-300 bg-violet-100 text-violet-950 dark:border-violet-700 dark:bg-violet-950/55 dark:text-violet-200';
    default:
      return 'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';
  }
}

/** Sinal discreto de atenção: apenas o motivo canônico decide a cor da borda. */
export function getCrmInboxPriorityRailClass(tone: CrmInboxTone): string {
  switch (tone) {
    case 'danger': return 'border-l-red-600 dark:border-l-red-400';
    case 'warning': return 'border-l-amber-500 dark:border-l-amber-400';
    case 'info': return 'border-l-sky-500 dark:border-l-sky-400';
    default: return 'border-l-transparent';
  }
}
