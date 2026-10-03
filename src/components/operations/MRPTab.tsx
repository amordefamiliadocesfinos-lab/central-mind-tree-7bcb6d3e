import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Check, Clock3, Factory, RefreshCw, Settings2, ShoppingCart, TrendingDown } from 'lucide-react';
import { useMRP, MaterialNeed, ProductionNeed, type PurchaseTimingStatus } from '@/hooks/useMRP';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const db = supabase as any;
type ActivePlannedOrder = { id: string; internal_production_number: string | null; target_quantity: number; status: string; scheduled_date: string | null; product?: { name: string; unit: string | null } | null; variant?: { variant_name: string; unit: string | null } | null; facts?: Array<{ quantity: number; status: string }>; demands?: Array<{ order_id: string; demand_quantity_snapshot: number; order_reference_snapshot: string | null }>; };
type SupplierOption = { id: string; name: string };

function todaySaoPaulo() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function formatDate(value: string | null) { return value ? value.split('-').reverse().join('/') : '—'; }

export function MRPTab() {
  const { calculateOperationalPlan } = useMRP();
  const [, setSearchParams] = useSearchParams();
  const [productionNeeds, setProductionNeeds] = useState<ProductionNeed[]>([]);
  const [purchaseNeeds, setPurchaseNeeds] = useState<MaterialNeed[]>([]);
  const [activeOps, setActiveOps] = useState<ActivePlannedOrder[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNeed, setSelectedNeed] = useState<ProductionNeed | null>(null);
  const [selectedTimingNeed, setSelectedTimingNeed] = useState<MaterialNeed | null>(null);
  const [policySupplierId, setPolicySupplierId] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState('0');
  const [safetyDays, setSafetyDays] = useState('0');
  const [creating, setCreating] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [plan, opResult, supplierResult] = await Promise.all([
      calculateOperationalPlan(),
      db.from('production_orders').select(`id,internal_production_number,target_quantity,status,scheduled_date,product:products(id,name,unit),variant:product_variants!production_orders_variant_id_fkey(id,variant_name,unit),facts:production_facts(quantity,status),demands:production_order_demands(order_id,demand_quantity_snapshot,order_reference_snapshot)`).in('status', ['aberto', 'producao']).eq('physical_flow_mode', 'production_facts').order('scheduled_date', { ascending: true }),
      db.from('contacts').select('id,name').eq('is_active', true).in('type', ['fornecedor', 'ambos']).order('name'),
    ]);
    setProductionNeeds(plan.production); setPurchaseNeeds(plan.materials);
    if (opResult.error) console.error('Erro ao carregar OPs planejadas:', opResult.error);
    if (supplierResult.error) console.error('Erro ao carregar fornecedores:', supplierResult.error);
    setActiveOps((opResult.data || []) as ActivePlannedOrder[]); setSuppliers((supplierResult.data || []) as SupplierOption[]); setLoading(false);
  };
  useEffect(() => { void loadData(); }, []);

  const planProduction = async () => {
    if (!selectedNeed || selectedNeed.shortage <= 0) return;
    setCreating(true);
    const { data, error } = await (supabase.rpc as any)('plan_production_need', { p_product_id: selectedNeed.product_id, p_variant_id: selectedNeed.variant_id, p_quantity: Math.ceil(selectedNeed.shortage), p_order_demands: selectedNeed.order_demands.map(origin => ({ order_id: origin.order_id, reference: origin.reference, quantity: origin.quantity, due_date: origin.due_date })), p_scheduled_date: selectedNeed.suggested_date || todaySaoPaulo() });
    setCreating(false);
    if (error) return toast.error(error.message || 'Não foi possível planejar a produção.');
    const result = data as { success?: boolean; reason?: string; internal_production_number?: string; target_quantity?: number } | null;
    if (!result?.success) {
      if (result?.reason === 'multiple_active_orders') toast.error('Existem múltiplas OPs ativas para esta identidade. Regularize antes de ampliar o planejamento.');
      else if (result?.reason === 'product_not_manufactured') toast.error('Este produto não está configurado como fabricado.');
      else toast.error('Não foi possível consolidar a necessidade na OP.');
      return;
    }
    toast.success(`${result.internal_production_number || 'OP'} planejada. Meta atual: ${result.target_quantity ?? selectedNeed.shortage}.`);
    setSelectedNeed(null); await loadData();
  };

  const preparePurchase = (need: MaterialNeed) => {
    if (need.shortage <= 0 && need.timing_status !== 'late_delivery') return;
    const params = new URLSearchParams({ tab: 'purchases', mrpProductId: need.component_id, mrpNeedQty: String(Math.max(0, need.shortage)), mrpUnit: need.unit, mrpName: need.component_name });
    if (need.variant_id) params.set('mrpVariantId', need.variant_id);
    if (need.orders_affected.length) params.set('mrpOrders', need.orders_affected.join('|'));
    if (need.preferred_supplier_id) params.set('mrpSupplierId', need.preferred_supplier_id);
    if (need.target_arrival_date) params.set('mrpExpectedAt', need.target_arrival_date);
    if (need.purchase_by_date) params.set('mrpPurchaseBy', need.purchase_by_date);
    setSearchParams(params, { replace: true });
  };
  const openTimingPolicy = (need: MaterialNeed) => { setSelectedTimingNeed(need); setPolicySupplierId(need.preferred_supplier_id || ''); setLeadTimeDays(String(need.lead_time_days ?? 0)); setSafetyDays(String(need.safety_days ?? 0)); };
  const saveTimingPolicy = async () => {
    if (!selectedTimingNeed || !policySupplierId) return toast.error('Selecione o fornecedor preferencial.');
    const lead = Number(leadTimeDays), safety = Number(safetyDays);
    if (!Number.isInteger(lead) || lead < 0 || !Number.isInteger(safety) || safety < 0) return toast.error('Informe prazos inteiros iguais ou maiores que zero.');
    setSavingPolicy(true);
    const { data, error } = await (supabase.rpc as any)('upsert_purchase_replenishment_policy', { p_product_id: selectedTimingNeed.component_id, p_variant_id: selectedTimingNeed.variant_id, p_supplier_contact_id: policySupplierId, p_lead_time_days: lead, p_safety_days: safety, p_is_preferred: true, p_is_active: true, p_notes: null });
    setSavingPolicy(false);
    if (error) return toast.error(error.message || 'Não foi possível salvar o prazo de reposição.');
    if (!(data as any)?.success) return toast.error('Não foi possível salvar o prazo de reposição.');
    toast.success('Prazo de reposição atualizado.'); setSelectedTimingNeed(null); await loadData();
  };

  const productionShortages = useMemo(() => productionNeeds.filter(n => n.shortage > 0), [productionNeeds]);
  const purchaseShortages = useMemo(() => purchaseNeeds.filter(n => n.shortage > 0), [purchaseNeeds]);
  const overduePurchases = useMemo(() => purchaseNeeds.filter(n => n.timing_status === 'overdue' || n.timing_status === 'late_delivery'), [purchaseNeeds]);
  const dueTodayPurchases = useMemo(() => purchaseShortages.filter(n => n.timing_status === 'due_today'), [purchaseShortages]);
  const riskyIdentities = productionShortages.length + new Set(purchaseNeeds.filter(n => n.shortage > 0 || n.timing_status === 'late_delivery').map(n => `${n.component_id}:${n.variant_id || 'simple'}`)).size;

  if (loading) return <div className="flex items-center justify-center py-10"><p className="text-muted-foreground">Calculando necessidade líquida...</p></div>;

  return <div className="space-y-4">
    <Card><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg">Planejamento Operacional</CardTitle><p className="mt-1 text-xs text-muted-foreground">Pedido é demanda. OP organiza produção. Compras antecipam reposição. Fatos físicos continuam no estoque.</p></div><Button variant="outline" size="icon" onClick={() => void loadData()} aria-label="Atualizar planejamento"><RefreshCw className="h-4 w-4" /></Button></div></CardHeader><CardContent className="grid grid-cols-2 gap-2 lg:grid-cols-4"><div className="rounded-lg border p-3 text-center"><p className="text-2xl font-bold">{productionShortages.length}</p><p className="text-[11px] text-muted-foreground">Produzir</p></div><div className="rounded-lg border p-3 text-center"><p className="text-2xl font-bold">{purchaseShortages.length}</p><p className="text-[11px] text-muted-foreground">Comprar</p></div><div className={cn('rounded-lg border p-3 text-center', overduePurchases.length > 0 && 'border-red-500/60')}><p className={cn('text-2xl font-bold', overduePurchases.length > 0 && 'text-red-600')}>{overduePurchases.length}</p><p className="text-[11px] text-muted-foreground">Prazo crítico</p></div><div className={cn('rounded-lg border p-3 text-center', riskyIdentities > 0 && 'border-amber-500/50')}><p className="text-2xl font-bold">{riskyIdentities}</p><p className="text-[11px] text-muted-foreground">Exigem ação</p></div></CardContent></Card>

    {activeOps.length > 0 && <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Factory className="h-4 w-4" />OPs ativas — planejado × realizado</CardTitle><p className="text-xs text-muted-foreground">Uma única OP ativa por Produto + Variante. Fatos Reais vinculados reduzem o restante sem movimentação adicional de estoque.</p></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{activeOps.map(order => { const produced = (order.facts || []).filter(fact => fact.status === 'confirmed').reduce((sum, fact) => sum + Number(fact.quantity || 0), 0); const planned = Number(order.target_quantity || 0); const remaining = Math.max(0, planned - produced); return <div key={order.id} className="rounded-xl border p-4 space-y-2"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold text-primary">{order.internal_production_number || 'OP'}</p><p className="font-semibold">{order.product?.name || 'Produto'}{order.variant?.variant_name ? ` · ${order.variant.variant_name}` : ''}</p></div><Badge variant={remaining > 0 ? 'secondary' : 'default'}>{order.status === 'producao' ? 'Em produção' : 'Aberta'}</Badge></div><div className="grid grid-cols-3 gap-2 text-center"><Mini label="Planejado" value={planned} /><Mini label="Real" value={produced} /><Mini label="Restante" value={remaining} danger={remaining > 0} /></div><div className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Origem:</span> {(order.demands || []).length ? (order.demands || []).map(d => `${d.order_reference_snapshot || 'Pedido'} (${Number(d.demand_quantity_snapshot).toLocaleString('pt-BR')})`).join(', ') : 'estoque / sem Pedido vinculado'}</div>{order.scheduled_date && <div className="text-xs text-muted-foreground">Programada para: <strong className="text-foreground">{formatDate(order.scheduled_date)}</strong></div>}</div>; })}</CardContent></Card>}

    <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Factory className="h-4 w-4" />Necessidade de produção</CardTitle><p className="text-xs text-muted-foreground">Se já existir OP ativa da identidade, a nova falta é consolidada nela; não é criada uma OP concorrente.</p></CardHeader><CardContent className="p-0">{productionNeeds.length === 0 ? <Empty text="Nenhum produto fabricado possui demanda pendente." /> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Produto / variante</TableHead><TableHead className="text-right">Físico</TableHead><TableHead className="text-right">Comprometido</TableHead><TableHead className="text-right">Disponível agora</TableHead><TableHead className="text-right">Programado</TableHead><TableHead className="text-right">Projetado</TableHead><TableHead className="text-right">Falta</TableHead><TableHead /></TableRow></TableHeader><TableBody>{productionNeeds.map(need => <TableRow key={`${need.product_id}:${need.variant_id || 'simple'}`}><TableCell><div className="font-medium">{need.product_name}</div><div className="text-xs text-muted-foreground">{need.variant_name || 'Produto simples'} · {need.orders_affected.length} pedido(s){need.suggested_date ? ` · até ${formatDate(need.suggested_date)}` : ''}</div></TableCell><Num value={need.stock_available} unit={need.unit} /><Num value={need.stock_committed} unit={need.unit} /><Num value={need.available_now} unit={need.unit} danger={need.available_now < 0} /><Num value={need.production_programmed} unit={need.unit} /><Num value={need.projected_balance} unit={need.unit} danger={need.projected_balance < need.stock_target} /><TableCell className="text-right"><Badge variant={need.shortage > 0 ? 'destructive' : 'secondary'}>{need.shortage} {need.unit}</Badge></TableCell><TableCell className="text-right">{need.shortage > 0 && <Button size="sm" onClick={() => setSelectedNeed(need)}>{need.production_programmed > 0 ? 'Ampliar OP' : 'Planejar produção'}</Button>}</TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card>

    <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><ShoppingCart className="h-4 w-4" />Planejamento de compras</CardTitle><p className="text-xs text-muted-foreground">A necessidade considera estoque e compras a receber. Prazo usa demanda mais urgente + lead time + margem de segurança e também denuncia entregas já atrasadas.</p></CardHeader><CardContent className="p-0">{purchaseNeeds.length === 0 ? <Empty text="Nenhum produto comprado ou matéria-prima exige planejamento neste momento." /> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Produto / material</TableHead><TableHead className="text-right">Físico</TableHead><TableHead className="text-right">Para produção</TableHead><TableHead className="text-right">A receber</TableHead><TableHead className="text-right">Comprar</TableHead><TableHead>Prazo</TableHead><TableHead /></TableRow></TableHeader><TableBody>{purchaseNeeds.map(need => <TableRow key={`${need.component_id}:${need.variant_id || 'simple'}`}><TableCell><div className="flex items-start gap-2">{(need.shortage > 0 || need.timing_status === 'late_delivery') && <AlertTriangle className={cn('mt-0.5 h-4 w-4 shrink-0', ['overdue','late_delivery'].includes(need.timing_status) ? 'text-red-600' : 'text-amber-500')} />}<div><div className="font-medium">{need.component_name}</div><div className="text-xs text-muted-foreground">{need.component_sku || 'Sem SKU'} · {need.orders_affected.length} pedido(s) relacionado(s){need.direct_demand > 0 ? ` · pedido direto ${need.direct_demand} ${need.unit}` : ''}</div></div></div></TableCell><Num value={need.stock_available} unit={need.unit} /><Num value={need.production_requirement} unit={need.unit} /><Num value={need.open_purchase_qty} unit={need.unit} danger={need.late_open_purchase_qty > 0} /><TableCell className="text-right"><Badge variant={need.shortage > 0 ? 'destructive' : 'secondary'}>{need.shortage} {need.unit}</Badge></TableCell><TableCell><TimingSummary need={need} /></TableCell><TableCell className="text-right"><div className="flex justify-end gap-1">{need.shortage > 0 && <Button size="sm" onClick={() => preparePurchase(need)}>Preparar compra</Button>}<Button variant="outline" size="icon" onClick={() => openTimingPolicy(need)} title="Configurar prazo"><Settings2 className="h-4 w-4" /></Button></div></TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card>

    {(overduePurchases.length > 0 || dueTodayPurchases.length > 0) && <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm"><strong>{overduePurchases.length} necessidade(s) têm prazo crítico</strong>{dueTodayPurchases.length > 0 ? ` e ${dueTodayPurchases.length} precisam ser decididas hoje.` : '.'} Isso inclui tanto data limite de compra vencida quanto Pedido de Compra cuja entrega prometida já passou.</div>}
    <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground flex gap-2"><TrendingDown className="h-4 w-4 shrink-0" /><span><strong>Planejamento antecipa; fatos físicos confirmam.</strong> OP não movimenta estoque, sugestão de compra não cria recebimento e prazo configurado continua sendo a referência até existir histórico real confiável.</span></div>

    <ResponsiveDialog open={!!selectedNeed} onOpenChange={open => !open && setSelectedNeed(null)} title="Planejar produção">{selectedNeed && <div className="space-y-4 p-4"><p className="text-sm">O sistema criará uma OP se não houver uma ativa para esta identidade. Se já houver, ampliará a mesma OP.</p><div className="rounded-lg bg-muted p-3 text-sm space-y-1"><p className="font-medium">{selectedNeed.product_name}{selectedNeed.variant_name ? ` · ${selectedNeed.variant_name}` : ''}</p><p>Físico: <strong>{selectedNeed.stock_available}</strong> · Comprometido: <strong>{selectedNeed.stock_committed}</strong></p><p>Já programado: <strong>{selectedNeed.production_programmed}</strong> · Adicionar: <strong>{selectedNeed.shortage} {selectedNeed.unit}</strong></p>{selectedNeed.suggested_date && <p>Data sugerida: <strong>{formatDate(selectedNeed.suggested_date)}</strong></p>}</div><div className="space-y-1"><p className="text-xs font-semibold">Pedidos que originam a demanda</p>{selectedNeed.order_demands.map(origin => <div key={origin.order_id} className="flex justify-between rounded border px-2 py-1 text-xs"><span>{origin.reference}</span><span className="font-medium">{origin.quantity} {selectedNeed.unit}</span></div>)}</div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSelectedNeed(null)}>Cancelar</Button><Button disabled={creating} onClick={() => void planProduction()}>{creating ? 'Planejando...' : selectedNeed.production_programmed > 0 ? 'Ampliar OP existente' : 'Confirmar planejamento'}</Button></div></div>}</ResponsiveDialog>

    <ResponsiveDialog open={!!selectedTimingNeed} onOpenChange={open => !open && setSelectedTimingNeed(null)} title="Prazo de reposição">{selectedTimingNeed && <div className="space-y-4 p-4"><div><p className="font-semibold">{selectedTimingNeed.component_name}</p><p className="text-xs text-muted-foreground">Configure uma referência operacional. O histórico real será comparado depois, sem substituir este prazo automaticamente.</p></div><div className="space-y-2"><Label>Fornecedor preferencial</Label><Select value={policySupplierId} onValueChange={setPolicySupplierId}><SelectTrigger><SelectValue placeholder="Selecione o fornecedor" /></SelectTrigger><SelectContent>{suppliers.map(supplier => <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>)}</SelectContent></Select></div><div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Lead time (dias)</Label><Input type="number" min="0" step="1" value={leadTimeDays} onChange={event => setLeadTimeDays(event.target.value)} /></div><div className="space-y-2"><Label>Margem segurança (dias)</Label><Input type="number" min="0" step="1" value={safetyDays} onChange={event => setSafetyDays(event.target.value)} /></div></div>{selectedTimingNeed.required_date && <div className="rounded-lg bg-muted p-3 text-sm"><p>Material necessário em: <strong>{formatDate(selectedTimingNeed.required_date)}</strong></p><p className="text-xs text-muted-foreground mt-1">Após salvar, o Painel recalcula automaticamente a data alvo de chegada e a data limite para comprar.</p></div>}<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSelectedTimingNeed(null)}>Cancelar</Button><Button disabled={savingPolicy} onClick={() => void saveTimingPolicy()}>{savingPolicy ? 'Salvando...' : 'Salvar prazo'}</Button></div></div>}</ResponsiveDialog>
  </div>;
}

function TimingSummary({ need }: { need: MaterialNeed }) {
  if (need.timing_status === 'late_delivery') return <div className="min-w-[160px] text-xs space-y-1"><Badge variant="destructive">Entrega atrasada</Badge><p><strong>{need.late_open_purchase_qty.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {need.unit}</strong> ainda pendentes</p><p className="text-muted-foreground">Previsão era {formatDate(need.next_open_purchase_date)}</p></div>;
  if (need.timing_status === 'not_configured') return <div className="text-xs"><Badge variant="outline">Prazo não configurado</Badge>{need.required_date && <p className="mt-1 text-muted-foreground">Necessário: {formatDate(need.required_date)}</p>}</div>;
  if (need.timing_status === 'no_required_date') return <div className="text-xs"><Badge variant="secondary">Sem data de demanda</Badge><p className="mt-1 text-muted-foreground">{need.preferred_supplier_name} · {need.lead_time_days}d + {need.safety_days}d</p></div>;
  const statusLabel: Partial<Record<PurchaseTimingStatus, string>> = { overdue: 'Comprar atrasado', due_today: 'Comprar hoje', on_time: 'No prazo' };
  return <div className="min-w-[150px] text-xs space-y-1"><Badge variant={need.timing_status === 'overdue' ? 'destructive' : need.timing_status === 'due_today' ? 'secondary' : 'outline'}>{statusLabel[need.timing_status] || 'Prazo'}</Badge><p><Clock3 className="mr-1 inline h-3 w-3" />Comprar até <strong>{formatDate(need.purchase_by_date)}</strong></p><p className="text-muted-foreground">Chegada alvo {formatDate(need.target_arrival_date)} · necessário {formatDate(need.required_date)}</p><p className="text-muted-foreground">{need.preferred_supplier_name || 'Fornecedor'} · {need.lead_time_days}d + {need.safety_days}d segurança</p></div>;
}
function Num({ value, unit, danger = false }: { value: number; unit: string; danger?: boolean }) { return <TableCell className={cn('text-right font-mono whitespace-nowrap', danger && 'font-semibold text-red-500')}>{Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {unit}</TableCell>; }
function Mini({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) { return <div className="rounded-lg bg-muted/60 p-2"><p className={cn('text-lg font-bold', danger && 'text-amber-600')}>{Number(value).toLocaleString('pt-BR')}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="py-8 text-center px-4"><Check className="mx-auto mb-2 h-10 w-10 text-green-500" /><p className="text-sm text-muted-foreground">{text}</p></div>; }
