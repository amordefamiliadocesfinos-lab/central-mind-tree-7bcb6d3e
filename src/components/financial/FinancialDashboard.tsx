import { useEffect, useMemo, useState } from 'react';
import { useRealizedCash } from '@/hooks/useRealizedCash';
import type { CashMovementRow } from '@/lib/financial/realizedCash';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, AlertTriangle, Clock, CheckCircle, Wallet,
  BarChart3, PieChart as PieIcon, Search, CheckSquare, Square,
} from 'lucide-react';
import { useFinancial, FinancialSummary, FinancialEntry, getEntryStatus } from '@/hooks/useFinancial';
import { salesChannelLabel } from '@/lib/salesChannels';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

interface SummaryCardProps {
  title: string;
  value: number;
  count?: number;
  subtitle?: string;
  icon: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}


function SummaryCard({ title, value, count, subtitle, icon, variant = 'default' }: SummaryCardProps) {
  const variants = {
    default: 'bg-card',
    success: 'bg-emerald-500/10 border-emerald-500/20',
    warning: 'bg-amber-500/10 border-amber-500/20',
    danger: 'bg-red-500/10 border-red-500/20',
  };
  const iconVariants = {
    default: 'text-muted-foreground',
    success: 'text-emerald-500',
    warning: 'text-amber-500',
    danger: 'text-red-500',
  };
  return (
    <Card className={variants[variant]}>
      <CardContent className="p-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground truncate">{title}</p>
            <p className="text-lg font-bold leading-tight">{formatCurrency(value)}</p>
            {subtitle && <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>}
            {count !== undefined && <p className="text-[10px] text-muted-foreground">{count} lançamento(s)</p>}
          </div>
          <div className={`${iconVariants[variant]} [&_svg]:h-4 [&_svg]:w-4`}>{icon}</div>

        </div>
      </CardContent>
    </Card>
  );
}


function TypeSummary({ title, summary, type }: { title: string; summary: FinancialSummary; type: 'pagar' | 'receber' }) {
  const Icon = type === 'receber' ? TrendingUp : TrendingDown;
  const iconColor = type === 'receber' ? 'text-emerald-500' : 'text-red-500';
  return (
    <Card>
      <CardHeader className="p-3 pb-1.5">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md bg-muted/50 p-2">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />Em Aberto
            </div>
            <p className="text-sm font-semibold">{formatCurrency(summary.total_open, { compact: true })}</p>
            <p className="text-[10px] text-muted-foreground">{summary.count_open}</p>
          </div>
          <div className="rounded-md bg-red-500/10 p-2">
            <div className="flex items-center gap-1 text-[11px] text-red-500">
              <AlertTriangle className="h-3 w-3" />Atrasadas
            </div>
            <p className="text-sm font-semibold text-red-500">{formatCurrency(summary.total_overdue, { compact: true })}</p>
            <p className="text-[10px] text-muted-foreground">{summary.count_overdue}</p>
          </div>
          <div className="rounded-md bg-emerald-500/10 p-2">
            <div className="flex items-center gap-1 text-[11px] text-emerald-500">
              <CheckCircle className="h-3 w-3" />{type === 'receber' ? 'Recebido acum.' : 'Pago acum.'}
            </div>
            <p className="text-sm font-semibold text-emerald-500">{formatCurrency(summary.total_paid, { compact: true })}</p>
            <p className="text-[10px] text-muted-foreground">{summary.count_paid}</p>
          </div>
        </div>
        {summary.count_partial > 0 && (
          <p className="text-[10px] text-amber-500">{summary.count_partial} com pagamento parcial</p>
        )}
      </CardContent>
    </Card>
  );
}


type GroupBy = 'category' | 'contact' | 'account' | 'channel' | 'channel_account' | 'type' | 'status';
type ChartKind = 'pie' | 'bar';
type ValueMode = 'value_paid';

const PALETTE = [
  '#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899',
  '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4', '#e11d48',
  '#a855f7', '#22c55e', '#eab308', '#0ea5e9',
];

function InteractiveBreakdown({ entries }: { entries: (CashMovementRow & { entry: NonNullable<CashMovementRow['entry']> })[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'pagar' | 'receber'>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('category');
  const [chartKind, setChartKind] = useState<ChartKind>('pie');
  const valueMode: ValueMode = 'value_paid';

  const filteredList = useMemo(() => {
    const s = search.trim().toLowerCase();
    return entries.filter((e) => {
      // O dashboard analítico representa resultado realizado, não previsão.
      if (Number(e.value) <= 0) return false;
      if (typeFilter !== 'all' && e.entry.type !== typeFilter) return false;
      if (!s) return true;
      return (
        e.entry.description?.toLowerCase().includes(s) ||
        e.entry.category?.name?.toLowerCase().includes(s) ||
        e.entry.contact?.name?.toLowerCase().includes(s)
        || e.entry.sales_channel?.toLowerCase().includes(s)
        || e.entry.marketplace_account?.toLowerCase().includes(s)
      );
    });
  }, [entries, search, typeFilter]);

  const activeEntries = useMemo(() => {
    if (selected.size === 0) return filteredList;
    return filteredList.filter((e) => selected.has(e.id));
  }, [filteredList, selected]);

  const getValue = (e: CashMovementRow) => {
    return Number(e.value);
  };

  const groupKey = (e: CashMovementRow & {entry: NonNullable<CashMovementRow['entry']>}): string => {
    switch (groupBy) {
      case 'category': return e.entry.category?.name || 'Sem categoria';
      case 'contact': return e.entry.contact?.name || 'Sem contato';
      case 'account': return e.account?.name || 'Sem conta';
      case 'channel': return salesChannelLabel(e.entry.sales_channel);
      case 'channel_account': return e.entry.marketplace_account || 'Sem conta do canal';
      case 'type': return e.entry.type === 'pagar' ? 'A Pagar' : 'A Receber';
      case 'status': return getEntryStatus(e.entry as FinancialEntry);
    }
  };

  const chartData = useMemo(() => {
    const map = new Map<string, { name: string; value: number; count: number }>();
    for (const e of activeEntries) {
      const key = groupKey(e);
      const cur = map.get(key) || { name: key, value: 0, count: 0 };
      cur.value += getValue(e);
      cur.count += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [activeEntries, groupBy, valueMode]);

  const totalValue = chartData.reduce((s, d) => s + d.value, 0);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    if (selected.size === filteredList.length) setSelected(new Set());
    else setSelected(new Set(filteredList.map((e) => e.id)));
  };
  const allSelected = selected.size > 0 && selected.size === filteredList.length;

  return (
    <Card>
      <CardHeader className="p-3 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BarChart3 className="h-4 w-4 text-primary" />
            Análise interativa de movimentos
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] h-5">
              {selected.size > 0 ? `${selected.size} selecionadas` : `${filteredList.length} movimentos`}
            </Badge>
            <span className="text-xs font-semibold">{formatCurrency(totalValue)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-2">

        {/* Controls */}
        <div className="grid gap-2 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição, categoria ou contato"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={typeFilter} onValueChange={(v: 'all' | 'pagar' | 'receber') => setTypeFilter(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="pagar">A Pagar</SelectItem>
              <SelectItem value="receber">A Receber</SelectItem>
            </SelectContent>
          </Select>
          <Select value={valueMode} disabled>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="value_paid">Valor efetivado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
            <TabsList>
              <TabsTrigger value="category">Categoria</TabsTrigger>
              <TabsTrigger value="contact">Contato</TabsTrigger>
              <TabsTrigger value="account">Conta</TabsTrigger>
              <TabsTrigger value="channel">Canal</TabsTrigger>
              <TabsTrigger value="channel_account">Loja</TabsTrigger>
              <TabsTrigger value="type">Tipo</TabsTrigger>
              <TabsTrigger value="status">Status</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex gap-1">
            <Button size="sm" variant={chartKind === 'pie' ? 'default' : 'outline'} onClick={() => setChartKind('pie')}>
              <PieIcon className="h-4 w-4 mr-1" /> Pizza
            </Button>
            <Button size="sm" variant={chartKind === 'bar' ? 'default' : 'outline'} onClick={() => setChartKind('bar')}>
              <BarChart3 className="h-4 w-4 mr-1" /> Barras
            </Button>
          </div>
        </div>

        <div className="grid gap-2 lg:grid-cols-2">
          {/* Chart */}
          <div className="rounded-lg border bg-muted/20 p-2 h-[230px]">

            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Sem dados para o filtro atual
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {chartKind === 'pie' ? (
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={110}
                      paddingAngle={2}
                      label={(e: { percent?: number }) =>
                        e.percent && e.percent > 0.04 ? `${(e.percent * 100).toFixed(0)}%` : ''
                      }
                    >
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, n: string) => [formatCurrency(v), n]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} tick={{ fontSize: 11 }} height={60} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, { compact: true })} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>

          {/* Selectable list */}
          <div className="rounded-lg border">
            <div className="flex items-center justify-between border-b p-2">
              <Button size="sm" variant="ghost" onClick={toggleAll} className="gap-2">
                {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                {allSelected ? 'Desmarcar todos' : 'Marcar todos'}
              </Button>
              {selected.size > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  Limpar seleção
                </Button>
              )}
            </div>
            <ScrollArea className="h-[185px]">
              <div className="divide-y">
                {filteredList.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">Nenhum lançamento</p>
                ) : (
                  filteredList.map((e) => {
                    const status = getEntryStatus(e.entry as FinancialEntry);
                    const isSel = selected.has(e.id);
                    return (
                      <label
                        key={e.id}
                        className={`flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer ${isSel ? 'bg-primary/5' : ''}`}
                      >
                        <Checkbox checked={isSel} onCheckedChange={() => toggle(e.id)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{e.entry.description}</span>
                            <Badge variant={e.entry.type === 'receber' ? 'default' : 'destructive'} className="text-[10px] h-4">
                              {e.entry.type === 'receber' ? 'R' : 'P'}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                            <span>{format(parseISO(e.movement_date), 'dd/MM/yyyy')}</span>
                            {e.entry.category?.name && <span>· {e.entry.category.name}</span>}
                            {e.entry.contact?.name && <span>· {e.entry.contact.name}</span>}
                            {e.entry.sales_channel && <span>· {salesChannelLabel(e.entry.sales_channel)}</span>}
                            {e.entry.marketplace_account && <span>· {e.entry.marketplace_account}</span>}
                            <span>· {status}</span>
                          </div>
                        </div>
                        <span className={`text-sm font-semibold ${e.entry.type === 'receber' ? 'text-emerald-500' : 'text-red-500'}`}>
                          {formatCurrency(getValue(e))}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Breakdown table */}
        {chartData.length > 0 && (
          <div className="rounded-lg border max-h-[180px] overflow-y-auto">
            <div className="sticky top-0 grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b bg-muted/60 backdrop-blur p-1.5 text-[10px] font-semibold text-muted-foreground">
              <span>Grupo</span>
              <span className="text-right">Qtd</span>
              <span className="text-right">Valor</span>
              <span className="text-right">%</span>
            </div>

            <div className="divide-y">
              {chartData.map((d, i) => (
                <div key={d.name} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 p-2 text-sm items-center">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-3 w-3 rounded-sm shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="truncate">{d.name}</span>
                  </div>
                  <span className="text-right text-xs text-muted-foreground">{d.count}</span>
                  <span className="text-right font-semibold">{formatCurrency(d.value)}</span>
                  <span className="text-right text-xs text-muted-foreground">
                    {totalValue > 0 ? `${((d.value / totalValue) * 100).toFixed(1)}%` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface FinancialDashboardProps {
  entries?: FinancialEntry[];
  accounts?: ReturnType<typeof useFinancial>['accounts'];
  summary?: ReturnType<ReturnType<typeof useFinancial>['getDashboardSummary']>;
  filters?: ReturnType<typeof useFinancial>['filters'];
}

export function FinancialDashboard(props: FinancialDashboardProps = {}) {
  const hook = useFinancial();
  const entries = props.entries ?? hook.entries;
  const accounts = props.accounts ?? hook.accounts;
  const summary = props.summary ?? hook.getDashboardSummary();
  const cash = useRealizedCash(props.filters ?? hook.filters, entries);
  const [settlementTotals, setSettlementTotals] = useState({ gross: 0, fees: 0, net: 0 });
  const sales = entries.filter(e => e.type === 'receber');
  const withoutChannel = sales.filter(e => !e.sales_channel).length;
  const marketplace = sales.filter(e => ['shopee', 'mercado_livre', 'marketplace', 'ecommerce'].includes(e.sales_channel || ''));
  useEffect(() => {
    if (props.filters?.salesChannel && !['shopee', 'mercado_livre', 'marketplace', 'ecommerce'].includes(props.filters.salesChannel)) {
      setSettlementTotals({ gross: 0, fees: 0, net: 0 }); return;
    }
    let query = supabase.from('marketplace_settlements').select('gross_value,fee_value,net_value,settlement_date,marketplace,marketplace_account').eq('status', 'conciliado');
    if (props.filters?.startDate) query = query.gte('settlement_date', format(props.filters.startDate, 'yyyy-MM-dd'));
    if (props.filters?.endDate) query = query.lte('settlement_date', format(props.filters.endDate, 'yyyy-MM-dd'));
    if (props.filters?.salesChannel === 'shopee') query = query.ilike('marketplace', '%shopee%');
    if (props.filters?.salesChannel === 'mercado_livre') query = query.ilike('marketplace', '%mercado%');
    if (props.filters?.marketplaceAccount) query = query.eq('marketplace_account', props.filters.marketplaceAccount);
    query.then(({ data }) => setSettlementTotals((data || []).reduce((acc, row) => ({ gross: acc.gross + Number(row.gross_value), fees: acc.fees + Number(row.fee_value), net: acc.net + Number(row.net_value) }), { gross: 0, fees: 0, net: 0 })));
  }, [props.filters?.startDate, props.filters?.endDate, props.filters?.salesChannel, props.filters?.marketplaceAccount]);


  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Caixa realizado pela data do movimento, independentemente da base temporal das obrigações.</p>
      {cash.loading && <p role="status">Consultando movimentos financeiros…</p>}
      {cash.error && <p role="alert" className="text-destructive text-sm">Caixa indisponível: {cash.error}</p>}
      {cash.report && <div className="grid gap-2 grid-cols-3">
        <SummaryCard title="Entradas realizadas" value={cash.report.incoming}
          subtitle="Somente valores efetivamente recebidos"
          icon={<TrendingUp />} variant="success" />
        <SummaryCard title="Saídas realizadas" value={cash.report.outgoing}
          subtitle="Somente valores efetivamente pagos"
          icon={<TrendingDown />} variant="danger" />
        <SummaryCard title="Resultado realizado" value={cash.report.net}
          subtitle="Entradas realizadas menos saídas realizadas"
          icon={<Wallet />} variant={cash.report.net >= 0 ? 'success' : 'danger'} />
      </div>}

      <div className="grid gap-2 grid-cols-3">
        <SummaryCard title="Marketplace bruto conciliado" value={settlementTotals.gross} icon={<TrendingUp />} />
        <SummaryCard title="Taxas de marketplace" value={settlementTotals.fees} icon={<TrendingDown />} variant="danger" />
        <SummaryCard title="Marketplace líquido" value={settlementTotals.net} icon={<CheckCircle />} variant="success" />
      </div>
      <div className={`rounded-md border px-3 py-2 text-xs ${withoutChannel ? 'border-amber-400 bg-amber-500/10' : 'text-muted-foreground'}`}>{withoutChannel ? `${withoutChannel} venda(s) sem canal precisam de classificação.` : 'Todas as vendas do período possuem canal informado.'}</div>

      <div className="grid gap-2 md:grid-cols-2">
        <TypeSummary title="Contas a Receber" summary={summary.receber} type="receber" />
        <TypeSummary title="Contas a Pagar" summary={summary.pagar} type="pagar" />
      </div>

      {cash.report && <InteractiveBreakdown key={JSON.stringify([props.filters ?? hook.filters])} entries={cash.report.movements} />}

      <Card>
        <CardHeader className="p-3 pb-1.5">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Wallet className="h-4 w-4" />Saldo por Conta
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          {accounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma conta cadastrada</p>
          ) : (
            <div className="space-y-2">
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 max-h-[150px] overflow-y-auto">
                {accounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2 py-1.5">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{account.name}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{account.type}</p>
                    </div>
                    <p className={`text-xs font-semibold shrink-0 ${account.current_balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {formatCurrency(account.current_balance, { compact: true })}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <p className="text-xs font-medium">Total</p>
                <p className={`text-base font-bold ${summary.totalAccountsBalance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {formatCurrency(summary.totalAccountsBalance)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

}
