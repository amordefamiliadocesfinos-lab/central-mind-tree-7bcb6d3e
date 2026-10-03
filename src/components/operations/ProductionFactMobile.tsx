import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Factory, ImageOff, Loader2, PackageCheck } from 'lucide-react';
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
type Process = { id: string; name: string; value_per_unit: number | string; is_active: boolean };
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
    invalid_operator: 'Não foi possível identificar o operador atual.',
    production_order_not_found: 'A OP relacionada não foi encontrada.',
    production_order_cancelled: 'A OP relacionada está cancelada.',
    production_order_legacy_mode: 'Esta OP ainda usa o fluxo legado de conclusão.',
    production_order_item_mismatch: 'O produto selecionado não pertence à OP relacionada.',
    invalid_quantity: 'Informe uma quantidade maior que zero.',
  };
  return messages[result.reason || ''] || 'Não foi possível registrar a produção.';
}

function processFamily(productName: string) {
  const upper = productName.toUpperCase();
  if (upper.includes('ALFAJOR')) return 'ALFAJOR';
  if (upper.includes('TRUFA')) return 'TRUFA';
  return null;
}

export function ProductionFactMobile({ products }: Props) {
  const [step, setStep] = useState<Step>('product');
  const [product, setProduct] = useState<Product | null>(null);
  const [variant, setVariant] = useState<ProductVariant | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [quantity, setQuantity] = useState('');
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [operators, setOperators] = useState<AppUser[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [operator, setOperator] = useState<AppUser | null>(null);
  const [process, setProcess] = useState<Process | null>(null);
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
      const [{ data: authData }, usersRes, processesRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('app_users').select('id,name').eq('is_active', true).order('name'),
        supabase.from('processes').select('id,name,value_per_unit,is_active').eq('is_active', true).order('name'),
      ]);
      if (!mounted) return;

      const userList = (usersRes.data || []) as AppUser[];
      const processList = (processesRes.data || []) as Process[];
      setOperators(userList);
      setProcesses(processList);

      const authUserId = authData.user?.id;
      if (authUserId) {
        const { data } = await supabase
          .from('app_users')
          .select('id,name')
          .eq('auth_user_id', authUserId)
          .eq('is_active', true)
          .maybeSingle();
        if (mounted && data) setOperator(data as AppUser);
      }

      if (!authUserId && typeof window !== 'undefined') {
        const lastOperatorId = window.localStorage.getItem('production:last-operator');
        const last = userList.find((item) => item.id === lastOperatorId);
        if (last) setOperator(last);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const clearAttempt = () => {
    pendingEventKey.current = null;
    setResult(null);
    setProcessWarning(false);
  };

  const selectDefaultProcess = (selected: Product) => {
    if (typeof window !== 'undefined') {
      const storedId = window.localStorage.getItem(`production:last-process:${selected.id}`);
      const stored = processes.find((item) => item.id === storedId);
      if (stored) {
        setProcess(stored);
        return;
      }
    }
    const family = processFamily(selected.name);
    const familyMatch = family ? processes.find((item) => item.name.toUpperCase().includes(family)) : null;
    setProcess(familyMatch || null);
  };

  const reset = () => {
    setStep('product');
    setProduct(null);
    setVariant(null);
    setVariants([]);
    setQuantity('');
    setProcess(null);
    clearAttempt();
  };

  const chooseProduct = async (selected: Product) => {
    setProduct(selected);
    setVariant(null);
    setQuantity('');
    selectDefaultProcess(selected);
    clearAttempt();

    if (selected.variation_mode !== 'variacoes_fisicas') {
      setVariants([]);
      setStep('quantity');
      return;
    }

    setStep('variant');
    setLoadingVariants(true);
    const { data, error } = await supabase
      .from('product_variants')
      .select('id,product_id,sku,variant_name,is_active')
      .eq('product_id', selected.id)
      .eq('is_active', true)
      .order('variant_name');
    setLoadingVariants(false);

    if (error) {
      toast.error('Não foi possível carregar os sabores/variantes.');
      return;
    }

    const list = (data || []) as ProductVariant[];
    setVariants(list);
    if (list.length === 1) {
      setVariant(list[0]);
      setStep('quantity');
    }
  };

  const parsedQuantity = Number(quantity.replace(',', '.'));
  const validQuantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0;
  const canContinue = validQuantity && !!operator && !!process;

  const back = () => {
    clearAttempt();
    if (step === 'confirm') return setStep('quantity');
    if (step === 'quantity' && product?.variation_mode === 'variacoes_fisicas' && variants.length > 1) {
      setVariant(null);
      return setStep('variant');
    }
    setProduct(null);
    setVariant(null);
    setVariants([]);
    setProcess(null);
    setStep('product');
  };

  const prepareConfirmation = () => {
    clearAttempt();
    pendingEventKey.current = `production_fact:${crypto.randomUUID()}`;
    setStep('confirm');
  };

  const confirm = async () => {
    if (!product || !canContinue || submitting || !operator || !process) return;
    if (product.variation_mode === 'variacoes_fisicas' && !variant) return;

    if (!pendingEventKey.current) pendingEventKey.current = `production_fact:${crypto.randomUUID()}`;
    setSubmitting(true);

    const { data, error } = await (supabase as any).rpc('register_production_fact', {
      p_product_id: product.id,
      p_variant_id: variant?.id ?? null,
      p_quantity: parsedQuantity,
      p_event_key: pendingEventKey.current,
      p_location: 'Fábrica',
      p_operator_user_id: operator.id,
      p_operator_name: operator.name,
      p_production_order_id: null,
      p_occurred_at: new Date().toISOString(),
    });

    if (error) {
      setSubmitting(false);
      console.error('Erro ao registrar fato real de produção:', error);
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

    const { data: processData, error: processError } = await (supabase as any).rpc('attach_production_fact_process', {
      p_production_fact_id: rpcResult.production_fact_id,
      p_process_id: process.id,
      p_operator_user_id: operator.id,
      p_operator_name: operator.name,
    });
    setSubmitting(false);

    if (processError || !processData?.success) {
      console.error('Produção registrada, mas processo não vinculado:', processError || processData);
      setProcessWarning(true);
      toast.warning('Produção registrada, mas o processo precisa ser revisado.');
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('production:last-operator', operator.id);
      window.localStorage.setItem(`production:last-process:${product.id}`, process.id);
    }

    notifyInventoryChanged();
    setStep('success');
  };

  const title = product?.name || '';
  const variantTitle = variant?.variant_name || '';

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-6">
      {step !== 'product' && step !== 'success' && (
        <Button variant="ghost" onClick={back} className="h-11 px-2 text-base"><ArrowLeft className="mr-2 h-5 w-5" />Voltar</Button>
      )}

      {step === 'product' && (
        <div className="space-y-4">
          <div><h2 className="text-2xl font-bold">O que você produziu?</h2><p className="text-sm text-muted-foreground">Toque no produto. Não precisa escolher OP.</p></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {manufactured.map((item) => (
              <button key={item.id} type="button" onClick={() => chooseProduct(item)} className="overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition active:scale-[0.98] hover:border-primary/50">
                <div className="aspect-square bg-muted">{item.cover_image_url ? <img src={item.cover_image_url} alt={item.name} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center text-muted-foreground"><ImageOff className="h-10 w-10" /></div>}</div>
                <div className="p-3 text-base font-semibold leading-tight">{item.name}</div>
              </button>
            ))}
          </div>
          {manufactured.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum produto fabricado ativo foi encontrado.</CardContent></Card>}
        </div>
      )}

      {step === 'variant' && (
        <div className="space-y-4">
          <div><p className="text-sm text-muted-foreground">{title}</p><h2 className="text-2xl font-bold">Qual sabor/variante?</h2></div>
          {loadingVariants ? <div className="flex min-h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{variants.map((item) => <button key={item.id} type="button" onClick={() => { setVariant(item); clearAttempt(); setStep('quantity'); }} className="min-h-24 rounded-2xl border bg-card p-4 text-left text-lg font-semibold shadow-sm active:scale-[0.98]">{item.variant_name}</button>)}</div>}
          {!loadingVariants && variants.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma variante ativa encontrada.</CardContent></Card>}
        </div>
      )}

      {step === 'quantity' && (
        <div className="space-y-5">
          <div><p className="text-sm text-muted-foreground">{title}{variantTitle ? ` · ${variantTitle}` : ''}</p><h2 className="text-2xl font-bold">Quantas unidades ficaram prontas?</h2></div>
          <Card><CardContent className="space-y-5 p-5">
            <Input inputMode="decimal" value={quantity} onChange={(e) => { setQuantity(e.target.value.replace(/[^0-9.,]/g, '')); clearAttempt(); }} placeholder="0" className="h-20 text-center text-4xl font-bold" autoFocus />
            <div className="grid grid-cols-4 gap-2">{QUICK_AMOUNTS.map((amount) => <Button key={amount} type="button" variant="outline" className="h-14 text-base font-semibold" onClick={() => { setQuantity(String((Number(quantity) || 0) + amount)); clearAttempt(); }}>+{amount}</Button>)}</div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><Label>Operador</Label><Select value={operator?.id || ''} onValueChange={(id) => { setOperator(operators.find((item) => item.id === id) || null); clearAttempt(); }}><SelectTrigger className="mt-1 h-12"><SelectValue placeholder="Selecionar operador" /></SelectTrigger><SelectContent>{operators.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Processo</Label><Select value={process?.id || ''} onValueChange={(id) => { setProcess(processes.find((item) => item.id === id) || null); clearAttempt(); }}><SelectTrigger className="mt-1 h-12"><SelectValue placeholder="Selecionar processo" /></SelectTrigger><SelectContent>{processes.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            </div>

            <Button className="h-16 w-full text-lg font-bold" disabled={!canContinue} onClick={prepareConfirmation}>Continuar</Button>
          </CardContent></Card>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-5">
          <div><h2 className="text-2xl font-bold">Confirmar produção</h2><p className="text-sm text-muted-foreground">Confira os dados antes de registrar.</p></div>
          <Card><CardHeader className="bg-muted/40 pb-3"><CardTitle className="flex items-center gap-2"><Factory className="h-5 w-5" />Produção pronta</CardTitle></CardHeader><CardContent className="space-y-3 p-5">
            <div><p className="text-sm text-muted-foreground">Produto</p><p className="text-xl font-semibold">{title}{variantTitle ? ` · ${variantTitle}` : ''}</p></div>
            <div><p className="text-sm text-muted-foreground">Quantidade</p><p className="text-4xl font-bold">{parsedQuantity}</p></div>
            <div className="grid grid-cols-2 gap-3 text-sm"><div><span className="text-muted-foreground">Operador</span><p className="font-medium">{operator?.name}</p></div><div><span className="text-muted-foreground">Processo</span><p className="font-medium">{process?.name}</p></div></div>
            <p className="text-xs text-muted-foreground">Destino padrão: Fábrica</p>
          </CardContent></Card>
          <Button className="h-20 w-full text-xl font-bold" disabled={submitting} onClick={confirm}>{submitting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <PackageCheck className="mr-2 h-6 w-6" />}{submitting ? 'Registrando...' : 'CONFIRMAR PRODUÇÃO'}</Button>
        </div>
      )}

      {step === 'success' && (
        <Card className={result?.material_adjustment_required ? 'border-amber-500/40' : 'border-emerald-500/30'}><CardContent className="flex min-h-[420px] flex-col items-center justify-center gap-5 p-6 text-center">
          <div className={result?.material_adjustment_required ? 'flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10' : 'flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10'}>{result?.material_adjustment_required ? <AlertTriangle className="h-12 w-12 text-amber-600" /> : <CheckCircle2 className="h-12 w-12 text-emerald-600" />}</div>
          <div><h2 className="text-3xl font-bold">Produção registrada</h2><p className="mt-2 text-lg text-muted-foreground">{parsedQuantity} {title}{variantTitle ? ` · ${variantTitle}` : ''}</p><p className="mt-1 text-sm text-muted-foreground">{operator?.name} · {process?.name}</p></div>
          {result?.material_adjustment_required && <div className="w-full max-w-md rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-left"><p className="font-semibold text-amber-700">Ajuste de material pendente</p><p className="mt-1 text-sm text-muted-foreground">O produto acabado já entrou normalmente no estoque. O consumo que faltou ficou na fila Ajustes para o gestor regularizar depois.</p>{result.shortages?.map((s, i) => <p key={i} className="mt-2 text-sm">{s.component_name}{s.component_variant_name ? ` · ${s.component_variant_name}` : ''}: falta {s.missing_quantity ?? 0} {s.unit || ''}</p>)}</div>}
          {processWarning && <div className="w-full max-w-md rounded-xl border border-amber-500/30 p-3 text-sm">A produção foi registrada, mas o vínculo de processo precisa ser revisado.</div>}
          <Button className="h-16 w-full max-w-sm text-lg font-bold" onClick={reset}>Lançar outra produção</Button>
        </CardContent></Card>
      )}
    </div>
  );
}
