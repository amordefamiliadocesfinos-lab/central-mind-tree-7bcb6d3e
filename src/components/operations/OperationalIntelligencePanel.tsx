import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Boxes, Factory, PackageCheck, RefreshCw, ShoppingCart, Truck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { OPERATIONAL_START_DATE } from '@/lib/operationalStart';
import { useMRP } from '@/hooks/useMRP';
import type { OperationsTab } from './OperationsBottomNav';

const db = supabase as any;
const ACTIVE_ORDER_STATUSES = ['todo', 'preparing'];
const OPEN_PRODUCTION_STATUSES = ['aberto', 'producao'];
const OPEN_PURCHASE_STATUSES = ['confirmado', 'em_transito', 'parcialmente_recebido'];
const OPEN_SEPARATION_STATUSES = ['todo', 'preparing'];

type IntelligenceSnapshot = {
  activeOrders: number;
  overdueOrders: number;
  separationBacklog: number;
  separationOver24h: number;
  openProduction: number;
  overdueProduction: number;
  inboundPurchases: number;
  overduePurchases: number;
  productionNeeds: number;
  materialPurchaseNeeds: number;
};

interface Props {
  onNavigate: (tab: OperationsTab) => void;
}

function toDay(value?: string | null) {
  return value ? value.slice(0, 10) : null;
}

function isBeforeToday(value?: string | null) {
  const day = toDay(value);
  if (!day) return false;
  return day < new Date().toISOString().slice(0, 10);
}

function hoursSince(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 0;
  return (Date.now() - time) / 3_600_000;
}

export function OperationalIntelligencePanel({ onNavigate }: Props) {
  const { calculateProductionNeeds, calculateMaterialNeeds } = useMRP();
  const [snapshot, setSnapshot] = useState<IntelligenceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [ordersResult, separationResult, productionResult, purchasesResult, productionNeeds, materialNeeds] = await Promise.all([
      db.from('orders')
        .select('id,operational_status,due_date,delivery_date,created_at')
        .is('deleted_at', null)
        .gte('created_at', `${OPERATIONAL_START_DATE}T00:00:00`),
      db.from('order_separation')
        .select('id,separation_status,created_at,updated_at')
        .gte('created_at', `${OPERATIONAL_START_DATE}T00:00:00`),
      db.from('production_orders')
        .select('id,status,scheduled_date,created_at')
        .gte('created_at', `${OPERATIONAL_START_DATE}T00:00:00`),
      db.from('purchase_orders')
        .select('id,status,expected_at,created_at')
        .gte('created_at', `${OPERATIONAL_START_DATE}T00:00:00`),
      calculateProductionNeeds(),
      calculateMaterialNeeds(),
    ]);

    const firstError = ordersResult.error || separationResult.error || productionResult.error || purchasesResult.error;
    if (firstError) {
      setError(firstError.message || 'Não foi possível consolidar a inteligência operacional.');
      setSnapshot(null);
      setLoading(false);
      return;
    }

    const activeOrders = (ordersResult.data ?? []).filter((row: any) => ACTIVE_ORDER_STATUSES.includes(row.operational_status ?? 'todo'));
    const separationBacklog = (separationResult.data ?? []).filter((row: any) => OPEN_SEPARATION_STATUSES.includes(row.separation_status));
    const openProduction = (productionResult.data ?? []).filter((row: any) => OPEN_PRODUCTION_STATUSES.includes(row.status));
    const inboundPurchases = (purchasesResult.data ?? []).filter((row: any) => OPEN_PURCHASE_STATUSES.includes(row.status));

    setSnapshot({
      activeOrders: activeOrders.length,
      overdueOrders: activeOrders.filter((row: any) => isBeforeToday(row.due_date ?? row.delivery_date)).length,
      separationBacklog: separationBacklog.length,
      separationOver24h: separationBacklog.filter((row: any) => hoursSince(row.updated_at ?? row.created_at) > 24).length,
      openProduction: openProduction.length,
      overdueProduction: openProduction.filter((row: any) => isBeforeToday(row.scheduled_date)).length,
      inboundPurchases: inboundPurchases.length,
      overduePurchases: inboundPurchases.filter((row: any) => isBeforeToday(row.expected_at)).length,
      productionNeeds: productionNeeds.filter(need => need.shortage > 0).length,
      materialPurchaseNeeds: materialNeeds.filter(need => need.shortage > 0).length,
    });
    setLoading(false);
  }, [calculateMaterialNeeds, calculateProductionNeeds]);

  useEffect(() => {
    void load();
  }, [load]);

  const exceptions = useMemo(() => {
    if (!snapshot) return [];
    return [
      {
        key: 'orders',
        title: 'Pedidos exigindo ação',
        value: snapshot.activeOrders,
        alert: snapshot.overdueOrders,
        alertLabel: 'vencido(s)',
        detail: snapshot.overdueOrders > 0 ? `${snapshot.overdueOrders} fora do prazo informado` : 'Nenhum pedido ativo vencido',
        tab: 'orders' as OperationsTab,
        icon: ShoppingCart,
      },
      {
        key: 'separation',
        title: 'Fila de separação',
        value: snapshot.separationBacklog,
        alert: snapshot.separationOver24h,
        alertLabel: 'há +24h',
        detail: snapshot.separationOver24h > 0 ? `${snapshot.separationOver24h} parado(s) há mais de 24h` : 'Nenhum item parado há mais de 24h',
        tab: 'separation' as OperationsTab,
        icon: PackageCheck,
      },
      {
        key: 'production',
        title: 'Ordens de produção abertas',
        value: snapshot.openProduction,
        alert: snapshot.overdueProduction,
        alertLabel: 'atrasada(s)',
        detail: snapshot.productionNeeds > 0 ? `${snapshot.productionNeeds} identidade(s) ainda com falta para produzir` : 'MRP sem falta líquida de produção',
        tab: 'production' as OperationsTab,
        icon: Factory,
      },
      {
        key: 'purchases',
        title: 'Compras a receber',
        value: snapshot.inboundPurchases,
        alert: snapshot.overduePurchases,
        alertLabel: 'após previsão',
        detail: snapshot.materialPurchaseNeeds > 0 ? `${snapshot.materialPurchaseNeeds} material(is) ainda precisam de compra` : 'MRP sem necessidade líquida de compra',
        tab: 'purchases' as OperationsTab,
        icon: Truck,
      },
    ];
  }, [snapshot]);

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Inteligência operacional</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map(item => <Skeleton key={item} className="h-28 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (error || !snapshot) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
          <span>{error ?? 'Inteligência operacional indisponível.'}</span>
          <Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />Tentar novamente</Button>
        </AlertDescription>
      </Alert>
    );
  }

  const totalExceptions = snapshot.overdueOrders + snapshot.separationOver24h + snapshot.overdueProduction + snapshot.overduePurchases + snapshot.productionNeeds + snapshot.materialPurchaseNeeds;

  return (
    <Card>
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Boxes className="h-4 w-4" />Inteligência operacional</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Exceções acionáveis desde {OPERATIONAL_START_DATE.split('-').reverse().join('/')}. Não cria dados novos: lê Pedidos, Separação, Produção, Compras e MRP.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={totalExceptions > 0 ? 'destructive' : 'secondary'}>{totalExceptions} sinal(is)</Badge>
            <Button size="icon" variant="ghost" aria-label="Atualizar inteligência operacional" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {exceptions.map(item => {
          const Icon = item.icon;
          return (
            <button
              type="button"
              key={item.key}
              onClick={() => onNavigate(item.tab)}
              className="rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {item.alert > 0 && <Badge variant="destructive" className="text-[10px]">{item.alert} {item.alertLabel}</Badge>}
              </div>
              <p className="mt-3 text-2xl font-bold">{item.value}</p>
              <p className="text-xs font-medium">{item.title}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{item.detail}</p>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
