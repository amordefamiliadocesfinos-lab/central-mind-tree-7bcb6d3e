import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Factory, ImageOff, Loader2, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { notifyInventoryChanged } from '@/hooks/useInventorySync';
import type { Product } from '@/hooks/useOrders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type ProductVariant = {
  id: string;
  product_id: string;
  sku: string;
  variant_name: string;
  is_active: boolean;
};

type AppUser = {
  id: string;
  name: string;
};

type Step = 'product' | 'variant' | 'quantity' | 'confirm' | 'success';

type ProductionFactResult = {
  success?: boolean;
  reason?: string;
  already_processed?: boolean;
  production_fact_id?: string;
  production_order_id?: string | null;
  quantity?: number;
  location?: string;
  shortages?: Array<{
    component_name?: string;
    component_variant_name?: string | null;
    required_quantity?: number;
    available_quantity?: number;
    missing_quantity?: number;
    unit?: string | null;
  }>;
};

interface ProductionFactMobileProps {
  products: Product[];
}

const QUICK_AMOUNTS = [30, 60, 120, 300];

function getErrorMessage(result: ProductionFactResult) {
  switch (result.reason) {
    case 'missing_bom':
      return 'Este produto ainda não possui uma composição de produção válida.';
    case 'invalid_location':
      return 'O local padrão de produção não está disponível.';
    case 'invalid_operator':
      return 'Não foi possível identificar o operador atual.';
    case 'production_order_not_found':
      return 'A OP relacionada não foi encontrada.';
    case 'production_order_cancelled':
      return 'A OP relacionada está cancelada.';
    case 'production_order_legacy_mode':
      return 'Esta OP ainda usa o fluxo legado de conclusão.';
    case 'production_order_item_mismatch':
      return 'O produto selecionado não pertence à OP relacionada.';
    case 'insufficient_stock':
      return 'Não há matéria-prima suficiente para confirmar esta produção.';
    case 'invalid_quantity':
      return 'Informe uma quantidade maior que zero.';
    default:
      return 'Não foi possível registrar a produção.';
  }
}

export function ProductionFactMobile({ products }: ProductionFactMobileProps) {
  const [step, setStep] = useState<Step>('product');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [quantity, setQuantity] = useState('');
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [operator, setOperator] = useState<AppUser | null>(null);
  const [lastResult, setLastResult] = useState<ProductionFactResult | null>(null);

  const manufacturedProducts = useMemo(
    () => products
      .filter((product) => product.is_active && product.is_manufactured)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [products],
  );

  useEffect(() => {
    let active = true;

    async function resolveOperator() {
      const { data: authData } = await supabase.auth.getUser();
      const authUserId = authData.user?.id;
      if (!authUserId) return;

      const { data } = await supabase
        .from('app_users')
        .select('id,name')
        .eq('auth_user_id', authUserId)
        .eq('is_active', true)
        .maybeSingle();

      if (active && data) setOperator(data as AppUser);
    }

    resolveOperator();
    return () => { active = false; };
  }, []);

  const resetFlow = () => {
    setStep('product');
    setSelectedProduct(null);
    setSelectedVariant(null);
    setVariants([]);
    setQuantity('');
    setLastResult(null);
  };

  const handleProductSelect = async (product: Product) => {
    setSelectedProduct(product);
    setSelectedVariant(null);
    setQuantity('');

    if (product.variation_mode !== 'variacoes_fisicas') {
      setVariants([]);
      setStep('quantity');
      return;
    }

    setLoadingVariants(true);
    const { data, error } = await supabase
      .from('product_variants')
      .select('id,product_id,sku,variant_name,is_active')
      .eq('product_id', product.id)
      .eq('is_active', true)
      .order('variant_name');
    setLoadingVariants(false);

    if (error) {
      toast.error('Não foi possível carregar os sabores/variantes.');
      return;
    }

    const activeVariants = (data || []) as ProductVariant[];
    setVariants(activeVariants);

    if (activeVariants.length === 1) {
      setSelectedVariant(activeVariants[0]);
      setStep('quantity');
      return;
    }

    setStep('variant');
  };

  const parsedQuantity = Number(quantity.replace(',', '.'));
  const canContinueQuantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0;

  const handleQuickAmount = (amount: number) => {
    const current = Number(quantity) || 0;
    setQuantity(String(current + amount));
  };

  const goBack = () => {
    if (step === 'variant') {
      setStep('product');
      setSelectedProduct(null);
      setVariants([]);
      return;
    }
    if (step === 'quantity') {
      if (selectedProduct?.variation_mode === 'variacoes_fisicas' && variants.length > 1) {
        setStep('variant');
        setSelectedVariant(null);
      } else {
        setStep('product');
        setSelectedProduct(null);
      }
      return;
    }
    if (step === 'confirm') setStep('quantity');
  };

  const handleConfirm = async () => {
    if (!selectedProduct || !canContinueQuantity || submitting) return;
    if (selectedProduct.variation_mode === 'variacoes_fisicas' && !selectedVariant) return;

    setSubmitting(true);
    const eventKey = `production_fact:${crypto.randomUUID()}`;

    const { data, error } = await (supabase as any).rpc('register_production_fact', {
      p_product_id: selectedProduct.id,
      p_variant_id: selectedVariant?.id ?? null,
      p_quantity: parsedQuantity,
      p_event_key: eventKey,
      p_location: 'Fábrica',
      p_operator_user_id: operator?.id ?? null,
      p_operator_name: operator?.name ?? null,
      p_production_order_id: null,
      p_occurred_at: new Date().toISOString(),
    });

    setSubmitting(false);

    if (error) {
      console.error('Erro ao registrar fato real de produção:', error);
      toast.error('Erro técnico ao registrar a produção. Nada foi confirmado.');
      return;
    }

    const result = (data || {}) as ProductionFactResult;
    if (!result.success) {
      setLastResult(result);
      toast.error(getErrorMessage(result));
      return;
    }

    setLastResult(result);
    notifyInventoryChanged();
    setStep('success');
  };

  const productTitle = selectedProduct?.name || '';
  const variantTitle = selectedVariant?.variant_name || '';

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-6">
      {step !== 'product' && step !== 'success' && (
        <Button variant="ghost" onClick={goBack} className="h-11 px-2 text-base">
          <ArrowLeft className="mr-2 h-5 w-5" />
          Voltar
        </Button>
      )}

      {step === 'product' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">O que você produziu?</h2>
            <p className="text-sm text-muted-foreground">Toque no produto. Não precisa escolher OP.</p>
          </div>

          {manufacturedProducts.length === 0 ? (
            <Card>
              <CardContent className="flex min-h-40 items-center justify-center text-center text-muted-foreground">
                Nenhum produto fabricado ativo foi encontrado.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {manufacturedProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleProductSelect(product)}
                  className="overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition active:scale-[0.98] hover:border-primary/50"
                >
                  <div className="aspect-square w-full bg-muted">
                    {product.cover_image_url ? (
                      <img
                        src={product.cover_image_url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <ImageOff className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="line-clamp-2 text-base font-semibold leading-tight">{product.name}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 'variant' && (
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium text-muted-foreground">{productTitle}</div>
            <h2 className="text-2xl font-bold tracking-tight">Qual sabor/variante?</h2>
          </div>

          {loadingVariants ? (
            <div className="flex min-h-40 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : variants.length === 0 ? (
            <Card>
              <CardContent className="flex min-h-40 items-center justify-center text-center text-muted-foreground">
                Nenhuma variante ativa encontrada para este produto.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {variants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => {
                    setSelectedVariant(variant);
                    setStep('quantity');
                  }}
                  className="min-h-24 rounded-2xl border bg-card p-4 text-left shadow-sm transition active:scale-[0.98] hover:border-primary/50"
                >
                  <div className="text-lg font-semibold leading-tight">{variant.variant_name}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 'quantity' && (
        <div className="space-y-5">
          <div>
            <div className="text-sm font-medium text-muted-foreground">
              {productTitle}{variantTitle ? ` · ${variantTitle}` : ''}
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Quantas unidades ficaram prontas?</h2>
          </div>

          <Card>
            <CardContent className="space-y-5 p-5">
              <Input
                inputMode="decimal"
                pattern="[0-9]*"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value.replace(/[^0-9.,]/g, ''))}
                placeholder="0"
                className="h-20 text-center text-4xl font-bold"
                autoFocus
              />

              <div className="grid grid-cols-4 gap-2">
                {QUICK_AMOUNTS.map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    variant="outline"
                    className="h-14 text-base font-semibold"
                    onClick={() => handleQuickAmount(amount)}
                  >
                    +{amount}
                  </Button>
                ))}
              </div>

              <Button
                type="button"
                className="h-16 w-full text-lg font-bold"
                disabled={!canContinueQuantity}
                onClick={() => setStep('confirm')}
              >
                Continuar
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Confirmar produção</h2>
            <p className="text-sm text-muted-foreground">Confira só estes três dados.</p>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/40 pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Factory className="h-5 w-5" /> Produção pronta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div>
                <div className="text-sm text-muted-foreground">Produto</div>
                <div className="text-xl font-semibold">{productTitle}</div>
              </div>
              {variantTitle && (
                <div>
                  <div className="text-sm text-muted-foreground">Sabor/variante</div>
                  <div className="text-xl font-semibold">{variantTitle}</div>
                </div>
              )}
              <div>
                <div className="text-sm text-muted-foreground">Quantidade</div>
                <div className="text-4xl font-bold">{parsedQuantity}</div>
              </div>
              <div className="text-xs text-muted-foreground">Destino padrão: Fábrica</div>
            </CardContent>
          </Card>

          {lastResult?.reason === 'insufficient_stock' && lastResult.shortages?.length ? (
            <Card className="border-destructive/40">
              <CardContent className="space-y-2 p-4">
                <div className="font-semibold text-destructive">Falta de material</div>
                {lastResult.shortages.map((shortage, index) => (
                  <div key={`${shortage.component_name}-${index}`} className="text-sm">
                    <span className="font-medium">
                      {shortage.component_name}{shortage.component_variant_name ? ` · ${shortage.component_variant_name}` : ''}
                    </span>
                    <div className="text-muted-foreground">
                      Necessário {shortage.required_quantity ?? 0} · disponível {shortage.available_quantity ?? 0} · falta {shortage.missing_quantity ?? 0} {shortage.unit || ''}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : lastResult && !lastResult.success ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {getErrorMessage(lastResult)}
            </div>
          ) : null}

          <Button
            type="button"
            className="h-20 w-full text-xl font-bold"
            disabled={submitting}
            onClick={handleConfirm}
          >
            {submitting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <PackageCheck className="mr-2 h-6 w-6" />}
            {submitting ? 'Registrando...' : 'CONFIRMAR PRODUÇÃO'}
          </Button>
        </div>
      )}

      {step === 'success' && (
        <Card className="overflow-hidden border-emerald-500/30">
          <CardContent className="flex min-h-[420px] flex-col items-center justify-center gap-5 p-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-3xl font-bold">Produção registrada</h2>
              <p className="mt-2 text-lg text-muted-foreground">
                {parsedQuantity} {productTitle}{variantTitle ? ` · ${variantTitle}` : ''}
              </p>
            </div>
            <Button type="button" className="h-16 w-full max-w-sm text-lg font-bold" onClick={resetFlow}>
              Lançar outra produção
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
