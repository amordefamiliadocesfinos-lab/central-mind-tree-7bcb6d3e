import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Factory, ImageOff, Loader2, PackageCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { notifyInventoryChanged } from '@/hooks/useInventorySync';
import type { Product } from '@/hooks/useOrders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ProductVariant = { id: string; product_id: string; sku: string; variant_name: string; is_active: boolean };
type AppUser = { id: string; name: string };
type RoutedProcess = { id: string; name: string; value_per_unit: number | string; sort_order: number };
type Step = 'product' | 'variant' | 'quantity' | 'confirm' | 'success';
type Shortage = { component_name?: string; component_variant_name?: string | null; required_quantity?: number; applied_quantity?: number; missing_quantity?: number; unit?: string | null };
type ProductionFactResult = {
  success?: boolean;
  reason?: string;
  already_processed?: boolean;
  production_fact_id?: string;
  production_order_id?: string | null;
  quantity?: number;
  location?: string;
  material_adjustment_required?: boolean;
  shortages?: Shortage[];
};

interface Props { products: Product[] }
const QUICK_AMOUNTS = [30, 60, 120, 300];

function errorMessage(result: ProductionFactResult) {
  const messages: Record<string, string> = {
    missing_bom: 'Este produto ainda não possui uma composição de produção válida.',
    invalid_location: 'O local padrão de produção não está disponível.',
    production_order_not_found: 'A OP relacionada não foi encontrada.',
    production_order_cancelled: 'A OP relacionada está cancelada.',
    production_order_legacy_mode: 'Esta OP ainda usa o fluxo legado de conclusão.',
    production_order_item_mismatch: 'O produto selecionado não pertence à OP relacionada.',
    invalid_quantity: 'Informe uma quantidade maior que zero.',
  };
  return messages[result.reason || ''] || 'Não foi possível registrar a produção.';
}

export function ProductionFactMobile({ products }: Props) {
  const [step, setStep] = useState<Step>('product');
  const [product, setProduct] = useState<Product | null>(null);
  const [variant, setVariant] = useState<ProductVariant | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [quantity, setQuantity] = useState('');
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [loadingProcesses, setLoadingProcesses] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [operators, setOperators] = useState<AppUser[]>([]);
  const [currentOperator, setCurrentOperator] = useState<AppUser | null>(null);
  const [routedProcesses, setRoutedProcesses] = useState<RoutedProcess[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ProductionFactResult | null>(null);
  const [processWarning, setProcessWarning] = useState(false);
  const pendingEventKey = useRef<string | null>(null);

  const manufactured = useMemo(
    () => products.filter((p) => p.is_active && p.is_manufactured).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [products],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [{ data: authData }, usersRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('app_users').select('id,name').eq('is_active', true).order('name'),
      ]);
      if (!mounted) return;
      const userList = (usersRes.data || []) as AppUser[];
      setOperators(userList);

      if (authData.user?.id) {
        const { data } = await supabase.from('app_users').select('id,name')
          .eq('auth_user_id', authData.user.id).eq('is_active', true).maybeSingle();
        if (mounted && data) setCurrentOperator(data as AppUser);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const clearAttempt = () => {
    pendingEventKey.current = null;
    setResult(null);
    setProcessWarning(false);
  };

  const loadProcesses = async (selectedProduct: Product, selectedVariant: ProductVariant | null) => {
    setLoadingProcesses(true);
    const baseQuery = () => (supabase as any).from('product_processes')
      .select('process_id,sort_order,process:processes(id,name,value_per_unit,is_active)')
      .eq('product_id', selectedProduct.id)
      .eq('is_active', true)
      .order('sort_order');

    let rows: any[] = [];
    if (selectedVariant) {
      const specific = await baseQuery().eq('variant_id', selectedVariant.id);
      if (!specific.error && specific.data?.length) rows = specific.data;
    }
    if (rows.length === 0) {
      const generic = await baseQuery().is('variant_id', null);
      if (generic.error) {
        setLoadingProcesses(false);
        toast.error('Não foi possível carregar os processos deste produto.');
        return;
      }
      rows = generic.data || [];
    }

    const mapped: RoutedProcess[] = rows
      .map((row: any) => ({
        id: row.process?.id || row.process_id,
        name: row.process?.name || 'Processo',
        value_per_unit: row.process?.value_per_unit || 0,
        sort_order: row.sort_order || 0,
      }))
      .filter((item) => item.id);

    const nextAssignments: Record<string, string> = {};
    mapped.forEach((proc) => {
      const stored = typeof window !== 'undefined'
        ? window.localStorage.getItem(`production:last-operator:${selectedProduct.id}:${proc.id}`)
        : null;
      if (stored && operators.some((operator) => operator.id === stored)) nextAssignments[proc.id] = stored;
      else if (currentOperator) nextAssignments[proc.id] = currentOperator.id;
    });

    setRoutedProcesses(mapped);
    setAssignments(nextAssignments);
    setLoadingProcesses(false);
  };

  const reset = () => {
    setStep('product');
    setProduct(null);
    setVariant(null);
    setVariants([]);
    setQuantity('');
    setRoutedProcesses([]);
    setAssignments({});
    clearAttempt();
  };

  const chooseProduct = async (selected: Product) => {
    setProduct(selected);
    setVariant(null);
    setQuantity('');
    setRoutedProcesses([]);
    setAssignments({});
    clearAttempt();

    if (selected.variation_mode !== 'variacoes_fisicas') {
      setVariants([]);
      await loadProcesses(selected, null);
      setStep('quantity');
      return;
    }

    setStep('variant');
    setLoadingVariants(true);
    const { data, error } = await supabase.from('product_variants')
      .select('id,product_id,sku,variant_name,is_active')
      .eq('product_id', selected.id).eq('is_active', true).order('variant_name');
    setLoadingVariants(false);
    if (error) {
      toast.error('Não foi possível carregar os sabores/variantes.');
      return;
    }
    const list = (data || []) as ProductVariant[];
    setVariants(list);
    if (list.length === 1) {
      setVariant(list[0]);
      await loadProcesses(selected, list[0]);
      setStep('quantity');
    }
  };

  const chooseVariant = async (selected: ProductVariant) => {
    if (!product) return;
    setVariant(selected);
    clearAttempt();
    await loadProcesses(product, selected);
    setStep('quantity');
  };

  const parsedQuantity = Number(quantity.replace(',', '.'));
  const validQuantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0;
  const allProcessesAssigned = routedProcesses.length > 0 && routedProcesses.every((proc) => !!assignments[proc.id]);
  const canContinue = validQuantity && !loadingProcesses && allProcessesAssigned;

  const back = () => {
    clearAttempt();
    if (step === 'confirm') return setStep('quantity');
    if (step === 'quantity' && product?.variation_mode === 'variacoes_fisicas' && variants.length > 1) {
      setRoutedProcesses([]);
      setAssignments({});
      setVariant(null);
      return setStep('variant');
    }
    setProduct(null);
    setVariant(null);
    setVariants([]);
    setRoutedProcesses([]);
    setAssignments({});
    setStep('product');
  };

  const prepareConfirmation = () => {
    clearAttempt();
    pendingEventKey.current = `production_fact:${crypto.randomUUID()}`;
    setStep('confirm');
  };

  const confirm = async () => {
    if (!product || !canContinue || submitting) return;
    if (product.variation_mode === 'variacoes_fisicas' && !variant) return;
    if (!pendingEventKey.current) pendingEventKey.current = `production_fact:${crypto.randomUUID()}`;
    setSubmitting(true);

    const { data, error } = await (supabase as any).rpc('register_production_fact', {
      p_product_id: product.id,
      p_variant_id: variant?.id ?? null,
      p_quantity: parsedQuantity,
      p_event_key: pendingEventKey.current,
      p_location: 'Fábrica',
      p_operator_user_id: null,
      p_operator_name: null,
      p_production_order_id: null,
      p_occurred_at: new Date().toISOString(),
    });

    if (error) {
      setSubmitting(false);
      console.error(error);
      toast.error('Falha de comunicação. Toque em confirmar novamente para verificar a mesma operação.');
      return;
    }

    const rpcResult = (data || {}) as ProductionFactResult;
    setResult(rpcResult);
    if (!rpcResult.success || !rpcResult.production_fact_id) {
      setSubmitting(false);
      toast.error(errorMessage(rpcResult));
      return;
    }

    const attachments = await Promise.all(routedProcesses.map(async (proc) => {
      const operatorId = assignments[proc.id];
      const operator = operators.find((item) => item.id === operatorId);
      if (!operator) return { ok: false, proc };
      const { data: attached, error: attachError } = await (supabase as any).rpc('attach_production_fact_process', {
        p_production_fact_id: rpcResult.production_fact_id,
        p_process_id: proc.id,
        p_operator_user_id: operator.id,
        p_operator_name: operator.name,
      });
      if (!attachError && attached?.success && typeof window !== 'undefined') {
        window.localStorage.setItem(`production:last-operator:${product.id}:${proc.id}`, operator.id);
      }
      return { ok: !attachError && !!attached?.success, proc };
    }));

    setSubmitting(false);
    const failed = attachments.filter((item) => !item.ok);
    if (failed.length) {
      setProcessWarning(true);
      toast.warning('Produção registrada, mas alguns processos precisam ser revisados.');
    }

    notifyInventoryChanged();
    setStep('success');
  };

  const title = product?.name || '';
  const variantTitle = variant?.variant_name || '';

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-6">
      {step !== 'product' && step !== 'success' && <Button variant="ghost" onClick={back} className="h-11 px-2 text-base"><ArrowLeft className="mr-2 h-5 w-5" />Voltar</Button>}

      {step === 'product' && <div className="space-y-4">
        <div><h2 className="text-2xl font-bold">O que você produziu?</h2><p className="text-sm text-muted-foreground">Toque no produto. Não precisa escolher OP.</p></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{manufactured.map((item) => <button key={item.id} type="button" onClick={() => chooseProduct(item)} className="overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition active:scale-[0.98] hover:border-primary/50"><div className="aspect-square bg-muted">{item.cover_image_url ? <img src={item.cover_image_url} alt={item.name} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center text-muted-foreground"><ImageOff className="h-10 w-10" /></div>}</div><div className="p-3 text-base font-semibold leading-tight">{item.name}</div></button>)}</div>
      </div>}

      {step === 'variant' && <div className="space-y-4">
        <div><p className="text-sm text-muted-foreground">{title}</p><h2 className="text-2xl font-bold">Qual sabor/variante?</h2></div>
        {loadingVariants ? <div className="flex min-h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{variants.map((item) => <button key={item.id} type="button" onClick={() => chooseVariant(item)} className="min-h-24 rounded-2xl border bg-card p-4 text-left text-lg font-semibold shadow-sm active:scale-[0.98]">{item.variant_name}</button>)}</div>}
      </div>}

      {step === 'quantity' && <div className="space-y-5">
        <div><p className="text-sm text-muted-foreground">{title}{variantTitle ? ` · ${variantTitle}` : ''}</p><h2 className="text-2xl font-bold">Quantas unidades ficaram prontas?</h2></div>
        <Card><CardContent className="space-y-5 p-5">
          <Input inputMode="decimal" value={quantity} onChange={(e) => { setQuantity(e.target.value.replace(/[^0-9.,]/g, '')); clearAttempt(); }} placeholder="0" className="h-20 text-center text-4xl font-bold" autoFocus />
          <div className="grid grid-cols-4 gap-2">{QUICK_AMOUNTS.map((amount) => <Button key={amount} type="button" variant="outline" className="h-14 text-base font-semibold" onClick={() => { setQuantity(String((Number(quantity) || 0) + amount)); clearAttempt(); }}>+{amount}</Button>)}</div>

          <div className="space-y-3">
            <div className="flex items-center gap-2"><Users className="h-5 w-5" /><div><p className="font-semibold">Quem fez cada processo?</p><p className="text-xs text-muted-foreground">Os processos já vêm definidos pelo produto. Só ajuste o operador quando necessário.</p></div></div>
            {loadingProcesses ? <div className="flex h-20 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div> : routedProcesses.length === 0 ? (
              <div className="rounded-xl border border-amber-400/40 bg-amber-50 p-4 text-sm text-amber-800"><div className="flex gap-2"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Processos ainda não configurados para este produto.</p><p>O gestor deve vinculá-los uma vez em Produção → Processos.</p></div></div></div>
            ) : routedProcesses.map((proc, index) => (
              <div key={proc.id} className="rounded-xl border p-3">
                <div className="mb-2 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold">{index + 1}</span><span className="font-semibold">{proc.name}</span></div>
                <Label className="text-xs text-muted-foreground">Operador</Label>
                <Select value={assignments[proc.id] || ''} onValueChange={(operatorId) => { setAssignments((current) => ({ ...current, [proc.id]: operatorId })); clearAttempt(); }}>
                  <SelectTrigger className="mt-1 h-12"><SelectValue placeholder="Selecionar operador" /></SelectTrigger>
                  <SelectContent>{operators.map((operator) => <SelectItem key={operator.id} value={operator.id}>{operator.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <Button className="h-16 w-full text-lg font-bold" disabled={!canContinue} onClick={prepareConfirmation}>Continuar</Button>
        </CardContent></Card>
      </div>}

      {step === 'confirm' && <div className="space-y-5">
        <div><h2 className="text-2xl font-bold">Confirmar produção</h2><p className="text-sm text-muted-foreground">Produto, quantidade e responsáveis pelos processos.</p></div>
        <Card><CardHeader className="bg-muted/40 pb-3"><CardTitle className="flex items-center gap-2"><Factory className="h-5 w-5" />Produção pronta</CardTitle></CardHeader><CardContent className="space-y-4 p-5">
          <div><p className="text-sm text-muted-foreground">Produto</p><p className="text-xl font-semibold">{title}{variantTitle ? ` · ${variantTitle}` : ''}</p></div>
          <div><p className="text-sm text-muted-foreground">Quantidade</p><p className="text-4xl font-bold">{parsedQuantity}</p></div>
          <div className="space-y-2 border-t pt-3">{routedProcesses.map((proc) => { const operator = operators.find((item) => item.id === assignments[proc.id]); return <div key={proc.id} className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">{proc.name}</span><span className="font-medium text-right">{operator?.name || '—'}</span></div>; })}</div>
        </CardContent></Card>
        <Button className="h-20 w-full text-xl font-bold" disabled={submitting} onClick={confirm}>{submitting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <PackageCheck className="mr-2 h-6 w-6" />}{submitting ? 'Registrando...' : 'CONFIRMAR PRODUÇÃO'}</Button>
      </div>}

      {step === 'success' && <Card className="border-emerald-500/30"><CardContent className="flex min-h-[420px] flex-col items-center justify-center gap-5 p-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10"><CheckCircle2 className="h-12 w-12 text-emerald-600" /></div>
        <div><h2 className="text-3xl font-bold">Produção registrada</h2><p className="mt-2 text-lg text-muted-foreground">{parsedQuantity} {title}{variantTitle ? ` · ${variantTitle}` : ''}</p><p className="mt-1 text-sm text-muted-foreground">{routedProcesses.length} processo(s) apontado(s)</p></div>
        {result?.material_adjustment_required && <div className="w-full max-w-md rounded-xl border border-amber-400/40 bg-amber-50 p-4 text-sm text-amber-800"><div className="flex gap-2 text-left"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Produção registrada com ajuste de material pendente.</p><p>O gestor poderá regularizar depois em Ajustes.</p></div></div></div>}
        {processWarning && <div className="w-full max-w-md rounded-xl border border-amber-400/40 p-4 text-sm text-amber-800">Produção física registrada, mas algum apontamento de processo precisa ser revisado.</div>}
        <Button className="h-16 w-full max-w-sm text-lg font-bold" onClick={reset}>Lançar outra produção</Button>
      </CardContent></Card>}
    </div>
  );
}
