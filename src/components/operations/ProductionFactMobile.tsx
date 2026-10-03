import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Loader2,
  PackageCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { notifyInventoryChanged } from '@/hooks/useInventorySync';
import type { Product } from '@/hooks/useOrders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ProductVariant = {
  id: string;
  product_id: string;
  sku: string;
  variant_name: string;
  is_active: boolean;
};

type AppUser = { id: string; name: string };
type RoutedProcess = { id: string; name: string; value_per_unit: number | string; sort_order: number };
type Screen = 'product' | 'variant' | 'quantity' | 'process' | 'confirm' | 'success';
type ProductionFactResult = {
  success?: boolean;
  reason?: string;
  production_fact_id?: string;
  material_adjustment_required?: boolean;
};

interface Props {
  products: Product[];
  onExit?: () => void;
}

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

export function ProductionFactMobile({ products, onExit }: Props) {
  const [screen, setScreen] = useState<Screen>('product');
  const [productCursor, setProductCursor] = useState(0);
  const [variantCursor, setVariantCursor] = useState(0);
  const [processIndex, setProcessIndex] = useState(0);
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
    () => products
      .filter((item) => item.is_active && item.is_manufactured)
      .sort((a, b) => {
        const rank = (name: string) => {
          const upper = name.toUpperCase();
          if (upper.includes('ALFAJOR')) return 0;
          if (upper.includes('TRUFA') && upper.includes('40')) return 1;
          if (upper.includes('TRUFA') && upper.includes('30')) return 2;
          return 3;
        };
        const diff = rank(a.name) - rank(b.name);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name, 'pt-BR');
      }),
    [products],
  );

  const visibleProduct = manufactured[productCursor] || null;
  const visibleVariant = variants[variantCursor] || null;
  const currentProcess = routedProcesses[processIndex] || null;

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
        const { data } = await supabase
          .from('app_users')
          .select('id,name')
          .eq('auth_user_id', authData.user.id)
          .eq('is_active', true)
          .maybeSingle();
        if (mounted && data) setCurrentOperator(data as AppUser);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!product || routedProcesses.length === 0 || operators.length === 0) return;
    setAssignments((current) => {
      const next = { ...current };
      routedProcesses.forEach((proc) => {
        if (next[proc.id]) return;
        const stored = typeof window !== 'undefined'
          ? window.localStorage.getItem(`production:last-operator:${product.id}:${proc.id}`)
          : null;
        if (stored && operators.some((operator) => operator.id === stored)) next[proc.id] = stored;
        else if (currentOperator) next[proc.id] = currentOperator.id;
      });
      return next;
    });
  }, [product, routedProcesses, operators, currentOperator]);

  const clearAttempt = () => {
    pendingEventKey.current = null;
    setResult(null);
    setProcessWarning(false);
  };

  const loadProcesses = async (selectedProduct: Product) => {
    setLoadingProcesses(true);
    const { data, error } = await (supabase as any)
      .from('product_processes')
      .select('process_id,sort_order,cost_per_unit,process:processes(id,name,value_per_unit,is_active)')
      .eq('product_id', selectedProduct.id)
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      setLoadingProcesses(false);
      toast.error('Não foi possível carregar os processos deste produto.');
      return false;
    }

    const mapped: RoutedProcess[] = (data || [])
      .map((row: any) => ({
        id: row.process?.id || row.process_id,
        name: row.process?.name || 'Processo',
        value_per_unit: row.cost_per_unit ?? row.process?.value_per_unit ?? 0,
        sort_order: row.sort_order || 0,
      }))
      .filter((item: RoutedProcess) => item.id);

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
    return mapped.length > 0;
  };

  const reset = () => {
    setScreen('product');
    setProductCursor(0);
    setVariantCursor(0);
    setProcessIndex(0);
    setProduct(null);
    setVariant(null);
    setVariants([]);
    setQuantity('');
    setRoutedProcesses([]);
    setAssignments({});
    clearAttempt();
  };

  const chooseVisibleProduct = async () => {
    if (!visibleProduct) return;
    const selected = visibleProduct;
    setProduct(selected);
    setVariant(null);
    setQuantity('');
    setRoutedProcesses([]);
    setAssignments({});
    setProcessIndex(0);
    clearAttempt();

    if (selected.variation_mode !== 'variacoes_fisicas') {
      setVariants([]);
      await loadProcesses(selected);
      setScreen('quantity');
      return;
    }

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
    setVariantCursor(0);

    if (list.length === 1) {
      setVariant(list[0]);
      await loadProcesses(selected);
      setScreen('quantity');
      return;
    }

    setScreen('variant');
  };

  const chooseVisibleVariant = async () => {
    if (!product || !visibleVariant) return;
    setVariant(visibleVariant);
    clearAttempt();
    await loadProcesses(product);
    setScreen('quantity');
  };

  const parsedQuantity = Number(quantity.replace(',', '.'));
  const validQuantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0;
  const allProcessesAssigned = routedProcesses.length > 0 && routedProcesses.every((proc) => !!assignments[proc.id]);
  const canConfirm = validQuantity && !loadingProcesses && allProcessesAssigned;

  const goBack = () => {
    clearAttempt();
    if (screen === 'product') {
      onExit?.();
      return;
    }
    if (screen === 'variant') {
      setProduct(null);
      setVariant(null);
      setVariants([]);
      setScreen('product');
      return;
    }
    if (screen === 'quantity') {
      if (product?.variation_mode === 'variacoes_fisicas' && variants.length > 1) {
        setVariant(null);
        setRoutedProcesses([]);
        setAssignments({});
        setScreen('variant');
      } else {
        setProduct(null);
        setRoutedProcesses([]);
        setAssignments({});
        setScreen('product');
      }
      return;
    }
    if (screen === 'process') {
      if (processIndex > 0) setProcessIndex((current) => current - 1);
      else setScreen('quantity');
      return;
    }
    if (screen === 'confirm') {
      if (routedProcesses.length > 0) {
        setProcessIndex(routedProcesses.length - 1);
        setScreen('process');
      } else setScreen('quantity');
    }
  };

  const goForwardFromQuantity = () => {
    if (!validQuantity) return;
    if (loadingProcesses) return;
    if (routedProcesses.length === 0) {
      toast.error('Este produto ainda não possui processos configurados.');
      return;
    }
    setProcessIndex(0);
    setScreen('process');
  };

  const goForwardFromProcess = () => {
    if (!currentProcess || !assignments[currentProcess.id]) return;
    if (processIndex < routedProcesses.length - 1) {
      setProcessIndex((current) => current + 1);
      return;
    }
    clearAttempt();
    pendingEventKey.current = `production_fact:${crypto.randomUUID()}`;
    setScreen('confirm');
  };

  const confirm = async () => {
    if (!product || !canConfirm || submitting) return;
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
      if (!operator) return false;

      const { data: attached, error: attachError } = await (supabase as any).rpc('attach_production_fact_process', {
        p_production_fact_id: rpcResult.production_fact_id,
        p_process_id: proc.id,
        p_operator_user_id: operator.id,
        p_operator_name: operator.name,
      });

      if (!attachError && attached?.success && typeof window !== 'undefined') {
        window.localStorage.setItem(`production:last-operator:${product.id}:${proc.id}`, operator.id);
      }
      return !attachError && !!attached?.success;
    }));

    setSubmitting(false);
    if (attachments.some((ok) => !ok)) {
      setProcessWarning(true);
      toast.warning('Produção registrada, mas algum processo precisa ser revisado.');
    }
    notifyInventoryChanged();
    setScreen('success');
  };

  const totalSteps = 3 + (product?.variation_mode === 'variacoes_fisicas' && variants.length > 1 ? 1 : 0) + routedProcesses.length;
  const currentStep = (() => {
    if (screen === 'product') return 1;
    if (screen === 'variant') return 2;
    const hasVariantStep = product?.variation_mode === 'variacoes_fisicas' && variants.length > 1;
    if (screen === 'quantity') return hasVariantStep ? 3 : 2;
    if (screen === 'process') return (hasVariantStep ? 4 : 3) + processIndex;
    if (screen === 'confirm') return totalSteps;
    return totalSteps;
  })();

  const productName = product?.name || '';
  const variantName = variant?.variant_name || '';
  const currentOperatorName = currentProcess
    ? operators.find((operator) => operator.id === assignments[currentProcess.id])?.name
    : '';

  return (
    <div className="fixed inset-0 z-[100] h-[100dvh] w-screen overflow-hidden bg-background text-foreground">
      <div className="mx-auto flex h-full w-full max-w-lg flex-col px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
        {screen !== 'success' && (
          <div className="flex shrink-0 items-center justify-between">
            <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full" onClick={goBack} aria-label="Voltar">
              <ArrowLeft className="h-7 w-7" />
            </Button>
            <div className="text-center">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Produção</div>
              <div className="mt-1 text-sm font-medium text-muted-foreground">{Math.min(currentStep, totalSteps)} de {Math.max(totalSteps, 1)}</div>
            </div>
            <div className="h-12 w-12" />
          </div>
        )}

        <main className="flex min-h-0 flex-1 items-center justify-center py-3">
          {screen === 'product' && (
            <div className="w-full text-center">
              <h1 className="mb-5 text-3xl font-black tracking-tight sm:text-4xl">O que você produziu?</h1>
              {visibleProduct ? (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-14 w-14 shrink-0 rounded-full"
                    disabled={manufactured.length <= 1}
                    onClick={() => setProductCursor((current) => (current - 1 + manufactured.length) % manufactured.length)}
                    aria-label="Produto anterior"
                  >
                    <ChevronLeft className="h-8 w-8" />
                  </Button>

                  <button
                    type="button"
                    onClick={chooseVisibleProduct}
                    className="w-full max-w-[290px] overflow-hidden rounded-3xl border bg-card shadow-sm transition active:scale-[0.98]"
                  >
                    <div className="aspect-square max-h-[40dvh] bg-muted">
                      {visibleProduct.cover_image_url ? (
                        <img src={visibleProduct.cover_image_url} alt={visibleProduct.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground"><ImageOff className="h-16 w-16" /></div>
                      )}
                    </div>
                    <div className="p-4 text-xl font-black leading-tight">{visibleProduct.name}</div>
                  </button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-14 w-14 shrink-0 rounded-full"
                    disabled={manufactured.length <= 1}
                    onClick={() => setProductCursor((current) => (current + 1) % manufactured.length)}
                    aria-label="Próximo produto"
                  >
                    <ChevronRight className="h-8 w-8" />
                  </Button>
                </div>
              ) : (
                <div className="text-lg text-muted-foreground">Nenhum produto fabricado ativo.</div>
              )}
              <p className="mt-4 text-sm text-muted-foreground">Toque no produto para continuar</p>
            </div>
          )}

          {screen === 'variant' && (
            <div className="w-full text-center">
              <div className="mb-2 text-sm font-semibold text-muted-foreground">{productName}</div>
              <h1 className="mb-8 text-3xl font-black tracking-tight sm:text-4xl">Qual variante?</h1>
              {loadingVariants ? (
                <Loader2 className="mx-auto h-10 w-10 animate-spin" />
              ) : visibleVariant ? (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-14 w-14 shrink-0 rounded-full"
                    disabled={variants.length <= 1}
                    onClick={() => setVariantCursor((current) => (current - 1 + variants.length) % variants.length)}
                  >
                    <ChevronLeft className="h-8 w-8" />
                  </Button>
                  <button
                    type="button"
                    onClick={chooseVisibleVariant}
                    className="flex min-h-44 w-full max-w-[290px] items-center justify-center rounded-3xl border bg-card p-6 text-3xl font-black leading-tight shadow-sm active:scale-[0.98]"
                  >
                    {visibleVariant.variant_name}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-14 w-14 shrink-0 rounded-full"
                    disabled={variants.length <= 1}
                    onClick={() => setVariantCursor((current) => (current + 1) % variants.length)}
                  >
                    <ChevronRight className="h-8 w-8" />
                  </Button>
                </div>
              ) : (
                <div className="text-lg text-muted-foreground">Nenhuma variante ativa.</div>
              )}
              <p className="mt-5 text-sm text-muted-foreground">Toque na variante para continuar</p>
            </div>
          )}

          {screen === 'quantity' && (
            <div className="w-full text-center">
              <div className="mb-2 text-sm font-semibold text-muted-foreground">{productName}{variantName ? ` · ${variantName}` : ''}</div>
              <h1 className="mb-5 text-3xl font-black tracking-tight sm:text-4xl">Quantas unidades?</h1>
              <Input
                inputMode="decimal"
                value={quantity}
                onChange={(event) => { setQuantity(event.target.value.replace(/[^0-9.,]/g, '')); clearAttempt(); }}
                placeholder="0"
                className="mx-auto h-24 max-w-sm rounded-3xl text-center text-5xl font-black"
                autoFocus
              />
              <div className="mx-auto mt-4 grid max-w-sm grid-cols-2 gap-3">
                {QUICK_AMOUNTS.map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    variant="outline"
                    className="h-14 rounded-2xl text-xl font-bold"
                    onClick={() => { setQuantity(String((Number(quantity) || 0) + amount)); clearAttempt(); }}
                  >
                    +{amount}
                  </Button>
                ))}
              </div>
              {loadingProcesses && <p className="mt-4 text-sm text-muted-foreground">Carregando processos…</p>}
              {!loadingProcesses && routedProcesses.length === 0 && (
                <div className="mx-auto mt-4 max-w-sm rounded-2xl border border-amber-400/40 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle className="mx-auto mb-1 h-5 w-5" />
                  Processos ainda não configurados para este produto.
                </div>
              )}
            </div>
          )}

          {screen === 'process' && currentProcess && (
            <div className="w-full text-center">
              <div className="mb-3 text-sm font-semibold text-muted-foreground">{productName}{variantName ? ` · ${variantName}` : ''} · {parsedQuantity || 0} un</div>
              <div className="text-sm font-bold uppercase tracking-[0.22em] text-muted-foreground">Processo {processIndex + 1} de {routedProcesses.length}</div>
              <h1 className="mx-auto mt-4 max-w-md text-4xl font-black leading-tight tracking-tight">{currentProcess.name}</h1>
              <div className="mx-auto mt-8 max-w-sm">
                <div className="mb-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Quem fez?</div>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-14 w-14 shrink-0 rounded-full"
                    disabled={operators.length <= 1}
                    onClick={() => {
                      if (!currentProcess || operators.length === 0) return;
                      const currentIndex = operators.findIndex((operator) => operator.id === assignments[currentProcess.id]);
                      const previous = operators[(currentIndex - 1 + operators.length) % operators.length];
                      setAssignments((current) => ({ ...current, [currentProcess.id]: previous.id }));
                      clearAttempt();
                    }}
                    aria-label="Operador anterior"
                  >
                    <ChevronLeft className="h-8 w-8" />
                  </Button>
                  <div className="flex min-h-24 w-full max-w-[290px] items-center justify-center rounded-3xl border bg-card px-4 py-6 text-center text-3xl font-black leading-tight">
                    {currentOperatorName || 'Sem operador'}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-14 w-14 shrink-0 rounded-full"
                    disabled={operators.length <= 1}
                    onClick={() => {
                      if (!currentProcess || operators.length === 0) return;
                      const currentIndex = operators.findIndex((operator) => operator.id === assignments[currentProcess.id]);
                      const next = operators[(currentIndex + 1) % operators.length];
                      setAssignments((current) => ({ ...current, [currentProcess.id]: next.id }));
                      clearAttempt();
                    }}
                    aria-label="Próximo operador"
                  >
                    <ChevronRight className="h-8 w-8" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {screen === 'confirm' && (
            <div className="w-full text-center">
              <div className="text-sm font-bold uppercase tracking-[0.22em] text-muted-foreground">Conferir</div>
              <h1 className="mt-3 text-4xl font-black tracking-tight">{parsedQuantity} un</h1>
              <p className="mt-2 text-xl font-bold">{productName}</p>
              {variantName && <p className="mt-1 text-lg text-muted-foreground">{variantName}</p>}
              <div className="mx-auto mt-6 max-w-sm rounded-3xl border bg-card p-4 text-left">
                <div className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Processos</div>
                {routedProcesses.slice(0, 5).map((proc) => {
                  const operator = operators.find((item) => item.id === assignments[proc.id]);
                  return <div key={proc.id} className="flex items-center justify-between gap-3 border-b py-2 last:border-b-0">
                    <span className="truncate font-semibold">{proc.name}</span>
                    <span className="shrink-0 text-sm text-muted-foreground">{operator?.name || '—'}</span>
                  </div>;
                })}
                {routedProcesses.length > 5 && <div className="pt-2 text-sm text-muted-foreground">+ {routedProcesses.length - 5} processo(s)</div>}
              </div>
            </div>
          )}

          {screen === 'success' && (
            <div className="w-full text-center">
              <CheckCircle2 className="mx-auto h-20 w-20 text-green-600" />
              <h1 className="mt-5 text-4xl font-black tracking-tight">Produção registrada</h1>
              <p className="mt-3 text-2xl font-bold">{parsedQuantity} un</p>
              <p className="mt-1 text-lg text-muted-foreground">{productName}{variantName ? ` · ${variantName}` : ''}</p>

              {result?.material_adjustment_required && (
                <div className="mx-auto mt-5 max-w-sm rounded-2xl border border-amber-400/40 bg-amber-50 p-4 text-amber-900">
                  <div className="flex items-center justify-center gap-2 font-bold"><AlertTriangle className="h-5 w-5" />Ajuste de material pendente</div>
                  <p className="mt-1 text-sm">A produção entrou normalmente. O gestor poderá regularizar depois em Ajustes.</p>
                </div>
              )}

              {processWarning && (
                <div className="mx-auto mt-4 max-w-sm rounded-2xl border border-amber-400/40 bg-amber-50 p-3 text-sm text-amber-900">
                  Algum processo precisa ser revisado posteriormente.
                </div>
              )}

              <div className="mx-auto mt-7 grid max-w-sm gap-3">
                <Button className="h-16 rounded-2xl text-lg font-black" onClick={reset}><PackageCheck className="mr-2 h-6 w-6" />Lançar outra produção</Button>
                <Button variant="outline" className="h-14 rounded-2xl text-base font-bold" onClick={onExit}>Sair</Button>
              </div>
            </div>
          )}
        </main>

        {screen !== 'product' && screen !== 'variant' && screen !== 'success' && (
          <div className="grid shrink-0 grid-cols-2 gap-3 pt-2">
            <Button variant="outline" className="h-16 rounded-2xl text-lg font-bold" onClick={goBack} disabled={submitting}>
              <ArrowLeft className="mr-2 h-6 w-6" />Voltar
            </Button>

            {screen === 'quantity' && (
              <Button className="h-16 rounded-2xl text-lg font-bold" disabled={!validQuantity || loadingProcesses || routedProcesses.length === 0} onClick={goForwardFromQuantity}>
                Avançar<ArrowRight className="ml-2 h-6 w-6" />
              </Button>
            )}

            {screen === 'process' && (
              <Button className="h-16 rounded-2xl text-lg font-bold" disabled={!currentProcess || !assignments[currentProcess.id]} onClick={goForwardFromProcess}>
                Avançar<ArrowRight className="ml-2 h-6 w-6" />
              </Button>
            )}

            {screen === 'confirm' && (
              <Button className="h-16 rounded-2xl text-lg font-black" disabled={!canConfirm || submitting} onClick={confirm}>
                {submitting ? <><Loader2 className="mr-2 h-6 w-6 animate-spin" />Registrando</> : <>Confirmar<ArrowRight className="ml-2 h-6 w-6" /></>}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
