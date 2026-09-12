import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  AlertOctagon,
  TrendingDown,
  Package,
  Timer,
  Wallet,
  Target,
  ArrowRight,
  Activity,
  Wrench,
  Boxes,
} from 'lucide-react';
import { OPERATIONAL_START_DATE, isWithinOperationalPeriod } from '@/lib/operationalStart';
import { cn, formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { useKPIsSelector } from '@/stores/selectors';

type Bottleneck = {
  id: string;
  title: string;
  description: string;
  severity: 'crit' | 'warn';
  icon: React.ElementType;
  href: string;
  cta: string;
};

function pickBottleneck(data: {
  cashBalance: number;
  salesMonth: number;
  productionPending: number;
  ordersPending: number;
  tasksLate: number;
  lowStockCount: number;
  receivablesLate: number;
}): Bottleneck | null {
  const candidates: Bottleneck[] = [];

  // 1. Caixa negativo — sempre crítico
  if (data.cashBalance < 0) {
    candidates.push({
      id: 'cash',
      title: 'Caixa insuficiente',
      description: `Saldo negativo de ${formatCurrency(Math.abs(data.cashBalance), { compact: true })}. A empresa não cobre despesas imediatas.`,
      severity: 'crit',
      icon: Wallet,
      href: '/financeiro',
      cta: 'Ver financeiro',
    });
  } else if (data.cashBalance < 1000) {
    candidates.push({
      id: 'cash_low',
      title: 'Caixa baixo',
      description: `Saldo de apenas ${formatCurrency(data.cashBalance, { compact: true })}. Risco de não honrar compromissos.`,
      severity: 'warn',
      icon: Wallet,
      href: '/financeiro',
      cta: 'Ver financeiro',
    });
  }

  // 2. Recebíveis atrasados — impacta caixa
  if (data.receivablesLate > 5000) {
    candidates.push({
      id: 'receivables',
      title: 'Recebíveis atrasados',
      description: `${formatCurrency(data.receivablesLate, { compact: true })} em recebimentos atrasados. Cobrança urgente necessária.`,
      severity: 'crit',
      icon: TrendingDown,
      href: '/financeiro',
      cta: 'Cobrar agora',
    });
  } else if (data.receivablesLate > 0) {
    candidates.push({
      id: 'receivables_low',
      title: 'Recebíveis atrasados',
      description: `${formatCurrency(data.receivablesLate, { compact: true })} em atraso. Acompanhe as cobranças.`,
      severity: 'warn',
      icon: TrendingDown,
      href: '/financeiro',
      cta: 'Cobrar agora',
    });
  }

  // 3. Produção acumulada
  if (data.productionPending > 10) {
    candidates.push({
      id: 'production',
      title: 'Produção abaixo da meta',
      description: `${data.productionPending} ordens em produção sem conclusão. Prazos de entrega em risco.`,
      severity: 'crit',
      icon: Wrench,
      href: '/operacoes',
      cta: 'Ver produção',
    });
  } else if (data.productionPending > 5) {
    candidates.push({
      id: 'production_low',
      title: 'Produção lenta',
      description: `${data.productionPending} ordens em produção. Capacidade pode estar no limite.`,
      severity: 'warn',
      icon: Wrench,
      href: '/operacoes',
      cta: 'Ver produção',
    });
  }

  // 4. Pedidos pendentes
  if (data.ordersPending > 15) {
    candidates.push({
      id: 'orders',
      title: 'Muitos pedidos pendentes',
      description: `${data.ordersPending} pedidos aguardando aprovação ou início. Clientes podem desistir.`,
      severity: 'crit',
      icon: Package,
      href: '/operacoes',
      cta: 'Ver pedidos',
    });
  } else if (data.ordersPending > 7) {
    candidates.push({
      id: 'orders_low',
      title: 'Pedidos pendentes',
      description: `${data.ordersPending} pedidos não iniciados. Avalie prioridades de atendimento.`,
      severity: 'warn',
      icon: Package,
      href: '/operacoes',
      cta: 'Ver pedidos',
    });
  }

  // 5. Tarefas atrasadas
  if (data.tasksLate > 10) {
    candidates.push({
      id: 'tasks',
      title: 'Muitas tarefas atrasadas',
      description: `${data.tasksLate} tarefas vencidas. Planejamento e execução estão desalinhados.`,
      severity: 'crit',
      icon: Target,
      href: '/foco',
      cta: 'Ver tarefas',
    });
  } else if (data.tasksLate > 3) {
    candidates.push({
      id: 'tasks_low',
      title: 'Tarefas atrasadas',
      description: `${data.tasksLate} tarefas vencidas. Revisar prioridades do time.`,
      severity: 'warn',
      icon: Target,
      href: '/foco',
      cta: 'Ver tarefas',
    });
  }

  // 6. Estoque baixo
  if (data.lowStockCount > 0) {
    candidates.push({
      id: 'stock',
      title: 'Estoque baixo',
      description: `${data.lowStockCount} produto(s) com estoque abaixo do mínimo. Risco de quebra de produção/venda.`,
      severity: 'warn',
      icon: Boxes,
      href: '/operacoes',
      cta: 'Repor estoque',
    });
  }

  if (candidates.length === 0) return null;

  // Ordena: críticos primeiro, depois o que tiver maior "peso" (mais severo/magnitude)
  candidates.sort((a, b) => {
    if (a.severity === 'crit' && b.severity !== 'crit') return -1;
    if (a.severity !== 'crit' && b.severity === 'crit') return 1;
    return 0;
  });

  return candidates[0];
}

const SEVERITY_META = {
  crit: {
    border: 'border-red-500/50',
    bg: 'from-red-500/15 to-red-500/5',
    text: 'text-red-600',
    iconBg: 'bg-red-500/20',
    badge: 'bg-red-500 text-white',
  },
  warn: {
    border: 'border-amber-500/50',
    bg: 'from-amber-500/15 to-amber-500/5',
    text: 'text-amber-600',
    iconBg: 'bg-amber-500/20',
    badge: 'bg-amber-500 text-white',
  },
};

export function BottleneckCard() {
  const [bottleneck, setBottleneck] = useState<Bottleneck | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const lowStockCount = useKPIsSelector().lowStock.length;

  const load = useCallback(async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const [accounts, orders, productionOrders, tasks, entries] = await Promise.all([
      supabase.from('financial_accounts').select('current_balance').eq('is_active', true),
      supabase.from('orders').select('id, operational_status, created_at').is('deleted_at', null).gte('created_at', OPERATIONAL_START_DATE),
      supabase.from('production_orders').select('id, status, created_at').gte('created_at', OPERATIONAL_START_DATE),
      supabase.from('tasks').select('id, status, due_date').is('deleted_at', null),
      supabase.from('financial_entries').select('type, value, value_paid, due_date, payment_date'),
    ]);

    const cashBalance = (accounts.data || []).reduce((s, a: any) => s + (Number(a.current_balance) || 0), 0);

    const ordersAll = orders.data || [];
    const productionPending = (productionOrders.data || []).filter((o: any) =>
      ['aberto', 'producao'].includes(o.status)
    ).length;
    const ordersPending = ordersAll.filter((o: any) =>
      ['todo', 'preparing'].includes(o.operational_status ?? 'todo')
    ).length;

    const inPeriod = (d?: string | null) => !!d && isWithinOperationalPeriod(d);

    const tasksLate = (tasks.data || []).filter(
      (t: any) => inPeriod(t.due_date) && t.due_date < today && t.status !== 'concluído' && t.status !== 'concluido'
    ).length;

    const receivablesLate = (entries.data || [])
      .filter((e: any) => e.type === 'receber' && !e.payment_date && inPeriod(e.due_date) && e.due_date < today
        && ((Number(e.value) || 0) - (Number(e.value_paid) || 0)) > 0.009)
      .reduce((s, e: any) => s + ((Number(e.value) || 0) - (Number(e.value_paid) || 0)), 0);

    setBottleneck(
      pickBottleneck({ cashBalance, salesMonth: 0, productionPending, ordersPending, tasksLate, lowStockCount, receivablesLate })
    );
    setUpdatedAt(new Date());
  }, [lowStockCount]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('bottleneck-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_entries' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_accounts' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_movements' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, load)
      .subscribe();

    const interval = setInterval(load, 60_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [load]);

  if (bottleneck === null) {
    return (
      <Card className="border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-emerald-500/20">
            <Activity className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Maior Gargalo Atual
            </p>
            <p className="text-lg font-bold text-emerald-600 mt-0.5">Nenhum gargalo identificado</p>
            <p className="text-xs text-muted-foreground">Todos os indicadores estão dentro dos parâmetros.</p>
          </div>
        </div>
      </Card>
    );
  }

  const meta = SEVERITY_META[bottleneck.severity];
  const Icon = bottleneck.severity === 'crit' ? AlertOctagon : AlertTriangle;

  return (
    <Card className={cn('border-2 bg-gradient-to-br overflow-hidden', meta.border, meta.bg)}>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-full', meta.iconBg)}>
              <Icon className={cn('h-6 w-6', meta.text)} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Maior Gargalo Atual
              </p>
              <p className={cn('text-lg font-bold mt-0.5', meta.text)}>{bottleneck.title}</p>
            </div>
          </div>
          <span className={cn('text-[10px] font-bold uppercase px-2 py-1 rounded-full', meta.badge)}>
            {bottleneck.severity === 'crit' ? 'Crítico' : 'Atenção'}
          </span>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed pl-[3.25rem]">
          {bottleneck.description}
        </p>

        <div className="flex items-center justify-between pl-[3.25rem]">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Activity className="h-3 w-3" /> tempo real
            {updatedAt && (
              <span>· atualizado às {format(updatedAt, 'HH:mm')}</span>
            )}
          </span>
          <Link to={bottleneck.href}>
            <Button size="sm" variant="secondary" className="h-7 gap-1 text-xs">
              {bottleneck.cta}
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
