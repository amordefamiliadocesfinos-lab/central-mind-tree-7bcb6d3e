import { AlertTriangle } from 'lucide-react';
import { differenceInDays, startOfDay, parseISO } from 'date-fns';
import { getNowSaoPaulo } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

interface LateProductionBadgeProps {
  dueDate: string | null | undefined;
  status: string;
  operationalStatus?: string | null;
  className?: string;
}

export function isProductionLate(dueDate: string | null | undefined, status: string, operationalStatus?: string | null): boolean {
  if (!dueDate) return false;
  if (operationalStatus === 'finalized' || operationalStatus === 'cancelled') return false;
  if (status === 'produzido' || status === 'concluido' || status === 'cancelado' || status === 'enviado' || status === 'entregue' || status === 'faturado') return false;
  const today = startOfDay(getNowSaoPaulo());
  const due = startOfDay(parseISO(dueDate));
  return differenceInDays(due, today) <= 0;
}

export function LateProductionBadge({ dueDate, status, operationalStatus, className }: LateProductionBadgeProps) {
  if (!isProductionLate(dueDate, status, operationalStatus)) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        'bg-destructive/15 text-destructive border-destructive/30 animate-pulse',
        className
      )}
    >
      <AlertTriangle className="h-3 w-3" />
      Produção atrasada
    </span>
  );
}
