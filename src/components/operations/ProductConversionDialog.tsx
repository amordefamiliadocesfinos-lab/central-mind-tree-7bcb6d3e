import { useMemo, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/hooks/useOrders';
import { parseVariantAttributes } from '@/lib/productVariants';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ProductConversionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  onConverted: () => void | Promise<void>;
}

interface VariantDraft {
  variantName: string;
  attributes: string;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'Não foi possível converter os produtos. Revise os dados e tente novamente.';
}

export function ProductConversionDialog({ open, onOpenChange, products, onConverted }: ProductConversionDialogProps) {
  const [masterName, setMasterName] = useState('');
  const [selected, setSelected] = useState<Record<string, VariantDraft>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const eligibleProducts = useMemo(
    () => products.filter(product => product.is_active && (product.variation_mode ?? 'sem_variacao') === 'sem_variacao'),
    [products],
  );
  const selectedProducts = useMemo(
    () => eligibleProducts.filter(product => selected[product.id]),
    [eligibleProducts, selected],
  );
  const canConfirm = masterName.trim().length > 0
    && selectedProducts.length >= 2
    && selectedProducts.every(product => selected[product.id].variantName.trim().length > 0)
    && !submitting;

  const reset = () => {
    setMasterName('');
    setSelected({});
    setErrorMessage('');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (submitting) return;
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const toggleProduct = (product: Product) => {
    setErrorMessage('');
    setSelected(current => {
      if (current[product.id]) {
        const next = { ...current };
        delete next[product.id];
        return next;
      }
      return { ...current, [product.id]: { variantName: product.name, attributes: '' } };
    });
  };

  const updateDraft = (productId: string, field: keyof VariantDraft, value: string) => {
    setSelected(current => ({
      ...current,
      [productId]: { ...current[productId], [field]: value },
    }));
  };

  const confirm = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    setErrorMessage('');
    try {
      // RPC ainda não refletida nos tipos gerados do banco.
      const { error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }>)('convert_simple_products_to_variants', {
        p_source_product_ids: selectedProducts.map(product => product.id),
        p_master: {
          name: masterName.trim(),
          sku: `MASTER-${crypto.randomUUID()}`,
        },
        p_variants: selectedProducts.map(product => ({
          source_product_id: product.id,
          variant_name: selected[product.id].variantName.trim(),
          attributes: parseVariantAttributes(selected[product.id].attributes),
        })),
        p_reset_stock: true,
      });
      if (error) throw error;

      await onConverted();
      reset();
      onOpenChange(false);
      toast.success('Produtos convertidos em Mestre + Variantes.');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Converter em Mestre + Variantes</DialogTitle>
          <DialogDescription>
            Selecione dois ou mais produtos simples. Os SKUs físicos serão transferidos para as novas variantes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Produtos simples</Label>
            <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border p-2">
              {eligibleProducts.map(product => (
                <label key={product.id} className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted/60">
                  <Checkbox
                    checked={Boolean(selected[product.id])}
                    onCheckedChange={() => toggleProduct(product)}
                    disabled={submitting}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{product.name}</span>
                    <span className="block text-xs text-muted-foreground">SKU: {product.sku}</span>
                  </span>
                </label>
              ))}
              {eligibleProducts.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nenhum produto simples elegível.</p>}
            </div>
            <p className="text-xs text-muted-foreground">{selectedProducts.length} produto(s) selecionado(s); mínimo de 2.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="conversion-master-name">Nome do novo Mestre</Label>
            <Input
              id="conversion-master-name"
              value={masterName}
              onChange={event => setMasterName(event.target.value)}
              placeholder="Ex.: Produto com variações"
              disabled={submitting}
            />
          </div>

          {selectedProducts.length > 0 && (
            <div className="space-y-3">
              <Label>Definição das variantes</Label>
              {selectedProducts.map(product => (
                <div key={product.id} className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                  </div>
                  <div className="space-y-2">
                    <Input
                      aria-label={`Nome da variante de ${product.name}`}
                      value={selected[product.id].variantName}
                      onChange={event => updateDraft(product.id, 'variantName', event.target.value)}
                      placeholder="Nome da variante"
                      disabled={submitting}
                    />
                    <Input
                      aria-label={`Atributos da variante de ${product.name}`}
                      value={selected[product.id].attributes}
                      onChange={event => updateDraft(product.id, 'attributes', event.target.value)}
                      placeholder="Atributos opcionais: sabor=morango; peso=1kg"
                      disabled={submitting}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedProducts.length >= 2 && masterName.trim() && (
            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
              <p className="text-sm font-semibold">Prévia</p>
              {selectedProducts.map(product => (
                <div key={product.id} className="grid items-center gap-2 border-t py-2 text-sm first:border-t-0 sm:grid-cols-[1fr_auto_1fr]">
                  <div><span className="font-medium">{product.name}</span><span className="block text-xs text-muted-foreground">SKU: {product.sku}</span></div>
                  <ArrowRight className="hidden h-4 w-4 text-muted-foreground sm:block" />
                  <div><span className="font-medium">{masterName.trim()} / {selected[product.id].variantName.trim() || 'Sem nome'}</span><span className="block text-xs text-muted-foreground">Mesmo SKU: {product.sku}</span></div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 rounded-md border p-3">
            <Checkbox checked disabled aria-label="Reiniciar estoque ativado" />
            <div><p className="text-sm font-medium">Reiniciar estoque: SIM</p><p className="text-xs text-muted-foreground">Obrigatório nesta versão. As variantes começarão com estoque zero.</p></div>
          </div>

          {errorMessage && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{errorMessage}</div>}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>Cancelar</Button>
            <Button type="button" onClick={confirm} disabled={!canConfirm}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitting ? 'Convertendo...' : 'Confirmar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
