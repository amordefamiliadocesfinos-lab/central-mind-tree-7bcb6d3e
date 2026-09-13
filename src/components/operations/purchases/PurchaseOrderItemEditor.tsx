import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import type { Product } from '@/hooks/useOrders';
import type { CreatePurchasePresentationInput } from '@/hooks/usePurchases';

export interface PurchaseVariantOption {
  id: string;
  variant_name: string;
}

export interface PurchasePresentationOption {
  id: string;
  name: string;
  purchase_unit_label: string;
  stock_unit_label: string;
  conversion_factor: number;
  is_approximate: boolean;
}

export interface PurchaseDraftLine {
  id: string;
  product_id: string;
  variant_id: string | null;
  qty: string;
  price: string;
  presentation: PurchasePresentationOption | null;
  variants: PurchaseVariantOption[];
}

interface PurchaseOrderItemEditorProps {
  line: PurchaseDraftLine;
  products: Product[];
  canRemove: boolean;
  onChange: (line: PurchaseDraftLine) => void;
  onProductChange: (productId: string) => Promise<void>;
  onChoosePresentation: () => Promise<void>;
  onCreatePresentation: (input: CreatePurchasePresentationInput) => Promise<PurchasePresentationOption>;
  onRemove: () => void;
}

export function PurchaseOrderItemEditor({
  line,
  products,
  canRemove,
  onChange,
  onProductChange,
  onChoosePresentation,
  onRemove,
}: PurchaseOrderItemEditorProps) {
  const product = products.find(item => item.id === line.product_id);
  const requiresVariant = product?.variation_mode === 'variacoes_fisicas';
  // Produto simples é uma identidade física completa sem variante. Um Mestre
  // só se torna uma identidade comprável após a variante ser escolhida.
  const identityResolved = Boolean(product) && (!requiresVariant || Boolean(line.variant_id));
  const subtotal = (Number(line.qty) || 0) * (Number(line.price) || 0);
  const operationalQuantity = line.presentation
    ? (Number(line.qty) || 0) * Number(line.presentation.conversion_factor)
    : 0;

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Item da compra</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!canRemove}
            onClick={onRemove}
            aria-label="Remover item"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Produto</Label>
            <Select value={line.product_id} onValueChange={value => void onProductChange(value)}>
              <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
              <SelectContent>
                {products.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {requiresVariant && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Variante física</Label>
              <Select
                value={line.variant_id ?? ''}
                onValueChange={variantId => {
                  // A apresentação é específica da identidade física; nunca
                  // pode sobreviver à troca da variante selecionada.
                  onChange({ ...line, variant_id: variantId, presentation: null });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Variante física obrigatória" /></SelectTrigger>
                <SelectContent>
                  {line.variants.map(variant => (
                    <SelectItem key={variant.id} value={variant.id}>{variant.variant_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2 sm:col-span-2">
            <Label>Apresentação</Label>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start font-normal"
              disabled={!identityResolved}
              onClick={() => void onChoosePresentation()}
            >
              {line.presentation ? line.presentation.name : 'Selecionar apresentação existente'}
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Quantidade</Label>
            <Input
              type="number"
              min="0"
              step="any"
              value={line.qty}
              onChange={event => onChange({ ...line, qty: event.target.value })}
              placeholder="Quantidade de compra"
            />
          </div>

          <div className="space-y-2">
            <Label>Preço por unidade</Label>
            <Input
              type="number"
              min="0"
              step="any"
              value={line.price}
              onChange={event => onChange({ ...line, price: event.target.value })}
              placeholder="Preço por unidade"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 border-t pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          {line.presentation ? (
            <span className="text-muted-foreground">
              Previsto: {operationalQuantity} {line.presentation.stock_unit_label} (não é estoque)
            </span>
          ) : <span />}
          <span className="font-medium">Subtotal: {formatCurrency(subtotal)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
