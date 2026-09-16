import { useEffect, useState } from 'react';
import { PackagePlus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useProductVariants, type ProductVariant, type ProductVariantInput } from '@/hooks/useProductVariants';
import { formatVariantAttributes, getPhysicalIdentityUnit, getVariantValue, parseVariantAttributes } from '@/lib/productVariants';
import { formatCurrency } from '@/lib/utils';

interface ProductVariantsPanelProps {
  product: {
    id: string;
    sku: string;
    unit: string;
    cost: number | null;
    price: number | null;
  };
}

const EMPTY_VARIANT: ProductVariantInput = {
  sku: '',
  variant_name: '',
  attributes: {},
  unit: null,
  is_active: true,
  cost_override: null,
  price_override: null,
  weight_g: null,
  height_cm: null,
  width_cm: null,
  length_cm: null,
};

function optionalNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function ProductVariantsPanel({ product }: ProductVariantsPanelProps) {
  const { variants, loading, createVariant, updateVariant, setVariantActive } = useProductVariants(product.id);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProductVariantInput>(EMPTY_VARIANT);
  const [attributesText, setAttributesText] = useState('');

  useEffect(() => {
    if (editingVariant) {
      setForm({
        sku: editingVariant.sku,
        variant_name: editingVariant.variant_name,
        attributes: editingVariant.attributes || {},
        unit: editingVariant.unit,
        is_active: editingVariant.is_active,
        cost_override: editingVariant.cost_override,
        price_override: editingVariant.price_override,
        weight_g: editingVariant.weight_g,
        height_cm: editingVariant.height_cm,
        width_cm: editingVariant.width_cm,
        length_cm: editingVariant.length_cm,
      });
      setAttributesText(formatVariantAttributes(editingVariant.attributes));
    } else {
      setForm(EMPTY_VARIANT);
      setAttributesText('');
    }
  }, [editingVariant, showForm]);

  const closeForm = () => {
    setShowForm(false);
    setEditingVariant(null);
  };

  const saveVariant = async () => {
    const input = { ...form, attributes: parseVariantAttributes(attributesText) };
    const saved = editingVariant
      ? await updateVariant(editingVariant.id, input)
      : await createVariant(input);
    if (saved) closeForm();
  };

  return (
    <section className="border-t pt-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-sm font-semibold">Variações físicas</Label>
          <p className="text-xs text-muted-foreground">Opcional. Produto Mestre e SKU atual permanecem preservados.</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(true)}>
          <PackagePlus className="h-4 w-4 mr-1" />
          Nova variação
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando variações...</p>
      ) : variants.length === 0 ? (
        <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">Nenhuma variação cadastrada. O Produto Mestre segue sendo usado normalmente.</p>
      ) : (
        <div className="space-y-2">
          {variants.map((variant) => (
            <div key={variant.id} className="rounded-md border px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <button type="button" className="min-w-0 text-left" onClick={() => { setEditingVariant(variant); setShowForm(true); }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{variant.variant_name}</span>
                    <Badge variant={variant.is_active ? 'secondary' : 'outline'}>{variant.is_active ? 'Ativa' : 'Inativa'}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">SKU: {variant.sku}{formatVariantAttributes(variant.attributes) ? ` · ${formatVariantAttributes(variant.attributes)}` : ''}</p>
                </button>
                <div className="flex items-center gap-1">
                  <Switch checked={variant.is_active} onCheckedChange={(checked) => setVariantActive(variant.id, checked)} aria-label={`Ativar ${variant.variant_name}`} />
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingVariant(variant); setShowForm(true); }} aria-label={`Editar ${variant.variant_name}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Unidade física: {getPhysicalIdentityUnit(product, variant)} · Custo {formatCurrency(getVariantValue(variant.cost_override, product.cost) || 0)} · Preço {formatCurrency(getVariantValue(variant.price_override, product.price) || 0)}
              </p>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingVariant ? 'Editar variação' : 'Nova variação física'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome da variação *</Label><Input value={form.variant_name} onChange={(event) => setForm({ ...form, variant_name: event.target.value })} placeholder="Ex.: Caixa 120 g" /></div>
              <div><Label>SKU próprio *</Label><Input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} placeholder="Ex.: CX-120-CHO" /></div>
            </div>
            <div><Label>Características</Label><Input value={attributesText} onChange={(event) => setAttributesText(event.target.value)} placeholder="Ex.: sabor=chocolate; peso=120g" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Unidade física de controle</Label><Input value={form.unit || ''} onChange={(event) => setForm({ ...form, unit: event.target.value || null })} placeholder={`Herda a unidade física do Produto Mestre (${product.unit})`} /><p className="mt-1 text-xs text-muted-foreground">Em branco, herda a unidade física do Produto Mestre.</p></div>
              <div><Label>Custo próprio</Label><Input type="number" min="0" step="any" value={form.cost_override ?? ''} onChange={(event) => setForm({ ...form, cost_override: optionalNumber(event.target.value) })} placeholder="Herdar" /></div>
              <div><Label>Preço próprio</Label><Input type="number" min="0" step="any" value={form.price_override ?? ''} onChange={(event) => setForm({ ...form, price_override: optionalNumber(event.target.value) })} placeholder="Herdar" /></div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div><Label className="text-xs">Altura cm</Label><Input type="number" min="0" step="any" value={form.height_cm ?? ''} onChange={(event) => setForm({ ...form, height_cm: optionalNumber(event.target.value) })} /></div>
              <div><Label className="text-xs">Largura cm</Label><Input type="number" min="0" step="any" value={form.width_cm ?? ''} onChange={(event) => setForm({ ...form, width_cm: optionalNumber(event.target.value) })} /></div>
              <div><Label className="text-xs">Comprimento cm</Label><Input type="number" min="0" step="any" value={form.length_cm ?? ''} onChange={(event) => setForm({ ...form, length_cm: optionalNumber(event.target.value) })} /></div>
              <div><Label className="text-xs">Peso g</Label><Input type="number" min="0" step="any" value={form.weight_g ?? ''} onChange={(event) => setForm({ ...form, weight_g: optionalNumber(event.target.value) })} /></div>
            </div>
            <div className="flex items-center justify-between"><Label>Variação ativa</Label><Switch checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} /></div>
            <div className="flex gap-2"><Button type="button" variant="outline" onClick={closeForm}>Cancelar</Button><Button type="button" className="flex-1" onClick={saveVariant}>{editingVariant ? 'Salvar variação' : 'Criar variação'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
