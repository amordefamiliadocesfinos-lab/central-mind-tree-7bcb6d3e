import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Download, Factory, Package, RefreshCw } from 'lucide-react';
import { useMRP, MaterialNeed, ProductionNeed } from '@/hooks/useMRP';
import { useProductionOrders } from '@/hooks/useProductionOrders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers, ...rows].map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}

export function MRPTab() {
  const { calculateProductionNeeds, calculateMaterialNeeds } = useMRP();
  const { createOrder } = useProductionOrders();
  const [productionNeeds, setProductionNeeds] = useState<ProductionNeed[]>([]);
  const [materialNeeds, setMaterialNeeds] = useState<MaterialNeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNeed, setSelectedNeed] = useState<ProductionNeed | null>(null);
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [production, materials] = await Promise.all([calculateProductionNeeds(), calculateMaterialNeeds()]);
    setProductionNeeds(production); setMaterialNeeds(materials); setLoading(false);
  };
  useEffect(() => { void loadData(); }, []);

  const createProductionOrder = async () => {
    if (!selectedNeed) return;
    setCreating(true);
    const created = await createOrder({
      product_id: selectedNeed.product_id, variant_id: selectedNeed.variant_id, target_quantity: selectedNeed.shortage,
      scheduled_date: new Date().toISOString().slice(0, 10), status: 'aberto',
      notes: `Planejado pelo MRP para demanda: ${selectedNeed.orders_affected.join(', ')}`,
    }, []);
    setCreating(false);
    if (created) { toast.success('OP criada a partir do planejamento. Nenhum estoque foi movimentado.'); setSelectedNeed(null); await loadData(); }
  };
  const exportPlan = () => {
    downloadCsv(`mrp-planejamento-${new Date().toISOString().slice(0, 10)}.csv`, ['Produto', 'Variante', 'Demanda', 'Estoque disponível', 'OPs abertas/em produção', 'Falta produzir', 'Pedidos'], productionNeeds.map(need => [need.product_name, need.variant_name || 'Produto simples', String(need.demand), String(need.stock_available), String(need.production_programmed), String(need.shortage), need.orders_affected.join('; ')]));
    toast.success('Planejamento exportado.');
  };
  if (loading) return <div className="flex items-center justify-center py-8"><p className="text-muted-foreground">Calculando planejamento...</p></div>;
  const productionShortages = productionNeeds.filter(need => need.shortage > 0);
  const materialShortages = materialNeeds.filter(need => need.shortage > 0);

  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3">
      <Card className={cn(productionShortages.length > 0 && 'border-amber-500/50')}><CardContent className="pt-4 text-center"><p className="text-3xl font-bold">{productionShortages.length}</p><p className="text-xs text-muted-foreground">Itens a produzir</p></CardContent></Card>
      <Card className={cn(materialShortages.length > 0 && 'border-amber-500/50')}><CardContent className="pt-4 text-center"><p className="text-3xl font-bold">{materialShortages.length}</p><p className="text-xs text-muted-foreground">Materiais em falta</p></CardContent></Card>
    </div>
    <div className="flex gap-2"><Button variant="outline" onClick={() => void loadData()} className="flex-1"><RefreshCw className="h-4 w-4 mr-2" />Atualizar</Button><Button variant="outline" size="icon" onClick={exportPlan}><Download className="h-4 w-4" /></Button></div>
    <Card><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Factory className="h-4 w-4" />Necessidade de Produção</CardTitle><p className="text-xs text-muted-foreground">Planejamento: demanda comercial menos estoque acabado e OPs abertas/em produção.</p></CardHeader><CardContent className="p-0">
      {productionNeeds.length === 0 ? <div className="text-center py-8 px-4"><Check className="h-12 w-12 mx-auto text-green-500 mb-2" /><p className="text-sm text-muted-foreground">Não há demanda comercial pendente para planejar.</p></div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Produto / variante</TableHead><TableHead className="text-right">Demanda</TableHead><TableHead className="text-right">Estoque</TableHead><TableHead className="text-right">Programado</TableHead><TableHead className="text-right">Falta produzir</TableHead><TableHead /></TableRow></TableHeader><TableBody>{productionNeeds.map(need => <TableRow key={`${need.product_id}:${need.variant_id || 'simple'}`}><TableCell><span className="font-medium">{need.product_name}</span><span className="text-xs text-muted-foreground block">{need.variant_name || 'Produto simples'}{need.variant_sku || need.product_sku ? ` · ${need.variant_sku || need.product_sku}` : ''}</span></TableCell><TableCell className="text-right font-mono">{need.demand}</TableCell><TableCell className="text-right font-mono">{need.stock_available}</TableCell><TableCell className="text-right font-mono">{need.production_programmed}</TableCell><TableCell className={cn('text-right font-mono font-bold', need.shortage > 0 ? 'text-red-500' : 'text-green-500')}>{need.shortage}</TableCell><TableCell className="text-right">{need.shortage > 0 && <Button size="sm" onClick={() => setSelectedNeed(need)}>Criar OP</Button>}</TableCell></TableRow>)}</TableBody></Table></div>}
    </CardContent></Card>
    <Card><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" />Necessidade de Materiais</CardTitle><p className="text-xs text-muted-foreground">Calculada só para a falta de produção. Não é sugestão de compra e não movimenta estoque.</p></CardHeader><CardContent className="p-0">
      {materialNeeds.length === 0 ? <div className="text-center py-8 px-4"><Check className="h-12 w-12 mx-auto text-green-500 mb-2" /><p className="text-sm text-muted-foreground">Nenhum material adicional é necessário para a produção planejada.</p></div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Componente</TableHead><TableHead className="text-right">Necessário</TableHead><TableHead className="text-right">Disponível</TableHead><TableHead className="text-right">Faltante</TableHead></TableRow></TableHeader><TableBody>{materialNeeds.map(need => <TableRow key={`${need.component_id}:${need.variant_id || 'simple'}`}><TableCell><div className="flex items-center gap-2">{need.shortage > 0 && <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />}<div><span className="font-medium">{need.component_name}</span><span className="text-xs text-muted-foreground block">{need.component_sku}</span></div></div></TableCell><TableCell className="text-right font-mono">{need.total_needed} {need.unit}</TableCell><TableCell className="text-right font-mono">{need.stock_available}</TableCell><TableCell className={cn('text-right font-mono font-bold', need.shortage > 0 ? 'text-red-500' : 'text-green-500')}>{need.shortage}</TableCell></TableRow>)}</TableBody></Table></div>}
    </CardContent></Card>
    <ResponsiveDialog open={!!selectedNeed} onOpenChange={open => !open && setSelectedNeed(null)} title="Criar OP a partir do MRP">{selectedNeed && <div className="space-y-4 p-4"><p className="text-sm">A OP nasce <strong>aberta</strong>; ela não movimenta estoque nem altera o pedido.</p><div className="rounded-lg bg-muted p-3 text-sm space-y-1"><p className="font-medium">{selectedNeed.product_name}{selectedNeed.variant_name ? ` · ${selectedNeed.variant_name}` : ''}</p><p>Quantidade sugerida: <strong>{selectedNeed.shortage} {selectedNeed.unit}</strong></p><p>Referência: {selectedNeed.orders_affected.join(', ')}</p></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSelectedNeed(null)}>Cancelar</Button><Button disabled={creating} onClick={() => void createProductionOrder()}>{creating ? 'Criando...' : 'Confirmar criação da OP'}</Button></div></div>}</ResponsiveDialog>
  </div>;
}
