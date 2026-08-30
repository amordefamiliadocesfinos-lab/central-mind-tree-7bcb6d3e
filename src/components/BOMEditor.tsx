import { useState, useEffect } from 'react';
import { useBOM, ProductComponent } from '@/hooks/useBOM';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface BOMEditorProps {
  productId: string;
  productName: string;
  availableComponents: { id: string; name: string; sku: string; unit: string }[];
}

export function BOMEditor({ productId, productName, availableComponents }: BOMEditorProps) {
  const { components, loading, fetchComponentsForProduct, addComponent, updateComponent, removeComponent } = useBOM();
  const [newComponentId, setNewComponentId] = useState('');
  const [newVariantId, setNewVariantId] = useState('');
  const [availableVariants, setAvailableVariants] = useState<{ id: string; variant_name: string; sku: string }[]>([]);
  const [newQty, setNewQty] = useState(1);

  useEffect(() => {
    fetchComponentsForProduct(productId);
  }, [productId, fetchComponentsForProduct]);

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
    if (availableVariants.length && !newVariantId) return;
    const result = await addComponent(productId, newComponentId, newVariantId || null, newQty);
    if (result) {
      setNewComponentId('');
      setNewVariantId('');
      setNewQty(1);
      fetchComponentsForProduct(productId);
    }
  };

  const handleRemove = async (id: string) => {
    await removeComponent(id);
    fetchComponentsForProduct(productId);
  };

  const handleUpdate = async (id: string, qty: number) => {
    await updateComponent(id, qty);
    fetchComponentsForProduct(productId);
  };

  // Filter out the product itself and already added components
  const availableToAdd = availableComponents.filter(c => c.id !== productId && !components.find(comp => comp.component_id === c.id && !comp.variant_id));

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Componentes de {productName}</Label>
      
      {components.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          Nenhum componente cadastrado. Adicione materiais/insumos que compõem este produto.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Componente</TableHead>
              <TableHead className="w-24 text-right">Qtd/un</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {components.map((comp) => (
              <TableRow key={comp.id}>
                <TableCell>
                  <span className="font-medium">{comp.component?.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({comp.component?.sku})
                  </span>
                  {comp.variant && <span className="text-xs text-muted-foreground ml-2">· {comp.variant.variant_name} ({comp.variant.sku})</span>}
                </TableCell>
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
    </div>
  );
}
