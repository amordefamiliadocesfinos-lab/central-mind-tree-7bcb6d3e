import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MobileHeader } from '@/components/ui/mobile-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Target, 
  Calendar, 
  Clock, 
  Package, 
  Wallet, 
  Image, 
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Timer,
  PlayCircle,
  Layers,
  Activity,
  Zap,
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, isToday, isTomorrow, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';
import { useKPIsSelector, useStockValueSelector } from '@/stores/selectors';
import { useInventorySync } from '@/hooks/useInventorySync';
import { useAppStore } from '@/stores/appStore';
import { FOCUS_TYPES, FocusType } from '@/hooks/useRoutine';
import { DailySummary } from '@/components/dashboard/DailySummary';
import { DailyPriorities } from '@/components/dashboard/DailyPriorities';
import { DailyPerformance } from '@/components/dashboard/DailyPerformance';
import { QuickFinance } from '@/components/dashboard/QuickFinance';
import { CampaignResults } from '@/components/dashboard/CampaignResults';
import { CompanyStatus } from '@/components/dashboard/CompanyStatus';
import { BottleneckCard } from '@/components/dashboard/BottleneckCard';
import { OperationalStart } from '@/components/dashboard/OperationalStart';
import { MTWorkspaceBar } from '@/components/routine/MTWorkspaceBar';
import { OPERATIONAL_START_DATE, isBeforeOperationalStart } from '@/lib/operationalStart';
import { getInboxPriority } from '@/lib/crm/inboxPriority';


interface DashboardData {
  // Foco
  focusTasksAndamento: number;
  focusTasksPendentes: number;
  focusTasksAtrasadas: number;
  focusTasksConcluidas: number;
  // Calendário
  eventsToday: number;
  eventsTomorrow: number;
  eventsThisWeek: number;
  // Rotina
  routineBlocksToday: number;
  routineBlocksConcluidos: number;
  routineMinutesPlanned: number;
  routineMinutesDone: number;
  activeBlock: { title: string; focus: string } | null;
  // Operações
  ordersThisMonth: number;
  ordersPending: number;
  overdueOrders: number;
  realizedRevenue: number;
  lowStockCount: number;
  // Digital
  ideasInProgress: number;
  variationsScheduled: number;
  variationsPublished: number;
  // Financeiro
  receberAberto: number;
  receberAtrasado: number;
  pagarAberto: number;
  pagarAtrasado: number;
  financialOverdueCount: number;
  crmAttentionCount: number;
  saldoContas: number;
}

// Widget wrapper component
function DashboardWidget({ 
  title, 
  icon: Icon, 
  href, 
  children,
  className,
  accentColor = 'primary',
}: {
  title: string;
  icon: React.ElementType;
  href: string;
  children: React.ReactNode;
  className?: string;
  accentColor?: 'primary' | 'emerald' | 'amber' | 'red' | 'blue' | 'purple' | 'cyan';
}) {
  const colorMap = {
    primary: 'from-primary/20 to-primary/5 border-primary/20',
    emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20',
    amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/20',
    red: 'from-red-500/20 to-red-500/5 border-red-500/20',
    blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/20',
    purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/20',
    cyan: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/20',
  };

  const iconColorMap = {
    primary: 'text-primary',
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
    red: 'text-red-500',
    blue: 'text-blue-500',
    purple: 'text-purple-500',
    cyan: 'text-cyan-500',
  };

  return (
    <Card className={cn('bg-gradient-to-br border', colorMap[accentColor], className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Icon className={cn('h-5 w-5', iconColorMap[accentColor])} />
            {title}
          </span>
          <Link to={href}>
            <Button variant="ghost" size="sm" className="h-7 px-2">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {children}
      </CardContent>
    </Card>
  );
}

// Stat item component
function StatItem({ 
  label, 
  value, 
  icon: Icon,
  variant = 'default',
}: {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const variantColors = {
    default: 'text-foreground',
    success: 'text-emerald-500',
    warning: 'text-amber-500',
    danger: 'text-red-500',
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </span>
      <span className={cn('font-semibold', variantColors[variant])}>{value}</span>
    </div>
  );
}

export default function Dashboard() {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    focusTasksAndamento: 0,
    focusTasksPendentes: 0,
    focusTasksAtrasadas: 0,
    focusTasksConcluidas: 0,
    eventsToday: 0,
    eventsTomorrow: 0,
    eventsThisWeek: 0,
    routineBlocksToday: 0,
    routineBlocksConcluidos: 0,
    routineMinutesPlanned: 0,
    routineMinutesDone: 0,
    activeBlock: null,
    ordersThisMonth: 0,
    ordersPending: 0,
    overdueOrders: 0,
    realizedRevenue: 0,
    lowStockCount: 0,
    ideasInProgress: 0,
    variationsScheduled: 0,
    variationsPublished: 0,
    receberAberto: 0,
    receberAtrasado: 0,
    pagarAberto: 0,
    pagarAtrasado: 0,
    financialOverdueCount: 0,
    crmAttentionCount: 0,
    saldoContas: 0,
  });

  // Operations data from store (carrega produtos + saldos reais de estoque)
  useInventorySync({ loadProducts: true });
  const kpis = useKPIsSelector();
  const stockValue = useStockValueSelector();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    const weekEnd = format(addDays(new Date(), 7), 'yyyy-MM-dd');
    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');
    const nextMonthStart = format(addDays(endOfMonth(new Date()), 1), 'yyyy-MM-dd');

    // Parallel fetches
    const [
      tasksResult,
      routineResult,
      statsResult,
      ordersResult,
      overdueOrdersResult,
      ideasResult,
      variationsResult,
      entriesResult,
      realizedRevenueResult,
      accountsResult,
      conversationsResult,
    ] = await Promise.all([
      // Tasks
      supabase.from('tasks').select('id, status, due_date').is('deleted_at', null),
      // Routine blocks today
      supabase.from('routine_blocks').select('id, status, duration_minutes, title, focus').eq('date', today),
      // Routine stats today
      supabase.from('routine_stats').select('planned_min, done_min').eq('date', today).maybeSingle(),
      // Pedido operacional do mês, sempre dentro do marco oficial da operação.
      supabase.from('orders').select('id, operational_status, total_value, created_at')
        .gte('created_at', monthStart > OPERATIONAL_START_DATE ? monthStart : OPERATIONAL_START_DATE)
        .lt('created_at', nextMonthStart)
        .is('deleted_at', null),
      // Atraso é uma dimensão operacional: somente pedido ainda a fazer/em
      // preparação, criado após o baseline e com prazo realmente vencido.
      supabase.from('orders').select('id, operational_status, due_date, created_at')
        .is('deleted_at', null)
        .gte('created_at', OPERATIONAL_START_DATE)
        .not('due_date', 'is', null)
        .lt('due_date', today),
      // Digital ideas
      supabase.from('digital_ideas').select('id, status'),
      // Variations scheduled
      supabase.from('digital_variations').select('id, status, scheduled_date'),
      // Financial entries
      supabase.from('financial_entries').select('id, type, value, value_paid, due_date, payment_date').gte('due_date', OPERATIONAL_START_DATE),
      // Receita realizada no mês: somente movimentações financeiras efetivamente recebidas.
      supabase.from('financial_movements').select('value, financial_entries!inner(type)').eq('financial_entries.type', 'receber').gte('movement_date', monthStart).lte('movement_date', monthEnd),
      // Accounts
      supabase.from('financial_accounts').select('id, current_balance').eq('is_active', true),
      // Reuse the Inbox priority rule instead of creating a Dashboard-specific CRM score.
      supabase.from('service_conversations').select('contact_id, status, needs_reply, return_at, last_inbound_at, last_message_at, attendance_state').not('contact_id', 'is', null),
    ]);

    const tasks = tasksResult.data || [];
    const routineBlocks = routineResult.data || [];
    const stats = statsResult.data;
    const orders = ordersResult.data || [];
    const overdueOrders = overdueOrdersResult.data || [];
    const ideas = ideasResult.data || [];
    const variations = variationsResult.data || [];
    const entries = entriesResult.data || [];
    const realizedRevenueMovements = realizedRevenueResult.data || [];
    const accounts = accountsResult.data || [];
    const conversations = conversationsResult.data || [];

    // Calculate task stats
    const focusTasksAndamento = tasks.filter(t => t.status === 'andamento').length;
    const focusTasksPendentes = tasks.filter(t => t.status === 'pendente').length;
    const focusTasksConcluidas = tasks.filter(t => t.status === 'concluído').length;
    const focusTasksAtrasadas = tasks.filter(t => {
      if (!t.due_date || t.status === 'concluído') return false;
      if (isBeforeOperationalStart(t.due_date)) return false;
      return t.due_date < today;
    }).length;

    // Routine
    const activeBlock = routineBlocks.find(b => b.status === 'andamento');
    const routineBlocksConcluidos = routineBlocks.filter(b => b.status === 'concluido').length;

    // Orders
    const operationalOrders = orders.filter(o => (o.operational_status ?? 'todo') !== 'cancelled');
    const ordersPending = operationalOrders.filter(o => ['todo', 'preparing'].includes(o.operational_status ?? 'todo')).length;
    const overdueOperationalOrders = overdueOrders.filter(
      o => !['finalized', 'cancelled'].includes(o.operational_status ?? 'todo'),
    );
    const realizedRevenue = realizedRevenueMovements.reduce((sum, movement) => sum + Number(movement.value || 0), 0);

    // Digital
    const ideasInProgress = ideas.filter(i => i.status === 'andamento').length;
    const variationsScheduled = variations.filter(v => v.scheduled_date && v.status !== 'publicado').length;
    const variationsPublished = variations.filter(v => v.status === 'publicado').length;

    // Financial
    const isOpen = (e: any) => !e.payment_date && (e.value - (e.value_paid || 0)) > 0.009;
    const receberEntries = entries.filter(e => e.type === 'receber');
    const pagarEntries = entries.filter(e => e.type === 'pagar');
    
    const receberAberto = receberEntries
      .filter(isOpen)
      .reduce((sum, e) => sum + (e.value - (e.value_paid || 0)), 0);
    const receberAtrasado = receberEntries
      .filter(e => isOpen(e) && e.due_date < today)
      .reduce((sum, e) => sum + (e.value - (e.value_paid || 0)), 0);
    const pagarAberto = pagarEntries
      .filter(isOpen)
      .reduce((sum, e) => sum + (e.value - (e.value_paid || 0)), 0);
    const pagarAtrasado = pagarEntries
      .filter(e => isOpen(e) && e.due_date < today)
      .reduce((sum, e) => sum + (e.value - (e.value_paid || 0)), 0);
    const financialOverdueCount = entries.filter(e => isOpen(e) && e.due_date < today).length;

    const saldoContas = accounts.reduce((sum, a) => sum + (a.current_balance || 0), 0);

    // The Inbox filters inactive contacts and keeps one conversation per contact. Mirror that
    // eligibility while delegating the actual operational reason to getInboxPriority().
    const contactIds = Array.from(new Set(conversations.map(c => c.contact_id).filter(Boolean))) as string[];
    const activeContactIds = new Set<string>();
    if (contactIds.length > 0) {
      const { data: activeContacts } = await supabase
        .from('contacts')
        .select('id')
        .in('id', contactIds)
        .eq('is_active', true);
      (activeContacts || []).forEach(contact => activeContactIds.add(contact.id));
    }
    const seenAttentionContacts = new Set<string>();
    const crmAttentionCount = conversations.reduce((count, conversation) => {
      if (!conversation.contact_id || !activeContactIds.has(conversation.contact_id) || seenAttentionContacts.has(conversation.contact_id)) return count;
      seenAttentionContacts.add(conversation.contact_id);
      return getInboxPriority(conversation).reason ? count + 1 : count;
    }, 0);

    setData({
      focusTasksAndamento,
      focusTasksPendentes,
      focusTasksAtrasadas,
      focusTasksConcluidas,
      eventsToday: 0, // TODO: implement calendar events
      eventsTomorrow: 0,
      eventsThisWeek: 0,
      routineBlocksToday: routineBlocks.length,
      routineBlocksConcluidos,
      routineMinutesPlanned: stats?.planned_min || routineBlocks.reduce((sum, b) => sum + (b.duration_minutes || 0), 0),
      routineMinutesDone: stats?.done_min || 0,
      activeBlock: activeBlock ? { title: activeBlock.title, focus: activeBlock.focus } : null,
      ordersThisMonth: operationalOrders.length,
      ordersPending,
      overdueOrders: overdueOperationalOrders.length,
      realizedRevenue,
      lowStockCount: kpis.lowStock.length,
      ideasInProgress,
      variationsScheduled,
      variationsPublished,
      receberAberto,
      receberAtrasado,
      pagarAberto,
      pagarAtrasado,
      financialOverdueCount,
      crmAttentionCount,
      saldoContas,
    });

    setLoading(false);
  };

  // Calculate routine progress
  const routineProgress = useMemo(() => {
    if (data.routineMinutesPlanned === 0) return 0;
    return Math.round((data.routineMinutesDone / data.routineMinutesPlanned) * 100);
  }, [data.routineMinutesPlanned, data.routineMinutesDone]);

  const formatMinutes = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m}min`;
    return m === 0 ? `${h}h` : `${h}h ${m}min`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title="Dashboard" />
        <div className="container mx-auto p-4 flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <MobileHeader title="Dashboard" />
      
      <div className="container mx-auto p-4 space-y-4">
        {/* Date header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-semibold">
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </h2>
            <p className="text-sm text-muted-foreground">Visão geral do sistema</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchDashboardData}>
            <Activity className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
        </div>

        {/* Área de Trabalho do MT ativo — destaca módulos prioritários do papel do momento */}
        <OperationalStart
          crmAttentionCount={data.crmAttentionCount}
          financialOverdueCount={data.financialOverdueCount}
          overdueOrders={data.overdueOrders}
        />

        {/* Situação da Empresa - status geral em tempo real */}


        {/* Resumo do Dia - Sticky no topo */}
        <div className="sticky top-14 z-20 -mx-4 px-4 py-2 bg-background/95 backdrop-blur-sm">
          <DailySummary />
        </div>

        {/* Prioridades do Dia */}
        <DailyPriorities />

        {/* Performance de Hoje */}
        <details className="rounded-lg border bg-card">
          <summary className="cursor-pointer list-none px-4 py-3 font-medium">
            Visão gerencial <span className="text-sm font-normal text-muted-foreground">· indicadores e módulos</span>
          </summary>
          <div className="space-y-4 border-t p-4">
        <MTWorkspaceBar />
        <CompanyStatus />
        <BottleneckCard />
        <DailyPerformance />

        {/* Financeiro Rápido */}
        <QuickFinance />

        {/* Resultado das Campanhas */}
        <CampaignResults />

        {/* Quick stats banner */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-primary/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-primary">{data.focusTasksAndamento}</p>
            <p className="text-xs text-muted-foreground">Em Foco</p>
          </div>
          <div className={cn("rounded-lg p-3 text-center", data.focusTasksAtrasadas > 0 ? "bg-red-500/10" : "bg-muted")}>
            <p className={cn("text-2xl font-bold", data.focusTasksAtrasadas > 0 ? "text-red-500" : "text-foreground")}>
              {data.focusTasksAtrasadas}
            </p>
            <p className="text-xs text-muted-foreground">Atrasadas</p>
          </div>
          <div className="bg-emerald-500/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-emerald-500">{routineProgress}%</p>
            <p className="text-xs text-muted-foreground">Rotina</p>
          </div>
          <div className={cn("rounded-lg p-3 text-center", data.saldoContas >= 0 ? "bg-emerald-500/10" : "bg-red-500/10")}>
            <p className={cn("text-lg font-bold", data.saldoContas >= 0 ? "text-emerald-500" : "text-red-500")}>
              {formatCurrency(data.saldoContas, { compact: true })}
            </p>
            <p className="text-xs text-muted-foreground">Saldo</p>
          </div>
        </div>

        {/* Main grid */}
        <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3")}>
          
          {/* FOCO Widget */}
          <DashboardWidget title="Foco" icon={Target} href="/foco" accentColor="red">
            <StatItem label="Em andamento" value={data.focusTasksAndamento} icon={PlayCircle} variant="default" />
            <StatItem label="Pendentes" value={data.focusTasksPendentes} icon={Clock} />
            <StatItem 
              label="Atrasadas" 
              value={data.focusTasksAtrasadas} 
              icon={AlertTriangle}
              variant={data.focusTasksAtrasadas > 0 ? 'danger' : 'default'} 
            />
            <StatItem label="Concluídas" value={data.focusTasksConcluidas} icon={CheckCircle} variant="success" />
          </DashboardWidget>

          {/* ROTINA Widget */}
          <DashboardWidget title="Rotina" icon={Timer} href="/rotina" accentColor="purple">
            {data.activeBlock ? (
              <div className="bg-purple-500/20 rounded-lg p-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="animate-pulse text-purple-400">●</span>
                  <span className="font-medium text-sm">{data.activeBlock.title}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {FOCUS_TYPES[data.activeBlock.focus as FocusType]?.icon || '🎯'} Em andamento
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-2">Nenhum bloco ativo</p>
            )}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progresso do dia</span>
                <span className="font-medium">{formatMinutes(data.routineMinutesDone)} / {formatMinutes(data.routineMinutesPlanned)}</span>
              </div>
              <Progress value={routineProgress} className="h-2" />
            </div>
            <StatItem label="Blocos concluídos" value={`${data.routineBlocksConcluidos}/${data.routineBlocksToday}`} />
          </DashboardWidget>

          {/* OPERAÇÕES Widget */}
          <DashboardWidget title="Operações" icon={Package} href="/operacoes" accentColor="blue">
            <StatItem label="Pedidos (mês)" value={data.ordersThisMonth} />
            <StatItem label="A fazer/em preparação" value={data.ordersPending} icon={Clock} />
            <StatItem 
              label="Receita realizada" 
              value={formatCurrency(data.realizedRevenue, { compact: true })} 
              variant="success" 
            />
            <StatItem 
              label="Estoque baixo" 
              value={kpis.lowStock.length} 
              icon={AlertTriangle}
              variant={kpis.lowStock.length > 0 ? 'warning' : 'default'} 
            />
            {stockValue.totalStockValue > 0 && (
              <StatItem 
                label="Valor em estoque" 
                value={formatCurrency(stockValue.totalStockValue, { compact: true })} 
              />
            )}
          </DashboardWidget>

          {/* DIGITAL Widget */}
          <DashboardWidget title="Digital" icon={Image} href="/digital" accentColor="cyan">
            <StatItem label="Ideias em andamento" value={data.ideasInProgress} icon={Layers} />
            <StatItem label="Agendadas" value={data.variationsScheduled} icon={Calendar} />
            <StatItem label="Publicadas" value={data.variationsPublished} icon={CheckCircle} variant="success" />
          </DashboardWidget>

          {/* FINANCEIRO Widget */}
          <DashboardWidget title="Financeiro" icon={Wallet} href="/financeiro" accentColor="emerald">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="bg-emerald-500/10 rounded-lg p-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                  A Receber
                </p>
                <p className="font-semibold text-emerald-500">{formatCurrency(data.receberAberto, { compact: true })}</p>
              </div>
              <div className="bg-red-500/10 rounded-lg p-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  A Pagar
                </p>
                <p className="font-semibold text-red-500">{formatCurrency(data.pagarAberto, { compact: true })}</p>
              </div>
            </div>
            {(data.receberAtrasado > 0 || data.pagarAtrasado > 0) && (
              <div className="text-xs text-amber-500 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {data.receberAtrasado > 0 && `${formatCurrency(data.receberAtrasado, { compact: true })} a receber atrasado`}
                {data.receberAtrasado > 0 && data.pagarAtrasado > 0 && ' • '}
                {data.pagarAtrasado > 0 && `${formatCurrency(data.pagarAtrasado, { compact: true })} a pagar atrasado`}
              </div>
            )}
            <StatItem 
              label="Saldo total" 
              value={formatCurrency(data.saldoContas)} 
              variant={data.saldoContas >= 0 ? 'success' : 'danger'} 
            />
          </DashboardWidget>

          {/* CALENDÁRIO Widget */}
          <DashboardWidget title="Calendário" icon={Calendar} href="/calendario" accentColor="amber">
            <p className="text-sm text-muted-foreground">
              Veja reuniões e eventos do dia
            </p>
            <Link to="/calendario">
              <Button variant="outline" size="sm" className="w-full mt-2">
                <Calendar className="h-4 w-4 mr-2" />
                Abrir Calendário
              </Button>
            </Link>
          </DashboardWidget>

        </div>

          </div>
        </details>

        {/* Atalhos redundantes permanecem disponíveis pelo rodapé */}
        {false && <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Link to="/foco">
                <Button variant="outline" size="sm">
                  <Target className="h-4 w-4 mr-1" />
                  Foco
                </Button>
              </Link>
              <Link to="/rotina">
                <Button variant="outline" size="sm">
                  <Timer className="h-4 w-4 mr-1" />
                  Rotina
                </Button>
              </Link>
              <Link to="/operacoes">
                <Button variant="outline" size="sm">
                  <Package className="h-4 w-4 mr-1" />
                  Operações
                </Button>
              </Link>
              <Link to="/digital">
                <Button variant="outline" size="sm">
                  <Image className="h-4 w-4 mr-1" />
                  Digital
                </Button>
              </Link>
              <Link to="/financeiro">
                <Button variant="outline" size="sm">
                  <Wallet className="h-4 w-4 mr-1" />
                  Financeiro
                </Button>
              </Link>
              <Link to="/planejamento">
                <Button variant="outline" size="sm">
                  <Layers className="h-4 w-4 mr-1" />
                  Planejamento
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>}
      </div>
    </div>
  );
}
