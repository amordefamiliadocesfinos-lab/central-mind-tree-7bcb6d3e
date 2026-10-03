import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Check, Factory, RefreshCw, ShoppingCart, TrendingDown } from 'lucide-react';
import { useMRP, MaterialNeed, ProductionNeed } from '@/hooks/useMRP';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const db = supabase as any;

type ActivePlannedOrder = {
  id: string;
  internal_production_number: string | null;
  target_quantity: number;
  status: string;
  scheduled_date: string | null;
  product?: { name: string; unit: string | null } | null;
  variant?: { variant_name: string; unit: string | null } | null;
  facts?: Array<{ quantity: number; status: string }>;
  demands?: Array<{ order_id: string; demand_quantity_snapshot: number; order_reference_snapshot: string | null }>;
};

function todaySaoPaulo() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function MRPTab() {
  const { calculateOperationalPlan } = useMRP();
  const [, setSearchParams] = useSearchParams();
  const [productionNeeds, setProductionNeeds] = useState<ProductionNeed[]>([]);
  const [purchaseNeeds, setPurchaseNeeds] = useState<MaterialNeed[]>([]);
  const [activeOps, setActiveOps] = useState<ActivePlannedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNeed, setSelectedNeed] = useState<ProductionNeed | null>(null);
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [plan, opResult] = await Promise.all([
      calculateOperationalPlan(),
      db.from('production_orders').select(`
        id,internal_production_number,target_quantity,status,scheduled_date,
        product:products(id,name,unit),
        variant:product_variants!production_orders_variant_id_fkey(id,variant_name,unit),
        facts:production_facts(quantity,status),
        demands:production_order_demands(order_id,demand_quantity_snapshot,order_reference_snapshot)
      `).in('status', ['aberto', 'producao']).eq('physical_flow_mode', 'production_facts').order('scheduled_date', { ascending: true }),
    ]);
    setProductionNeeds(plan.production);
    setPurchaseNeeds(plan.materials);
    if (opResult.error) console.error('Erro ao carregar OPs planejadas:', opResult.error);
    setActiveOps((opResult.data || []) as ActivePlannedOrder[]);
    setLoading(false);
  };
  useEffect(() => { void loadData(); }, []);

  const planProduction = async () => {
    if (!selectedNeed || selectedNeed.shortage <= 0) return;
    setCreating(true);
    const { data, error } = await (supabase.rpc as any)('plan_production_need', {
      p_product_id: selectedNeed.product_id,
      p_variant_id: selectedNeed.variant_id,
      p_quantity: Math.ceil(selectedNeed.shortage),
      p_order_demands: selectedNeed.order_demands.map(origin => ({
        order_id: origin.order_id,
        reference: origin.reference,
        quantity: origin.quantity,
        due_date: origin.due_date,
      })),
      p_scheduled_date: selectedNeed.suggested_date || todaySaoPaulo(),
    });
    setCreating(false);

    if (error) {
      console.error('Erro ao planejar produção:', error);
      toast.error(error.message || 'Não foi possível planejar a produção.');
      return;
    }
    const result = data as { success?: boolean; reason?: string; internal_production_number?: string; target_quantity?: number } | null;
    if (!result?.success) {
      if (result?.reason === 'multiple_active_orders') toast.error('Existem múltiplas OPs ativas para esta identidade. Regularize antes de ampliar o planejamento.');
      else if (result?.reason === 'product_not_manufactured') toast.error('Este produto não está configurado como fabricado.');
      else toast.error('Não foi possível consolidar a necessidade na OP.');
      return;
    }

    toast.success(`${result.internal_production_number || 'OP'} planejada. Meta atual: ${result.target_quantity ?? selectedNeed.shortage}.`);
    setSelectedNeed(null);
    await loadData();
  };

  const preparePurchase = (need: MaterialNeed) => {
    if (need.shortage <= 0) return;
    const params = new URLSearchParams({
      tab: 'purchases', mrpProductId: need.component_id, mrpNeedQty: String(need.shortage),
      mrpUnit: need.unit, mrpName: need.component_name,
    });
    if (need.variant_id) params.set('mrpVariantId', need.variant_id);
    if (need.orders_affected.length) params.set('mrpOrders', need.orders_affected.join('|'));
    setSearchParams(params, { replace: true });
  };

  const productionShortages = useMemo(() => productionNeeds.filter(n => n.shortage > 0), [productionNeeds]);
  const purchaseShortages = useMemo(() => purchaseNeeds.filter(n => n.shortage > 0), [purchaseNeeds]);
  const riskyIdentities = productionShortages.length + purchaseShortages.length;

  if (loading) return <div className="flex items-center justify-center py-10"><p className="text-muted-foreground">Calculando necessidade líquida...</p></div>;

  return <div className="space-y-4">
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Planejamento Operacional</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Pedido é demanda. OP organiza a produção. Produção Real comprova o que aconteceu.</p>
          </div>
          <Button variant="outline" size="icon" onClick={() => void loadData()} aria-label="Atualizar planejamento"><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border p-3 text-center"><p className="text-2xl font-bold">{productionShortages.length}</p><p className="text-[11px] text-muted-foreground">Produzir</p></div>
        <div className="rounded-lg border p-3 text-center"><p className="text-2xl font-bold">{purchaseShortages.length}</p><p className="text-[11px] text-muted-foreground">Comprar</p></div>
        <div className={cn('rounded-lg border p-3 text-center', riskyIdentities > 0 && 'border-amber-500/50')}><p className="text-2xl font-bold">{riskyIdentities}</p><p className="text-[11px] text-muted-foreground">Exigem ação</p></div>
      </CardContent>
    </Card>

    {activeOps.length > 0 && <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Factory className="h-4 w-4" />OPs ativas — planejado × realizado</CardTitle><p className="text-xs text-muted-foreground">Uma única OP ativa por Produto + Variante. Fatos Reais vinculados reduzem o restante sem movimentação adicional de estoque.</p></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {activeOps.map(order => {
          const produced = (order.facts || []).filter(fact => fact.status === 'confirmed').reduce((sum, fact) => sum + Number(fact.quantity || 0), 0);
          const planned = Number(order.target_quantity || 0);
          const remaining = Math.max(0, planned - produced);
          return <div key={order.id} className="rounded-xl border p-4 space-y-2">
            <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold text-primary">{order.internal_production_number || 'OP'}</p><p className="font-semibold">{order.product?.name || 'Produto'}{order.variant?.variant_name ? ` · ${order.variant.variant_name}` : ''}</p></div><Badge variant={remaining > 0 ? 'secondary' : 'default'}>{order.status === 'producao' ? 'Em produção' : 'Aberta'}</Badge></div>
            <div className="grid grid-cols-3 gap-2 text-center"><Mini label="Planejado" value={planned} /><Mini label="Real" value={produced} /><Mini label="Restante" value={remaining} danger={remaining > 0} /></div>
            <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Origem:</span> {(order.demands || []).length ? (order.demands || []).map(d => `${d.order_reference_snapshot || 'Pedido'} (${Number(d.demand_quantity_snapshot).toLocaleString('pt-BR')})`).join(', ') : 'estoque / sem Pedido vinculado'}</div>
            {order.scheduled_date && <div className="text-xs text-muted-foreground">Programada para: <strong className="text-foreground">{order.scheduled_date.split('-').reverse().join('/')}</strong></div>}
          </div>;
        })}
      </CardContent>
    </Card>}

    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Factory className="h-4 w-4" />Necessidade de produção</CardTitle><p className="text-xs text-muted-foreground">Se já existir OP ativa da identidade, a nova falta é consolidada nela; não é criada uma OP concorrente.</p></CardHeader>
      <CardContent className="p-0">
        {productionNeeds.length === 0 ? <Empty text="Nenhum produto fabricado possui demanda pendente." /> : <div className="overflow-x-auto"><Table>
          <TableHeader><TableRow><TableHead>Produto / variante</TableHead><TableHead className="text-right">Físico</TableHead><TableHead className="text-right">Comprometido</TableHead><TableHead className="text-right">Disponível agora</TableHead><TableHead className="text-right">Programado</TableHead><TableHead className="text-right">Projetado</TableHead><TableHead className="text-right">Falta</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{productionNeeds.map(need => <TableRow key={`${need.product_id}:${need.variant_id || 'simple'}`}>
            <TableCell><div className="font-medium">{need.product_name}</div><div className="text-xs text-muted-foreground">{need.variant_name || 'Produto simples'} · {need.orders_affected.length} pedido(s){need.suggested_date ? ` · até ${need.suggested_date.split('-').reverse().join('/')}` : ''}</div></TableCell>
            <Num value={need.stock_available} unit={need.unit} />
            <Num value={need.stock_committed} unit={need.unit} />
            <Num value={need.available_now} unit={need.unit} danger={need.available_now < 0} />
            <Num value={need.production_programmed} unit={need.unit} />
            <Num value={need.projected_balance} unit={need.unit} danger={need.projected_balance < need.stock_target} />
            <TableCell className="text-right"><Badge variant={need.shortage > 0 ? 'destructive' : 'secondary'}>{need.shortage} {need.unit}</Badge></TableCell>
            <TableCell className="text-right">{need.shortage > 0 && <Button size="sm" onClick={() => setSelectedNeed(need)}>{need.production_programmed > 0 ? 'Ampliar OP' : 'Planejar produção'}</Button>}</TableCell>
          </TableRow>)}</TableBody>
        </Table></div>}
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><ShoppingCart className="h-4 w-4" />Planejamento de compras</CardTitle><p className="text-xs text-muted-foreground">Une demanda direta de produtos comprados com matéria-prima necessária para cobrir a produção faltante, descontando estoque e compras ainda a receber.</p></CardHeader>
      <CardContent className="p-0">
        {purchaseNeeds.length === 0 ? <Empty text="Nenhum produto comprado ou matéria-prima exige planejamento neste momento." /> : <div className="overflow-x-auto"><Table>
          <TableHeader><TableRow><TableHead>Produto / material</TableHead><TableHead className="text-right">Físico</TableHead><TableHead className="text-right">Pedido direto</TableHead><TableHead className="text-right">Para produção</TableHead><TableHead className="text-right">A receber</TableHead><TableHead className="text-right">Projetado</TableHead><TableHead className="text-right">Comprar</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{purchaseNeeds.map(need => <TableRow key={`${need.component_id}:${need.variant_id || 'simple'}`}>
            <TableCell><div className="flex items-start gap-2">{need.shortage > 0 && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}<div><div className="font-medium">{need.component_name}</div><div className="text-xs text-muted-foreground">{need.component_sku || 'Sem SKU'} · {need.orders_affected.length} pedido(s) relacionado(s)</div></div></div></TableCell>
            <Num value={need.stock_available} unit={need.unit} />
            <Num value={need.direct_demand} unit={need.unit} />
            <Num value={need.production_requirement} unit={need.unit} />
            <Num value={need.open_purchase_qty} unit={need.unit} />
            <Num value={need.projected_balance} unit={need.unit} danger={need.projected_balance < need.stock_target} />
            <TableCell className="text-right"><Badge variant={need.shortage > 0 ? 'destructive' : 'secondary'}>{need.shortage} {need.unit}</Badge></TableCell>
            <TableCell className="text-right">{need.shortage > 0 && <Button size="sm" onClick={() => preparePurchase(need)}>Preparar compra</Button>}</TableCell>
          </TableRow>)}</TableBody>
        </Table></div>}
      </CardContent>
    </Card>

    <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground flex gap-2"><TrendingDown className="h-4 w-4 shrink-0" /><span><strong>OP é planejamento.</strong> O saldo físico só muda pelo Fato Real. O mesmo Pedido pode participar da origem de uma OP consolidada sem ser alterado.</span></div>

    <ResponsiveDialog open={!!selectedNeed} onOpenChange={open => !open && setSelectedNeed(null)} title="Planejar produção">
      {selectedNeed && <div className="space-y-4 p-4">
        <p className="text-sm">O sistema criará uma OP se não houver uma ativa para esta identidade. Se já houver, ampliará a mesma OP.</p>
        <div className="rounded-lg bg-muted p-3 text-sm space-y-1"><p className="font-medium">{selectedNeed.product_name}{selectedNeed.variant_name ? ` · ${selectedNeed.variant_name}` : ''}</p><p>Físico: <strong>{selectedNeed.stock_available}</strong> · Comprometido: <strong>{selectedNeed.stock_committed}</strong></p><p>Já programado: <strong>{selectedNeed.production_programmed}</strong> · Adicionar: <strong>{selectedNeed.shortage} {selectedNeed.unit}</strong></p>{selectedNeed.suggested_date && <p>Data sugerida: <strong>{selectedNeed.suggested_date.split('-').reverse().join('/')}</strong></p>}</div>
        <div className="space-y-1"><p className="text-xs font-semibold">Pedidos que originam a demanda</p>{selectedNeed.order_demands.map(origin => <div key={origin.order_id} className="flex justify-between rounded border px-2 py-1 text-xs"><span>{origin.reference}</span><span className="font-medium">{origin.quantity} {selectedNeed.unit}</span></div>)}</div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSelectedNeed(null)}>Cancelar</Button><Button disabled={creating} onClick={() => void planProduction()}>{creating ? 'Planejando...' : selectedNeed.production_programmed > 0 ? 'Ampliar OP existente' : 'Confirmar planejamento'}</Button></div>
      </div>}
    </ResponsiveDialog>
  </div>;
}

function Num({ value, unit, danger = false }: { value: number; unit: string; danger?: boolean }) {
  return <TableCell className={cn('text-right font-mono whitespace-nowrap', danger && 'font-semibold text-red-500')}>{Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {unit}</TableCell>;
}
function Mini({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return <div className="rounded-lg bg-muted/60 p-2"><p className={cn('text-lg font-bold', danger && 'text-amber-600')}>{Number(value).toLocaleString('pt-BR')}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>;
}
function Empty({ text }: { text: string }) {
  return <div className="py-8 text-center px-4"><Check className="mx-auto mb-2 h-10 w-10 text-green-500" /><p className="text-sm text-muted-foreground">{text}</p></div>;
}
