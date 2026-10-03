import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Boxes, ClipboardCheck, Factory, PackageCheck, RefreshCw,
  ShoppingCart, Truck, WalletCards,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { useMRP } from '@/hooks/useMRP';
import type { OperationsTab } from './OperationsBottomNav';

const db = supabase as any;
const ACTIVE_ORDER_STATUSES = ['todo', 'preparing'];
const OPEN_PURCHASE_STATUSES = ['confirmado', 'em_transito', 'parcialmente_recebido'];
const OPEN_SEPARATION_STATUSES = ['todo', 'preparing'];
const SAO_PAULO_TZ = 'America/Sao_Paulo';

function operationalDay(value: string | Date = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function isBeforeToday(value?: string | null) {
  if (!value) return false;
  return value.slice(0, 10) < operationalDay();
}

function hoursSince(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 0;
  return (Date.now() - time) / 3_600_000;
}

type Snapshot = {
  productionNeeds: number;
  productionUnits: number;
  purchaseNeeds: number;
  purchaseUnits: number;
  activeOrders: number;
  riskyOrders: number;
  separationBacklog: number;
  separationOver24h: number;
  inboundPurchases: number;
  overduePurchases: number;
  productionTodayUnits: number;
  productionTodayFacts: number;
  laborToday: number;
  pendingMaterialFacts: number;
  openClosings: number;
};

interface Props { onNavigate: (tab: OperationsTab) => void; }

export function OperationalIntelligencePanel({ onNavigate }: Props) {
  const { calculateOperationalPlan } = useMRP();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const today = operationalDay();
    const recentSince = new Date(Date.now() - 48 * 3_600_000).toISOString();

    const [plan, ordersResult, separationResult, purchasesResult, factsResult, processResult, consumptionsResult, closingsResult] = await Promise.all([
      calculateOperationalPlan(),
      db.from('orders').select('id,status,operational_status,due_date,delivery_date').is('deleted_at', null),
      db.from('order_separation').select('id,separation_status,created_at,updated_at'),
      db.from('purchase_orders').select('id,status,expected_at'),
      db.from('production_facts').select('id,quantity,occurred_at,status').eq('status', 'confirmed').gte('occurred_at', recentSince),
      db.from('production_fact_process_entries').select('production_fact_id,total_value,occurred_at').gte('occurred_at', recentSince),
      db.from('production_fact_consumptions').select('production_fact_id,adjustment_status,quantity_consumed,quantity_applied'),
      db.from('production_closings').select('id,status'),
    ]);

    const firstError = ordersResult.error || separationResult.error || purchasesResult.error || factsResult.error || processResult.error || consumptionsResult.error || closingsResult.error;
    if (firstError) {
      setError(firstError.message || 'Não foi possível consolidar o Dashboard operacional.');
      setSnapshot(null);
      setLoading(false);
      return;
    }

    const productionShortages = plan.production.filter(need => need.shortage > 0);
    const purchaseShortages = plan.materials.filter(need => need.shortage > 0);
    const activeOrders = (ordersResult.data ?? []).filter((row: any) =>
      !['cancelado', 'concluido', 'entregue'].includes(row.status) &&
      !['finalized', 'finalizado', 'concluido', 'cancelado'].includes(row.operational_status || '')
    );
    const riskyOrders = activeOrders.filter((row: any) => isBeforeToday(row.due_date ?? row.delivery_date));
    const separation = (separationResult.data ?? []).filter((row: any) => OPEN_SEPARATION_STATUSES.includes(row.separation_status));
    const purchases = (purchasesResult.data ?? []).filter((row: any) => OPEN_PURCHASE_STATUSES.includes(row.status));
    const todayFacts = (factsResult.data ?? []).filter((row: any) => operationalDay(row.occurred_at) === today);
    const todayFactIds = new Set(todayFacts.map((row: any) => row.id));
    const laborToday = (processResult.data ?? [])
      .filter((row: any) => todayFactIds.has(row.production_fact_id))
      .reduce((sum: number, row: any) => sum + Number(row.total_value || 0), 0);
    const pendingFactIds = new Set(
      (consumptionsResult.data ?? [])
        .filter((row: any) => row.adjustment_status === 'pending' || Number(row.quantity_applied || 0) < Number(row.quantity_consumed || 0))
        .map((row: any) => row.production_fact_id)
    );

    setSnapshot({
      productionNeeds: productionShortages.length,
      productionUnits: productionShortages.reduce((sum, need) => sum + Number(need.shortage || 0), 0),
      purchaseNeeds: purchaseShortages.length,
      purchaseUnits: purchaseShortages.reduce((sum, need) => sum + Number(need.shortage || 0), 0),
      activeOrders: activeOrders.length,
      riskyOrders: riskyOrders.length,
      separationBacklog: separation.length,
      separationOver24h: separation.filter((row: any) => hoursSince(row.updated_at ?? row.created_at) > 24).length,
      inboundPurchases: purchases.length,
      overduePurchases: purchases.filter((row: any) => isBeforeToday(row.expected_at)).length,
      productionTodayUnits: todayFacts.reduce((sum: number, row: any) => sum + Number(row.quantity || 0), 0),
      productionTodayFacts: todayFacts.length,
      laborToday,
      pendingMaterialFacts: [...pendingFactIds].filter(id => todayFactIds.has(id)).length,
      openClosings: (closingsResult.data ?? []).filter((row: any) => row.status === 'aberto').length,
    });
    setLoading(false);
  }, [calculateOperationalPlan]);

  useEffect(() => { void load(); }, [load]);

  const actionCards = useMemo(() => {
    if (!snapshot) return [];
    return [
      {
        key: 'produce', title: 'Produzir agora', value: snapshot.productionNeeds,
        detail: snapshot.productionNeeds > 0 ? `${snapshot.productionUnits} un. ainda sem cobertura` : 'Nenhuma falta líquida para produzir',
        badge: snapshot.productionNeeds > 0 ? 'Ação' : null, tab: 'mrp' as OperationsTab, icon: Factory,
      },
      {
        key: 'buy', title: 'Comprar agora', value: snapshot.purchaseNeeds,
        detail: snapshot.purchaseNeeds > 0 ? `${snapshot.purchaseUnits} em unidades operacionais ainda sem cobertura` : 'Nenhuma necessidade líquida de compra',
        badge: snapshot.purchaseNeeds > 0 ? 'Ação' : null, tab: 'mrp' as OperationsTab, icon: Truck,
      },
      {
        key: 'orders', title: 'Pedidos em risco', value: snapshot.riskyOrders,
        detail: snapshot.riskyOrders > 0 ? `${snapshot.riskyOrders} vencido(s) entre ${snapshot.activeOrders} ativo(s)` : `${snapshot.activeOrders} pedido(s) ativo(s), nenhum vencido`,
        badge: snapshot.riskyOrders > 0 ? 'Prazo' : null, tab: 'orders' as OperationsTab, icon: ShoppingCart,
      },
      {
        key: 'separation', title: 'Separação', value: snapshot.separationBacklog,
        detail: snapshot.separationOver24h > 0 ? `${snapshot.separationOver24h} parado(s) há mais de 24h` : 'Fila sem item parado há mais de 24h',
        badge: snapshot.separationOver24h > 0 ? '+24h' : null, tab: 'separation' as OperationsTab, icon: PackageCheck,
      },
      {
        key: 'purchases', title: 'Compras em trânsito', value: snapshot.inboundPurchases,
        detail: snapshot.overduePurchases > 0 ? `${snapshot.overduePurchases} compra(s) após a previsão` : 'Nenhuma compra em trânsito vencida',
        badge: snapshot.overduePurchases > 0 ? 'Atraso' : null, tab: 'purchases' as OperationsTab, icon: ClipboardCheck,
      },
      {
        key: 'closing', title: 'Fechamentos abertos', value: snapshot.openClosings,
        detail: 'Financeiro ainda será conectado na F06',
        badge: null, tab: 'production' as OperationsTab, icon: WalletCards,
      },
    ];
  }, [snapshot]);

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0,1,2,3,4,5].map(i => <Skeleton key={i} className="h-32" />)}</div></div>;
  }

  if (error || !snapshot) {
    return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription className="flex items-center justify-between gap-2"><span>{error ?? 'Dashboard indisponível.'}</span><Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />Tentar novamente</Button></AlertDescription></Alert>;
  }

  const hasAction = snapshot.productionNeeds + snapshot.purchaseNeeds + snapshot.riskyOrders + snapshot.separationOver24h + snapshot.overduePurchases > 0;

  return <div className="space-y-4">
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg"><Boxes className="h-5 w-5" />O que precisa de atenção hoje</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Exceções acionáveis. Cada card leva para a engrenagem responsável.</p>
          </div>
          <div className="flex items-center gap-2"><Badge variant={hasAction ? 'destructive' : 'secondary'}>{hasAction ? 'Há ações pendentes' : 'Operação sem alerta crítico'}</Badge><Button size="icon" variant="ghost" onClick={() => void load()} aria-label="Atualizar Dashboard"><RefreshCw className="h-4 w-4" /></Button></div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {actionCards.map(item => {
          const Icon = item.icon;
          return <button type="button" key={item.key} onClick={() => onNavigate(item.tab)} className="rounded-xl border p-4 text-left transition-colors hover:bg-muted/50">
            <div className="flex items-start justify-between gap-2"><Icon className="h-5 w-5 text-muted-foreground" />{item.badge && <Badge variant="destructive" className="text-[10px]">{item.badge}</Badge>}</div>
            <p className="mt-3 text-3xl font-bold">{item.value}</p>
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
          </button>;
        })}
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Produção de hoje</CardTitle><p className="text-xs text-muted-foreground">Data operacional em America/Sao_Paulo.</p></CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button type="button" onClick={() => onNavigate('production')} className="rounded-lg border p-3 text-left"><p className="text-2xl font-bold">{snapshot.productionTodayUnits}</p><p className="text-xs text-muted-foreground">Unidades produzidas</p></button>
        <button type="button" onClick={() => onNavigate('production')} className="rounded-lg border p-3 text-left"><p className="text-2xl font-bold">{snapshot.productionTodayFacts}</p><p className="text-xs text-muted-foreground">Lançamentos físicos</p></button>
        <button type="button" onClick={() => onNavigate('production')} className="rounded-lg border p-3 text-left"><p className="text-2xl font-bold">{formatCurrency(snapshot.laborToday)}</p><p className="text-xs text-muted-foreground">Mão de obra lançada</p></button>
        <button type="button" onClick={() => onNavigate('production')} className="rounded-lg border p-3 text-left"><p className="text-2xl font-bold">{snapshot.pendingMaterialFacts}</p><p className="text-xs text-muted-foreground">Produções com ajuste</p></button>
      </CardContent>
    </Card>
  </div>;
}
