import { useState, useEffect } from 'react';
import { useBOM } from '@/hooks/useBOM';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BOMEditorProps {
  productId: string;
  productName: string;
  availableComponents: { id: string; name: string; sku: string; unit: string }[];
}

export function BOMEditor({ productId, productName, availableComponents }: BOMEditorProps) {
  const { components, loading, fetchComponentsForProduct, addComponent, updateComponent, removeComponent, clearComponents } = useBOM();
  const [newComponentId, setNewComponentId] = useState('');
  const [newVariantId, setNewVariantId] = useState('');
  const [productVariantId, setProductVariantId] = useState('');
  const [finalVariants, setFinalVariants] = useState<{ id: string; variant_name: string; sku: string }[]>([]);
  const [availableVariants, setAvailableVariants] = useState<{ id: string; variant_name: string; sku: string }[]>([]);
  const [newQty, setNewQty] = useState(1);
  const [requiresFinalVariant, setRequiresFinalVariant] = useState(false);
  const [finalVariantsLoaded, setFinalVariantsLoaded] = useState(false);

  useEffect(() => {
    if (!finalVariantsLoaded) return;
    if (requiresFinalVariant && !productVariantId) {
      clearComponents();
      return;
    }
    void fetchComponentsForProduct(productId, productVariantId || null);
  }, [productId, productVariantId, requiresFinalVariant, finalVariantsLoaded, fetchComponentsForProduct, clearComponents]);

  useEffect(() => {
    setFinalVariantsLoaded(false);
    void Promise.all([
      supabase.from('product_variants').select('id, variant_name, sku').eq('product_id', productId).eq('is_active', true).order('variant_name'),
      (supabase.from('products') as any).select('variation_mode').eq('id', productId).maybeSingle(),
    ]).then(([variantsResult, productResult]) => {
      setFinalVariants(variantsResult.data || []);
      setRequiresFinalVariant(productResult.data?.variation_mode === 'variacoes_fisicas');
      setProductVariantId('');
      setFinalVariantsLoaded(true);
    });
  }, [productId]);

  useEffect(() => {
    if (!newComponentId) {
      setAvailableVariants([]);
      setNewVariantId('');
      return;
    }
    void supabase.from('product_variants').select('id, variant_name, sku').eq('product_id', newComponentId).eq('is_active', true).order('variant_name').then(({ data }) => {
      setAvailableVariants(data || []);
      setNewVariantId('');
    });
  }, [newComponentId]);

  const handleAdd = async () => {
    if (!newComponentId || newQty <= 0) return;
    if (requiresFinalVariant && !productVariantId) {
      toast.error('Selecione a variante final antes de editar a BOM.');
      return;
    }
    if (availableVariants.length && !newVariantId) return;
    const result = await addComponent(productId, newComponentId, newQty, undefined, productVariantId || null, newVariantId || null);
    if (result) {
      setNewComponentId('');
      setNewVariantId('');
      setNewQty(1);
      fetchComponentsForProduct(productId, productVariantId || null);
    }
  };

  const handleRemove = async (id: string) => {
    await removeComponent(id);
    fetchComponentsForProduct(productId, productVariantId || null);
  };

  const handleUpdate = async (id: string, qty: number) => {
    await updateComponent(id, qty);
    fetchComponentsForProduct(productId, productVariantId || null);
  };

  // Duplicidade é por identidade completa. Um mesmo mestre pode fornecer duas
  // variantes físicas distintas para a mesma variante final.
  const availableToAdd = availableComponents.filter(c => c.id !== productId);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Componentes de {productName}</Label>
      {requiresFinalVariant && (
        <div className="max-w-sm">
          <Label className="text-xs">Variante final</Label>
          <Select value={productVariantId} onValueChange={setProductVariantId}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Selecione a variante final..." /></SelectTrigger>
            <SelectContent>
              {finalVariants.map((variant) => <SelectItem key={variant.id} value={variant.id}>{variant.variant_name} ({variant.sku})</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">Cada variante final possui sua própria BOM. A variante do componente identifica o insumo físico.</p>
        </div>
      )}

      {requiresFinalVariant && finalVariants.length === 0 && (
        <p className="text-sm text-destructive">Este Produto Mestre não possui variante física ativa para receber uma BOM.</p>
      )}

      {requiresFinalVariant && !productVariantId ? (
        <p className="text-sm text-muted-foreground py-2">Selecione uma variante final para visualizar ou editar sua composição.</p>
      ) : <>
      
      {components.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          Nenhum componente cadastrado. Adicione materiais/insumos que compõem este produto.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Componente físico</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="w-24 text-right">Qtd/un</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {components.map((comp) => (
              <TableRow key={comp.id}>
                <TableCell>
                  <span className="font-medium">{comp.component?.name}</span>
                  {comp.component_variant && <span className="text-xs text-muted-foreground ml-2">· {comp.component_variant.variant_name}</span>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{comp.component_variant?.sku || comp.component?.sku}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{comp.component_variant?.unit || comp.component?.unit}</TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    step="any"
                    min="0.000001"
                    className="w-24 h-8 text-right"
                    value={comp.qty_per_unit}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (val > 0) handleUpdate(comp.id, val);
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => handleRemove(comp.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Add new component */}
      <div className="flex gap-2 items-end pt-2 border-t">
        <div className="flex-1">
          <Label className="text-xs">Adicionar componente</Label>
          <Select value={newComponentId} onValueChange={setNewComponentId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {availableToAdd.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.sku})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {availableVariants.length > 0 && <div className="flex-1">
          <Label className="text-xs">Variante física</Label>
          <Select value={newVariantId} onValueChange={setNewVariantId}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Selecione a variante..." /></SelectTrigger>
            <SelectContent>{availableVariants.map((variant) => <SelectItem key={variant.id} value={variant.id}>{variant.variant_name} ({variant.sku})</SelectItem>)}</SelectContent>
          </Select>
        </div>}
        <div className="w-24">
          <Label className="text-xs">Qtd/un</Label>
          <Input
            type="number"
            step="any"
            min="0.000001"
            className="h-9"
            value={newQty}
            onChange={(e) => setNewQty(parseFloat(e.target.value) || 1)}
          />
        </div>
        <Button size="sm" className="h-9" onClick={handleAdd} disabled={!newComponentId || (availableVariants.length > 0 && !newVariantId)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      </>}
    </div>
  );
}
