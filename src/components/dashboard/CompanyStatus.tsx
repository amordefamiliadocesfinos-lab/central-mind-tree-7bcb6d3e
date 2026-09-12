import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { ChevronDown, CheckCircle2, AlertTriangle, AlertOctagon, Activity } from 'lucide-react';
import { isWithinOperationalPeriod } from '@/lib/operationalStart';
import { cn, formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';

type Level = 'ok' | 'warn' | 'crit';

interface Indicator {
  key: string;
  label: string;
  detail: string;
  level: Level;
}

interface Snapshot {
  cashBalance: number;
  salesMonth: number;
  productionPending: number;
  ordersPending: number;
  tasksLate: number;
  receivablesLate: number;
}

const LEVEL_RANK: Record<Level, number> = { ok: 0, warn: 1, crit: 2 };

function evaluate(snap: Snapshot): { overall: Level; indicators: Indicator[] } {
  const inds: Indicator[] = [];

  // Caixa
  inds.push({
    key: 'cash',
    label: 'Caixa',
    detail: `Saldo atual: ${formatCurrency(snap.cashBalance, { compact: true })}`,
    level: snap.cashBalance < 0 ? 'crit' : snap.cashBalance < 1000 ? 'warn' : 'ok',
  });

  // Vendas
  inds.push({
    key: 'sales',
    label: 'Vendas',
    detail: `Valor dos pedidos no mês: ${formatCurrency(snap.salesMonth, { compact: true })}`,
    level: snap.salesMonth <= 0 ? 'crit' : snap.salesMonth < 1000 ? 'warn' : 'ok',
  });

  // Produção
  inds.push({
    key: 'production',
    label: 'Produção',
    detail: `${snap.productionPending} ordem(ns) em produção pendente`,
    level: snap.productionPending > 10 ? 'crit' : snap.productionPending > 5 ? 'warn' : 'ok',
  });

  // Pedidos pendentes
  inds.push({
    key: 'orders',
    label: 'Pedidos pendentes',
    detail: `${snap.ordersPending} pedido(s) aguardando`,
    level: snap.ordersPending > 15 ? 'crit' : snap.ordersPending > 7 ? 'warn' : 'ok',
  });

  // Tarefas atrasadas
  inds.push({
    key: 'tasks',
    label: 'Tarefas atrasadas',
    detail: `${snap.tasksLate} tarefa(s) vencida(s)`,
    level: snap.tasksLate > 10 ? 'crit' : snap.tasksLate > 3 ? 'warn' : 'ok',
  });

  // Recebíveis atrasados (apoia a análise de caixa)
  if (snap.receivablesLate > 0) {
    inds.push({
      key: 'receivables',
      label: 'Recebíveis atrasados',
      detail: `${formatCurrency(snap.receivablesLate, { compact: true })} em atraso`,
      level: snap.receivablesLate > 5000 ? 'crit' : 'warn',
    });
  }

  const overall = inds.reduce<Level>(
    (acc, i) => (LEVEL_RANK[i.level] > LEVEL_RANK[acc] ? i.level : acc),
    'ok'
  );

  return { overall, indicators: inds };
}

const LEVEL_META: Record<Level, { label: string; emoji: string; cls: string; icon: typeof CheckCircle2 }> = {
  ok: {
    label: 'Saudável',
    emoji: '🟢',
    cls: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/40 text-emerald-600',
    icon: CheckCircle2,
  },
  warn: {
    label: 'Atenção',
    emoji: '🟡',
    cls: 'from-amber-500/20 to-amber-500/5 border-amber-500/40 text-amber-600',
    icon: AlertTriangle,
  },
  crit: {
    label: 'Crítico',
    emoji: '🔴',
    cls: 'from-red-500/20 to-red-500/5 border-red-500/40 text-red-600',
    icon: AlertOctagon,
  },
};

export function CompanyStatus() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');

    const [accounts, orders, productionOrders, tasks, entries] = await Promise.all([
      supabase.from('financial_accounts').select('current_balance').eq('is_active', true),
      supabase.from('orders').select('id, operational_status, total_value, created_at').is('deleted_at', null),
      supabase.from('production_orders').select('id, status, created_at'),
      supabase.from('tasks').select('id, status, due_date').is('deleted_at', null),
      supabase.from('financial_entries').select('type, value, value_paid, due_date, payment_date'),
    ]);

    const cashBalance = (accounts.data || []).reduce((s, a: any) => s + (Number(a.current_balance) || 0), 0);

    const ordersAll = orders.data || [];
    const salesMonth = ordersAll
      .filter((o: any) => o.created_at && o.created_at >= monthStart && isWithinOperationalPeriod(o.created_at) && o.operational_status !== 'cancelled')
      .reduce((s, o: any) => s + (Number(o.total_value) || 0), 0);
    const ordersPending = ordersAll.filter((o: any) =>
      isWithinOperationalPeriod(o.created_at) && ['todo', 'preparing'].includes(o.operational_status || 'todo')
    ).length;
    const productionPending = (productionOrders.data || []).filter((op: any) =>
      isWithinOperationalPeriod(op.created_at) && ['aberto', 'producao'].includes(op.status)
    ).length;

    const inPeriod = (d?: string | null) => !!d && isWithinOperationalPeriod(d);

    const tasksLate = (tasks.data || []).filter(
      (t: any) => inPeriod(t.due_date) && t.due_date < today && t.status !== 'concluído' && t.status !== 'concluido'
    ).length;

    const receivablesLate = (entries.data || [])
      .filter((e: any) => e.type === 'receber' && !e.payment_date && inPeriod(e.due_date) && e.due_date < today
        && ((Number(e.value) || 0) - (Number(e.value_paid) || 0)) > 0.009)
      .reduce((s, e: any) => s + ((Number(e.value) || 0) - (Number(e.value_paid) || 0)), 0);

    setSnap({ cashBalance, salesMonth, productionPending, ordersPending, tasksLate, receivablesLate });
    setUpdatedAt(new Date());
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('company-status-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_entries' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_accounts' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_movements' }, load)
      .subscribe();

    const interval = setInterval(load, 60_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [load]);

  if (!snap) {
    return (
      <Card className="p-4 border-2 animate-pulse">
        <p className="text-sm text-muted-foreground">Analisando situação da empresa...</p>
      </Card>
    );
  }

  const { overall, indicators } = evaluate(snap);
  const meta = LEVEL_META[overall];
  const Icon = meta.icon;
  const impacting = indicators.filter((i) => i.level !== 'ok');

  return (
    <Card
      className={cn(
        'border-2 bg-gradient-to-br cursor-pointer overflow-hidden transition-all',
        meta.cls
      )}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="p-4 flex items-center gap-3">
        <div className={cn('p-2 rounded-full bg-background/60', meta.cls.split(' ').pop())}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Situação da Empresa
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Activity className="h-3 w-3" /> tempo real
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl">{meta.emoji}</span>
            <span className={cn('text-xl sm:text-2xl font-bold')}>{meta.label}</span>
            {impacting.length > 0 && (
              <span className="text-xs text-muted-foreground">
                · {impacting.length} indicador(es) impactando
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn('h-5 w-5 shrink-0 transition-transform text-muted-foreground', expanded && 'rotate-180')}
        />
      </div>

      {expanded && (
        <div className="border-t bg-background/40 p-3 space-y-2">
          {indicators.map((ind) => {
            const m = LEVEL_META[ind.level];
            return (
              <div
                key={ind.key}
                className="flex items-start gap-3 p-2 rounded-md bg-background/60"
              >
                <span className="text-lg leading-none mt-0.5">{m.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{ind.label}</span>
                    <span className={cn('text-[10px] font-bold uppercase', m.cls.split(' ').pop())}>
                      {m.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{ind.detail}</p>
                </div>
              </div>
            );
          })}
          {updatedAt && (
            <p className="text-[10px] text-muted-foreground text-right pt-1">
              Atualizado às {format(updatedAt, 'HH:mm:ss')}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
