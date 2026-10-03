import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Check, Factory, RefreshCw, ShoppingCart, TrendingDown } from 'lucide-react';
import { useMRP, MaterialNeed, ProductionNeed } from '@/hooks/useMRP';
import { useProductionOrders } from '@/hooks/useProductionOrders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function MRPTab() {
  const { calculateOperationalPlan } = useMRP();
  const { createOrder } = useProductionOrders();
  const [, setSearchParams] = useSearchParams();
  const [productionNeeds, setProductionNeeds] = useState<ProductionNeed[]>([]);
  const [purchaseNeeds, setPurchaseNeeds] = useState<MaterialNeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNeed, setSelectedNeed] = useState<ProductionNeed | null>(null);
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const plan = await calculateOperationalPlan();
    setProductionNeeds(plan.production);
    setPurchaseNeeds(plan.materials);
    setLoading(false);
  };
  useEffect(() => { void loadData(); }, []);

  const createProductionOrder = async () => {
    if (!selectedNeed) return;
    setCreating(true);
    const created = await createOrder({
      product_id: selectedNeed.product_id,
      variant_id: selectedNeed.variant_id,
      target_quantity: selectedNeed.shortage,
      scheduled_date: new Date().toISOString().slice(0, 10),
      status: 'aberto',
      notes: `Planejamento operacional — necessidade consolidada de: ${selectedNeed.orders_affected.join(', ')}`,
    }, []);
    setCreating(false);
    if (created) {
      toast.success('OP criada. O estoque não foi movimentado.');
      setSelectedNeed(null);
      await loadData();
    }
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
            <p className="mt-1 text-xs text-muted-foreground">Pedido é demanda. Estoque é realidade física. O planejamento calcula o que falta produzir ou comprar sem movimentar estoque.</p>
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

    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Factory className="h-4 w-4" />Planejamento de produção</CardTitle><p className="text-xs text-muted-foreground">Físico − comprometido + produção programada. O mínimo do produto simples entra como alvo; variantes ainda ficam orientadas pela demanda real.</p></CardHeader>
      <CardContent className="p-0">
        {productionNeeds.length === 0 ? <Empty text="Nenhum produto fabricado possui demanda pendente." /> : <div className="overflow-x-auto"><Table>
          <TableHeader><TableRow><TableHead>Produto / variante</TableHead><TableHead className="text-right">Físico</TableHead><TableHead className="text-right">Comprometido</TableHead><TableHead className="text-right">Disponível agora</TableHead><TableHead className="text-right">Programado</TableHead><TableHead className="text-right">Projetado</TableHead><TableHead className="text-right">Falta</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{productionNeeds.map(need => <TableRow key={`${need.product_id}:${need.variant_id || 'simple'}`}>
            <TableCell><div className="font-medium">{need.product_name}</div><div className="text-xs text-muted-foreground">{need.variant_name || 'Produto simples'} · {need.orders_affected.length} pedido(s)</div></TableCell>
            <Num value={need.stock_available} unit={need.unit} />
            <Num value={need.stock_committed} unit={need.unit} />
            <Num value={need.available_now} unit={need.unit} danger={need.available_now < 0} />
            <Num value={need.production_programmed} unit={need.unit} />
            <Num value={need.projected_balance} unit={need.unit} danger={need.projected_balance < need.stock_target} />
            <TableCell className="text-right"><Badge variant={need.shortage > 0 ? 'destructive' : 'secondary'}>{need.shortage} {need.unit}</Badge></TableCell>
            <TableCell className="text-right">{need.shortage > 0 && <Button size="sm" onClick={() => setSelectedNeed(need)}>Planejar produção</Button>}</TableCell>
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

    <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground flex gap-2"><TrendingDown className="h-4 w-4 shrink-0" /><span><strong>Disponível agora</strong> pode ficar negativo quando Pedidos ativos superam o estoque físico. <strong>Projetado</strong> considera OPs abertas ou compras confirmadas ainda não recebidas.</span></div>

    <ResponsiveDialog open={!!selectedNeed} onOpenChange={open => !open && setSelectedNeed(null)} title="Planejar produção">
      {selectedNeed && <div className="space-y-4 p-4"><p className="text-sm">A OP organiza a necessidade; não movimenta estoque e não altera os Pedidos de origem.</p><div className="rounded-lg bg-muted p-3 text-sm space-y-1"><p className="font-medium">{selectedNeed.product_name}{selectedNeed.variant_name ? ` · ${selectedNeed.variant_name}` : ''}</p><p>Físico: <strong>{selectedNeed.stock_available}</strong> · Comprometido: <strong>{selectedNeed.stock_committed}</strong></p><p>Programado: <strong>{selectedNeed.production_programmed}</strong> · Falta: <strong>{selectedNeed.shortage} {selectedNeed.unit}</strong></p><p className="text-xs text-muted-foreground">Origem: {selectedNeed.orders_affected.join(', ')}</p></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSelectedNeed(null)}>Cancelar</Button><Button disabled={creating} onClick={() => void createProductionOrder()}>{creating ? 'Criando...' : 'Criar OP'}</Button></div></div>}
    </ResponsiveDialog>
  </div>;
}

function Num({ value, unit, danger = false }: { value: number; unit: string; danger?: boolean }) {
  return <TableCell className={cn('text-right font-mono whitespace-nowrap', danger && 'font-semibold text-red-500')}>{Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {unit}</TableCell>;
}
function Empty({ text }: { text: string }) {
  return <div className="py-8 text-center px-4"><Check className="mx-auto mb-2 h-10 w-10 text-green-500" /><p className="text-sm text-muted-foreground">{text}</p></div>;
}
