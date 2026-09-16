import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { Product } from '@/hooks/useOrders';
import { getPhysicalIdentityUnit } from '@/lib/productVariants';
import { formatCurrency } from '@/lib/utils';

export interface PurchaseVariantOption { id: string; variant_name: string; unit: string | null; }
export interface PurchasePresentationOption {
  id: string | null;
  name: string;
  purchase_unit_label: string;
  stock_unit_label: string;
  conversion_factor: number;
  is_approximate: boolean;
  notes?: string | null;
}
export interface PurchaseDraftLine {
  id: string;
  product_id: string;
  variant_id: string | null;
  qty: string;
  price: string;
  presentation: PurchasePresentationOption | null;
  presentationOverridden: boolean;
  variants: PurchaseVariantOption[];
  presentations: PurchasePresentationOption[];
}

interface Props {
  line: PurchaseDraftLine;
  products: Product[];
  canRemove: boolean;
  onChange: (line: PurchaseDraftLine) => void;
  onProductChange: (productId: string) => Promise<void>;
  onVariantChange: (variantId: string) => Promise<void>;
  onLoadPresentations: () => Promise<void>;
  onRemove: () => void;
}

export function directPresentation(product?: Pick<Product, 'unit'> | null, variant?: Pick<PurchaseVariantOption, 'unit'> | null): PurchasePresentationOption {
  const label = getPhysicalIdentityUnit(product, variant);
  return { id: null, name: 'Unidade direta', purchase_unit_label: label, stock_unit_label: label, conversion_factor: 1, is_approximate: false };
}

export function PurchaseOrderItemEditor({ line, products, canRemove, onChange, onProductChange, onVariantChange, onLoadPresentations, onRemove }: Props) {
  const product = products.find(item => item.id === line.product_id);
  const requiresVariant = product?.variation_mode === 'variacoes_fisicas';
  const identityResolved = Boolean(product) && (!requiresVariant || Boolean(line.variant_id));
  const selectedVariant = line.variants.find(item => item.id === line.variant_id);
  const canonicalUnit = getPhysicalIdentityUnit(product, selectedVariant);
  const presentation = line.presentation;
  const subtotal = (Number(line.qty) || 0) * (Number(line.price) || 0);
  const setPresentation = (next: PurchasePresentationOption, overridden = false) => onChange({ ...line, presentation: next, presentationOverridden: overridden });

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Item da compra</p>
          <Button type="button" variant="ghost" size="icon" disabled={!canRemove} onClick={onRemove} aria-label="Remover item"><Trash2 className="h-4 w-4" /></Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Produto</Label>
            <Select value={line.product_id} onValueChange={value => void onProductChange(value)}>
              <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
              <SelectContent>{products.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {requiresVariant && <div className="space-y-2 sm:col-span-2">
            <Label>Variante física</Label>
            <Select value={line.variant_id ?? ''} onValueChange={variantId => void onVariantChange(variantId)}>
              <SelectTrigger><SelectValue placeholder="Variante física obrigatória" /></SelectTrigger>
              <SelectContent>{line.variants.map(variant => <SelectItem key={variant.id} value={variant.id}>{variant.variant_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>}

          <div className="space-y-2 sm:col-span-2">
            <Label>Forma de compra</Label>
            <Select disabled={!identityResolved} value={presentation?.id ?? 'direct'} onOpenChange={open => { if (open && identityResolved) void onLoadPresentations(); }} onValueChange={value => {
              if (value === 'direct') return setPresentation(directPresentation(product, selectedVariant));
              const selected = line.presentations.find(item => item.id === value);
              if (selected) setPresentation({ ...selected, stock_unit_label: canonicalUnit });
            }}>
              <SelectTrigger><SelectValue placeholder={identityResolved ? 'Selecione a forma de compra' : 'Selecione a identidade física primeiro'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">Unidade direta (1 = 1)</SelectItem>
                {line.presentations.map(item => <SelectItem key={item.id} value={item.id!}>{item.name}{item.is_approximate ? ' (aproximada)' : ''}</SelectItem>)}
              </SelectContent>
            </Select>
            {identityResolved && <p className="text-xs text-muted-foreground">Apresentações são referências. O ajuste abaixo vale somente para esta compra.</p>}
          </div>

          {presentation && identityResolved && <div className="space-y-3 rounded-md border p-3 sm:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-sm font-medium">Ajustar somente nesta compra</p><p className="text-xs text-muted-foreground">Não altera a apresentação cadastrada no Estoque.</p></div>
              <Switch checked={line.presentationOverridden} onCheckedChange={checked => onChange({ ...line, presentationOverridden: checked })} />
            </div>
            {line.presentationOverridden && <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label>Unidade de compra</Label><Input value={presentation.purchase_unit_label} onChange={event => setPresentation({ ...presentation, purchase_unit_label: event.target.value }, true)} /></div>
              <div className="space-y-2"><Label>Unidade física de controle</Label><Input value={canonicalUnit} readOnly className="bg-muted" /><p className="text-xs text-muted-foreground">Definida pelo Produto/Variante e usada por Estoque, BOM, Produção e MRP.</p></div>
              <div className="space-y-2"><Label>Conversão usada nesta compra</Label><Input type="number" min="0" step="any" value={presentation.conversion_factor} onChange={event => setPresentation({ ...presentation, conversion_factor: Number(event.target.value) }, true)} /></div>
              <div className="flex items-center justify-between gap-3 rounded-md border p-3"><Label>Conversão aproximada</Label><Switch checked={presentation.is_approximate} onCheckedChange={checked => setPresentation({ ...presentation, is_approximate: checked }, true)} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Observação da compra</Label><Textarea value={presentation.notes ?? ''} onChange={event => setPresentation({ ...presentation, notes: event.target.value }, true)} /></div>
            </div>}
          </div>}

          <div className="space-y-2"><Label>Quantidade</Label><Input type="number" min="0" step="any" value={line.qty} onChange={event => onChange({ ...line, qty: event.target.value })} /></div>
          <div className="space-y-2"><Label>Preço por unidade</Label><Input type="number" min="0" step="any" value={line.price} onChange={event => onChange({ ...line, price: event.target.value })} /></div>
        </div>

        <div className="flex flex-col gap-1 border-t pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          {presentation ? <span className="text-muted-foreground">Referência: {line.qty || 0} × {presentation.conversion_factor}{presentation.is_approximate ? ' ≈' : ''} {canonicalUnit} (não é estoque)</span> : <span />}
          <span className="font-medium">Subtotal: {formatCurrency(subtotal)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
