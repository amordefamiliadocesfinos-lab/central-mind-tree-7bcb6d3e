import { RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DecimalInput } from '@/components/ui/decimal-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { Product } from '@/hooks/useOrders';
import { parseDecimalInput } from '@/lib/decimal';
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
export interface PurchasePlanningContext {
  operational_qty: number;
  unit: string;
  orders_affected: string[];
  suggested_purchase_qty?: number;
  planned_purchase_qty?: number;
  planned_operational_qty?: number;
  conversion_factor?: number;
  purchase_unit_label?: string;
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
  planning_source: 'mrp' | null;
  planning_context: PurchasePlanningContext | null;
  planning_qty_overridden?: boolean;
  price_reference?: 'last_purchase' | 'canonical_cost' | null;
}

interface Props {
  line: PurchaseDraftLine;
  products: Product[];
  canRemove: boolean;
  onChange: (line: PurchaseDraftLine) => void;
  onProductChange: (productId: string) => Promise<void>;
  onVariantChange: (variantId: string) => Promise<void>;
  onLoadPresentations: () => Promise<void>;
  onPriceReferenceRequested: (line: PurchaseDraftLine) => Promise<void>;
  onRemove: () => void;
}

export function directPresentation(product?: Pick<Product, 'unit'> | null, variant?: Pick<PurchaseVariantOption, 'unit'> | null): PurchasePresentationOption {
  const label = getPhysicalIdentityUnit(product, variant);
  return { id: null, name: 'Unidade direta', purchase_unit_label: label, stock_unit_label: label, conversion_factor: 1, is_approximate: false };
}

function parsePurchaseNumber(value: string) {
  return parseDecimalInput(value, { min: 0, maxDecimals: 10, locale: 'pt-BR' })?.number ?? 0;
}

export function calculateSuggestedPurchaseQty(operationalQty: number, conversionFactor: number) {
  if (!Number.isFinite(operationalQty) || operationalQty <= 0 || !Number.isFinite(conversionFactor) || conversionFactor <= 0) return 0;
  return Number((operationalQty / conversionFactor).toFixed(10));
}

function formatQtyInput(value: number) {
  if (!Number.isFinite(value)) return '';
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 10, useGrouping: false });
}

export function PurchaseOrderItemEditor({ line, products, canRemove, onChange, onProductChange, onVariantChange, onLoadPresentations, onPriceReferenceRequested, onRemove }: Props) {
  const product = products.find(item => item.id === line.product_id);
  const requiresVariant = product?.variation_mode === 'variacoes_fisicas';
  const identityResolved = Boolean(product) && (!requiresVariant || Boolean(line.variant_id));
  const selectedVariant = line.variants.find(item => item.id === line.variant_id);
  const canonicalUnit = getPhysicalIdentityUnit(product, selectedVariant);
  const presentation = line.presentation;
  const subtotal = parsePurchaseNumber(line.qty) * parsePurchaseNumber(line.price);
  const operationalNeed = Number(line.planning_context?.operational_qty || 0);
  const suggestedQty = presentation ? calculateSuggestedPurchaseQty(operationalNeed, Number(presentation.conversion_factor)) : 0;
  const plannedCoverage = presentation ? parsePurchaseNumber(line.qty) * Number(presentation.conversion_factor || 0) : 0;
  const coverageDifference = plannedCoverage - operationalNeed;

  const setPresentation = (next: PurchasePresentationOption, overridden = false) => {
    const suggestion = calculateSuggestedPurchaseQty(operationalNeed, Number(next.conversion_factor));
    const shouldSuggest = line.planning_source === 'mrp' && !line.planning_qty_overridden && suggestion > 0;
    const nextLine: PurchaseDraftLine = {
      ...line,
      presentation: next,
      presentationOverridden: overridden,
      price: '',
      price_reference: null,
      ...(shouldSuggest ? { qty: formatQtyInput(suggestion) } : {}),
    };
    onChange(nextLine);
    void onPriceReferenceRequested(nextLine);
  };

  const reapplyPlanningSuggestion = () => {
    if (!presentation || suggestedQty <= 0) return;
    onChange({ ...line, qty: formatQtyInput(suggestedQty), planning_qty_overridden: false });
  };

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
            <Select disabled={!identityResolved} value={presentation ? (presentation.id ?? 'direct') : '__none__'} onOpenChange={open => { if (open && identityResolved) void onLoadPresentations(); }} onValueChange={value => {
              if (value === 'direct') return setPresentation(directPresentation(product, selectedVariant));
              const selected = line.presentations.find(item => item.id === value);
              if (selected) setPresentation({ ...selected, stock_unit_label: canonicalUnit });
            }}>
              <SelectTrigger><SelectValue placeholder={identityResolved ? 'Selecione a forma de compra' : 'Selecione a identidade física primeiro'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" disabled>Selecione a forma de compra</SelectItem>
                <SelectItem value="direct">Unidade direta (1 = 1)</SelectItem>
                {line.presentations.map(item => <SelectItem key={item.id} value={item.id!}>{item.name}{item.is_approximate ? ' (aproximada)' : ''}</SelectItem>)}
              </SelectContent>
            </Select>
            {identityResolved && <p className="text-xs text-muted-foreground">A forma de compra converte a necessidade física em quantidade comercial. Trocar a apresentação recalcula a sugestão enquanto você não substituir a quantidade manualmente.</p>}
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

          {line.planning_source === 'mrp' && line.planning_context && presentation && <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 sm:col-span-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Sugestão automática do Planejamento</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Necessidade: <strong className="text-foreground">{operationalNeed.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {line.planning_context.unit}</strong>
                  {' '}÷ {Number(presentation.conversion_factor).toLocaleString('pt-BR', { maximumFractionDigits: 10 })} =
                  {' '}<strong className="text-foreground">{suggestedQty.toLocaleString('pt-BR', { maximumFractionDigits: 10 })} {presentation.purchase_unit_label}</strong>.
                </p>
                {parsePurchaseNumber(line.qty) > 0 && <p className="mt-1 text-xs text-muted-foreground">
                  Quantidade escolhida cobre <strong className="text-foreground">{plannedCoverage.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {line.planning_context.unit}</strong>
                  {Math.abs(coverageDifference) > 0.0000001 && <> · diferença {coverageDifference > 0 ? '+' : ''}{coverageDifference.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</>}.
                </p>}
              </div>
              {line.planning_qty_overridden && <Button type="button" size="sm" variant="outline" onClick={reapplyPlanningSuggestion}><RefreshCw className="mr-1 h-3.5 w-3.5" />Reaplicar sugestão</Button>}
            </div>
          </div>}

          <div className="space-y-2">
            <Label>Quantidade</Label>
            <DecimalInput
              min={0}
              maxDecimals={10}
              locale="pt-BR"
              value={line.qty}
              onValueChange={value => onChange({ ...line, qty: value, ...(line.planning_source === 'mrp' ? { planning_qty_overridden: true } : {}) })}
              placeholder="Ex.: 8.742 ou 8.742,5"
            />
          </div>
          <div className="space-y-2">
            <Label>Preço por unidade</Label>
            <DecimalInput
              min={0}
              maxDecimals={10}
              locale="pt-BR"
              value={line.price}
              onValueChange={value => onChange({ ...line, price: value, price_reference: null })}
              placeholder="Ex.: 379,10"
            />
            {line.price_reference === 'last_purchase' && <p className="text-xs text-muted-foreground">Referência automática: último preço válido desta combinação.</p>}
            {line.price_reference === 'canonical_cost' && <p className="text-xs text-muted-foreground">Referência automática: custo físico canônico por unidade de estoque.</p>}
          </div>
        </div>

        <div className="flex flex-col gap-1 border-t pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          {presentation ? <span className="text-muted-foreground">Referência: {line.qty || 0} × {presentation.conversion_factor}{presentation.is_approximate ? ' ≈' : ''} {canonicalUnit} (não é estoque)</span> : <span />}
          <span className="font-medium">Subtotal: {formatCurrency(subtotal)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
