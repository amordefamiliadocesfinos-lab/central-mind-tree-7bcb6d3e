import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, FlaskConical, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { notifyInventoryChanged } from '@/hooks/useInventorySync';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Recipe = {
  id: string;
  code: string;
  name: string;
  output_product_id: string;
  output_variant_id: string | null;
  batch_output_qty: number | null;
  batch_output_unit: string;
  status: string;
  output_label: string;
};

type RecipeItem = {
  id: string;
  component_label: string;
  qty: number | null;
  unit: string | null;
  mapping_status: string;
};

type BatchResult = {
  success?: boolean;
  reason?: string;
  production_fact_id?: string;
  material_adjustment_required?: boolean;
  shortages?: unknown[];
};

const errorLabels: Record<string, string> = {
  invalid_output_quantity: 'Informe um rendimento real maior que zero.',
  recipe_not_found: 'A receita selecionada não foi encontrada.',
  invalid_intermediate_product: 'O produto de saída não está configurado como intermediário fabricado.',
  recipe_without_items: 'A receita não possui insumos com quantidade.',
  recipe_mapping_incomplete: 'A receita ainda possui insumos sem mapeamento físico completo.',
  invalid_location: 'O local Fábrica não está disponível.',
};

interface Props {
  initialProductId?: string | null;
  onExit?: () => void;
}

export function IntermediateBatchProduction({ initialProductId, onExit }: Props) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [outputQty, setOutputQty] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<BatchResult | null>(null);
  const eventKey = useRef<string | null>(null);

  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === selectedRecipeId) || null,
    [recipes, selectedRecipeId],
  );

  const parsedOutputQty = Number(outputQty.replace(',', '.'));
  const validOutputQty = Number.isFinite(parsedOutputQty) && parsedOutputQty > 0;
  const hasPendingMappings = items.some((item) => item.mapping_status !== 'mapeado');
  const totalInput = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      const { data: recipeRows, error } = await (supabase as any)
        .from('product_batch_recipes')
        .select('id,code,name,output_product_id,output_variant_id,batch_output_qty,batch_output_unit,status')
        .order('name');

      if (error) {
        if (mounted) {
          toast.error('Não foi possível carregar as receitas intermediárias.');
          setLoading(false);
        }
        return;
      }

      const rows = recipeRows || [];
      const productIds = [...new Set(rows.map((row: any) => row.output_product_id).filter(Boolean))];
      const variantIds = [...new Set(rows.map((row: any) => row.output_variant_id).filter(Boolean))];

      const [productsRes, variantsRes] = await Promise.all([
        productIds.length
          ? (supabase as any)
              .from('products')
              .select('id,name,is_active,is_manufactured,is_intermediate')
              .in('id', productIds)
          : Promise.resolve({ data: [], error: null }),
        variantIds.length
          ? (supabase as any)
              .from('product_variants')
              .select('id,variant_name,is_active')
              .in('id', variantIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (!mounted) return;

      if (productsRes.error || variantsRes.error) {
        toast.error('Não foi possível resolver os produtos das receitas.');
        setLoading(false);
        return;
      }

      const products = new Map<string, any>((productsRes.data || []).map((row: any) => [row.id, row]));
      const variants = new Map<string, any>((variantsRes.data || []).map((row: any) => [row.id, row]));

      const mapped: Recipe[] = rows
        .filter((row: any) => {
          const product = products.get(row.output_product_id);
          const variant = row.output_variant_id ? variants.get(row.output_variant_id) : null;
          return product?.is_active
            && product?.is_manufactured
            && product?.is_intermediate
            && (!row.output_variant_id || variant?.is_active);
        })
        .map((row: any) => {
          const product = products.get(row.output_product_id);
          const variant = row.output_variant_id ? variants.get(row.output_variant_id) : null;
          return {
            ...row,
            batch_output_qty: row.batch_output_qty == null ? null : Number(row.batch_output_qty),
            output_label: variant?.variant_name
              ? `${product?.name} · ${variant.variant_name}`
              : product?.name || row.name,
          };
        });

      setRecipes(mapped);
      if (initialProductId) {
        const initialRecipe = mapped.find(recipe => recipe.output_product_id === initialProductId);
        setSelectedRecipeId(initialRecipe?.id || '');
      } else if (mapped.length === 1) {
        setSelectedRecipeId(mapped[0].id);
      }
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [initialProductId]);

  useEffect(() => {
    let mounted = true;
    setItems([]);
    setLastResult(null);
    eventKey.current = null;

    if (!selectedRecipeId) return () => { mounted = false; };

    (async () => {
      setLoadingItems(true);
      const { data, error } = await (supabase as any)
        .from('product_batch_recipe_items')
        .select('id,component_label,qty,unit,mapping_status')
        .eq('recipe_id', selectedRecipeId)
        .order('created_at');

      if (!mounted) return;

      if (error) {
        toast.error('Não foi possível carregar os insumos da receita.');
        setLoadingItems(false);
        return;
      }

      setItems((data || []).map((row: any) => ({
        ...row,
        qty: row.qty == null ? null : Number(row.qty),
      })));
      setLoadingItems(false);
    })();

    return () => {
      mounted = false;
    };
  }, [selectedRecipeId]);

  const submit = async () => {
    if (!selectedRecipe || !validOutputQty || hasPendingMappings || submitting) return;

    if (!eventKey.current) {
      eventKey.current = `intermediate_batch:${crypto.randomUUID()}`;
    }

    setSubmitting(true);
    const { data, error } = await (supabase as any).rpc('register_intermediate_batch_fact', {
      p_recipe_id: selectedRecipe.id,
      p_output_quantity: parsedOutputQty,
      p_event_key: eventKey.current,
      p_location: 'Fábrica',
      p_occurred_at: new Date().toISOString(),
    });
    setSubmitting(false);

    if (error) {
      console.error(error);
      toast.error('Falha de comunicação. Tente confirmar novamente para consultar a mesma operação.');
      return;
    }

    const result = (data || {}) as BatchResult;
    setLastResult(result);

    if (!result.success) {
      toast.error(errorLabels[result.reason || ''] || 'Não foi possível registrar o lote intermediário.');
      return;
    }

    notifyInventoryChanged();

    if (result.material_adjustment_required) {
      toast.warning('Lote registrado, mas há insumos com consumo pendente.');
    } else {
      toast.success('Lote intermediário registrado e estoque atualizado.');
    }

    eventKey.current = null;
  };

  const startAnother = () => {
    setOutputQty('');
    setLastResult(null);
    eventKey.current = null;
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {onExit && (
        <Button variant="ghost" onClick={onExit} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar para produtos
        </Button>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Produção de lote intermediário
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Registre o rendimento real do recheio pronto. Os ingredientes da receita são consumidos e o recheio entra no estoque em gramas.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : recipes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma receita intermediária ativa foi encontrada.</p>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Receita / recheio</label>
                <Select value={selectedRecipeId} onValueChange={setSelectedRecipeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a receita" />
                  </SelectTrigger>
                  <SelectContent>
                    {recipes.map((recipe) => (
                      <SelectItem key={recipe.id} value={recipe.id}>
                        {recipe.output_label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedRecipe && (
                <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                  <div className="font-semibold">{selectedRecipe.name}</div>
                  <div className="mt-1 text-muted-foreground">
                    Código: {selectedRecipe.code}
                  </div>
                  <div className="mt-2 grid gap-1 sm:grid-cols-2">
                    <span>Entrada teórica da receita: <strong>{totalInput.toLocaleString('pt-BR')} g</strong></span>
                    <span>
                      Rendimento de referência:{' '}
                      <strong>
                        {selectedRecipe.batch_output_qty
                          ? `${selectedRecipe.batch_output_qty.toLocaleString('pt-BR')} ${selectedRecipe.batch_output_unit}`
                          : 'ainda não definido'}
                      </strong>
                    </span>
                  </div>
                </div>
              )}

              {loadingItems ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando insumos...
                </div>
              ) : selectedRecipe && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold">Insumos do lote</div>
                  <div className="max-h-56 divide-y overflow-auto rounded-lg border">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span>{item.component_label}</span>
                        <span className="shrink-0 font-medium">
                          {(item.qty || 0).toLocaleString('pt-BR')} {item.unit || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hasPendingMappings && (
                <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Esta receita ainda possui item sem identidade física completa e não pode ser registrada.
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-semibold">Rendimento real do lote pronto (g)</label>
                <Input
                  inputMode="decimal"
                  value={outputQty}
                  onChange={(event) => {
                    setOutputQty(event.target.value.replace(/[^0-9,.]/g, ''));
                    setLastResult(null);
                    eventKey.current = null;
                  }}
                  placeholder="Ex.: 32000"
                  className="h-14 text-lg font-semibold"
                />
                <p className="text-xs text-muted-foreground">
                  Informe o peso efetivamente obtido depois do preparo, não a soma teórica dos ingredientes.
                </p>
              </div>

              <Button
                className="h-12 w-full"
                disabled={!selectedRecipe || !validOutputQty || hasPendingMappings || submitting}
                onClick={submit}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar lote e atualizar estoque
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {lastResult?.success && (
        <Card className={lastResult.material_adjustment_required ? 'border-amber-300' : 'border-emerald-300'}>
          <CardContent className="flex items-start gap-3 pt-6">
            {lastResult.material_adjustment_required
              ? <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
              : <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />}
            <div className="flex-1">
              <div className="font-semibold">
                {lastResult.material_adjustment_required
                  ? 'Lote registrado com consumo pendente'
                  : 'Lote registrado com sucesso'}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                O rendimento real entrou no estoque do recheio. Se houver falta de algum insumo, ela permanece rastreável em Ajustes.
              </p>
              <Button variant="outline" className="mt-3" onClick={startAnother}>
                Registrar outro lote
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
