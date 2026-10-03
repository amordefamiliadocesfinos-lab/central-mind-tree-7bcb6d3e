import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Factory, ImageOff, Loader2, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { notifyInventoryChanged } from '@/hooks/useInventorySync';
import type { Product } from '@/hooks/useOrders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type ProductVariant = { id: string; product_id: string; sku: string; variant_name: string; is_active: boolean };
type AppUser = { id: string; name: string };
type Step = 'product' | 'variant' | 'quantity' | 'confirm' | 'success';
type Shortage = {
  component_name?: string;
  component_variant_name?: string | null;
  required_quantity?: number;
  available_quantity?: number;
  missing_quantity?: number;
  unit?: string | null;
};
type ProductionFactResult = {
  success?: boolean;
  reason?: string;
  already_processed?: boolean;
  production_fact_id?: string;
  production_order_id?: string | null;
  quantity?: number;
  location?: string;
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
    insufficient_stock: 'Não há matéria-prima suficiente para confirmar esta produção.',
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
  const [submitting, setSubmitting] = useState(false);
  const [operator, setOperator] = useState<AppUser | null>(null);
  const [result, setResult] = useState<ProductionFactResult | null>(null);
  const pendingEventKey = useRef<string | null>(null);

  const manufactured = useMemo(
    () => products.filter((p) => p.is_active && p.is_manufactured).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [products],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user?.id) return;
      const { data } = await supabase
        .from('app_users')
        .select('id,name')
        .eq('auth_user_id', authData.user.id)
        .eq('is_active', true)
        .maybeSingle();
      if (mounted && data) setOperator(data as AppUser);
    })();
    return () => { mounted = false; };
  }, []);

  const clearAttempt = () => {
    pendingEventKey.current = null;
    setResult(null);
  };

  const reset = () => {
    setStep('product');
    setProduct(null);
    setVariant(null);
    setVariants([]);
    setQuantity('');
    clearAttempt();
  };

  const chooseProduct = async (selected: Product) => {
    setProduct(selected);
    setVariant(null);
    setQuantity('');
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
    setStep('product');
  };

  const prepareConfirmation = () => {
    clearAttempt();
    pendingEventKey.current = `production_fact:${crypto.randomUUID()}`;
    setStep('confirm');
  };

  const confirm = async () => {
    if (!product || !validQuantity || submitting) return;
    if (product.variation_mode === 'variacoes_fisicas' && !variant) return;

    if (!pendingEventKey.current) pendingEventKey.current = `production_fact:${crypto.randomUUID()}`;
    setSubmitting(true);

    const { data, error } = await (supabase as any).rpc('register_production_fact', {
      p_product_id: product.id,
      p_variant_id: variant?.id ?? null,
      p_quantity: parsedQuantity,
      p_event_key: pendingEventKey.current,
      p_location: 'Fábrica',
      p_operator_user_id: operator?.id ?? null,
      p_operator_name: operator?.name ?? null,
      p_production_order_id: null,
      p_occurred_at: new Date().toISOString(),
    });
    setSubmitting(false);

    if (error) {
      console.error('Erro ao registrar fato real de produção:', error);
      toast.error('Falha de comunicação. Toque em confirmar novamente para verificar a mesma operação.');
      return;
    }

    const rpcResult = (data || {}) as ProductionFactResult;
    setResult(rpcResult);
    if (!rpcResult.success) {
      toast.error(errorMessage(rpcResult));
      return;
    }

    notifyInventoryChanged();
    setStep('success');
  };

  const title = product?.name || '';
  const variantTitle = variant?.variant_name || '';

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-6">
      {step !== 'product' && step !== 'success' && (
        <Button variant="ghost" onClick={back} className="h-11 px-2 text-base">
          <ArrowLeft className="mr-2 h-5 w-5" /> Voltar
        </Button>
      )}

      {step === 'product' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold">O que você produziu?</h2>
            <p className="text-sm text-muted-foreground">Toque no produto. Não precisa escolher OP.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {manufactured.map((item) => (
              <button key={item.id} type="button" onClick={() => chooseProduct(item)} className="overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition active:scale-[0.98] hover:border-primary/50">
                <div className="aspect-square bg-muted">
                  {item.cover_image_url ? <img src={item.cover_image_url} alt={item.name} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center text-muted-foreground"><ImageOff className="h-10 w-10" /></div>}
                </div>
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
          {loadingVariants ? <div className="flex min-h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {variants.map((item) => <button key={item.id} type="button" onClick={() => { setVariant(item); clearAttempt(); setStep('quantity'); }} className="min-h-24 rounded-2xl border bg-card p-4 text-left text-lg font-semibold shadow-sm active:scale-[0.98]">{item.variant_name}</button>)}
            </div>
          )}
          {!loadingVariants && variants.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma variante ativa encontrada.</CardContent></Card>}
        </div>
      )}

      {step === 'quantity' && (
        <div className="space-y-5">
          <div><p className="text-sm text-muted-foreground">{title}{variantTitle ? ` · ${variantTitle}` : ''}</p><h2 className="text-2xl font-bold">Quantas unidades ficaram prontas?</h2></div>
          <Card><CardContent className="space-y-5 p-5">
            <Input inputMode="decimal" value={quantity} onChange={(e) => { setQuantity(e.target.value.replace(/[^0-9.,]/g, '')); clearAttempt(); }} placeholder="0" className="h-20 text-center text-4xl font-bold" autoFocus />
            <div className="grid grid-cols-4 gap-2">{QUICK_AMOUNTS.map((amount) => <Button key={amount} type="button" variant="outline" className="h-14 text-base font-semibold" onClick={() => { setQuantity(String((Number(quantity) || 0) + amount)); clearAttempt(); }}>+{amount}</Button>)}</div>
            <Button className="h-16 w-full text-lg font-bold" disabled={!validQuantity} onClick={prepareConfirmation}>Continuar</Button>
          </CardContent></Card>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-5">
          <div><h2 className="text-2xl font-bold">Confirmar produção</h2><p className="text-sm text-muted-foreground">Confira os dados antes de registrar.</p></div>
          <Card>
            <CardHeader className="bg-muted/40 pb-3"><CardTitle className="flex items-center gap-2"><Factory className="h-5 w-5" /> Produção pronta</CardTitle></CardHeader>
            <CardContent className="space-y-4 p-5">
              <div><p className="text-sm text-muted-foreground">Produto</p><p className="text-xl font-semibold">{title}</p></div>
              {variantTitle && <div><p className="text-sm text-muted-foreground">Sabor/variante</p><p className="text-xl font-semibold">{variantTitle}</p></div>}
              <div><p className="text-sm text-muted-foreground">Quantidade</p><p className="text-4xl font-bold">{parsedQuantity}</p></div>
              <p className="text-xs text-muted-foreground">Destino padrão: Fábrica</p>
            </CardContent>
          </Card>
          {result?.reason === 'insufficient_stock' && result.shortages?.length ? <Card className="border-destructive/40"><CardContent className="space-y-2 p-4"><p className="font-semibold text-destructive">Falta de material</p>{result.shortages.map((s, i) => <div key={i} className="text-sm"><span className="font-medium">{s.component_name}{s.component_variant_name ? ` · ${s.component_variant_name}` : ''}</span><p className="text-muted-foreground">Necessário {s.required_quantity ?? 0} · disponível {s.available_quantity ?? 0} · falta {s.missing_quantity ?? 0} {s.unit || ''}</p></div>)}</CardContent></Card> : result && !result.success ? <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{errorMessage(result)}</div> : null}
          <Button className="h-20 w-full text-xl font-bold" disabled={submitting} onClick={confirm}>{submitting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <PackageCheck className="mr-2 h-6 w-6" />}{submitting ? 'Registrando...' : 'CONFIRMAR PRODUÇÃO'}</Button>
        </div>
      )}

      {step === 'success' && (
        <Card className="border-emerald-500/30"><CardContent className="flex min-h-[420px] flex-col items-center justify-center gap-5 p-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10"><CheckCircle2 className="h-12 w-12 text-emerald-600" /></div>
          <div><h2 className="text-3xl font-bold">Produção registrada</h2><p className="mt-2 text-lg text-muted-foreground">{parsedQuantity} {title}{variantTitle ? ` · ${variantTitle}` : ''}</p></div>
          <Button className="h-16 w-full max-w-sm text-lg font-bold" onClick={reset}>Lançar outra produção</Button>
        </CardContent></Card>
      )}
    </div>
  );
}
