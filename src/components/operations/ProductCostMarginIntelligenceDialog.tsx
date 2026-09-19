import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';

const db = supabase as any;

type CostSource = 'variant_override' | 'latest_purchase' | 'product_cost' | 'missing';

interface Props {
  productId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProductRow {
  id: string;
  name: string;
  price: number | null;
  cost: number | null;
  unit: string | null;
  is_purchased: boolean;
  is_manufactured: boolean;
  variation_mode: string;
}

interface VariantRow {
  id: string;
  variant_name: string;
  unit: string | null;
  cost_override: number | null;
  price_override: number | null;
}

interface BomRow {
  id: string;
  qty_per_unit: number;
  product_variant_id: string | null;
  component_id: string;
  variant_id: string | null;
  component?: { id: string; name: string; cost: number | null; unit: string | null } | null;
  component_variant?: { id: string; variant_name: string; cost_override: number | null; unit: string | null } | null;
}

interface PurchaseHistoryRow {
  product_id: string;
  variant_id: string | null;
  unit_price: number | null;
  conversion_factor: number;
  order?: { status: string; ordered_at: string | null; created_at: string } | null;
}

interface ComponentCostLine {
  key: string;
  name: string;
  qty: number;
  unitCost: number | null;
  totalCost: number | null;
  source: CostSource;
}

interface IdentityCost {
  key: string;
  name: string;
  variantId: string | null;
  salePrice: number | null;
  storedCost: number | null;
  materials: number;
  processes: number;
  optionals: number;
  calculatedCost: number;
  isComplete: boolean;
  missingCount: number;
  grossProfit: number | null;
  grossMarginPct: number | null;
  markupPct: number | null;
  lines: ComponentCostLine[];
  directPurchaseSource: CostSource | null;
}

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveOrNull(value: unknown) {
  const number = numberOrNull(value);
  return number !== null && number > 0 ? number : null;
}

function identityKey(productId: string, variantId: string | null) {
  return `${productId}:${variantId ?? 'simple'}`;
}

function sourceLabel(source: CostSource) {
  if (source === 'variant_override') return 'Override da variante';
  if (source === 'latest_purchase') return 'Última compra';
  if (source === 'product_cost') return 'Custo gravado';
  return 'Sem custo';
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function ProductCostMarginIntelligenceDialog({ productId, open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<ProductRow | null>(null);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [bom, setBom] = useState<BomRow[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryRow[]>([]);
  const [processCost, setProcessCost] = useState(0);
  const [optionalCost, setOptionalCost] = useState(0);

  useEffect(() => {
    if (!open || !productId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      const [productResult, variantResult, bomResult, processResult, optionalResult] = await Promise.all([
        db.from('products').select('id,name,price,cost,unit,is_purchased,is_manufactured,variation_mode').eq('id', productId).single(),
        db.from('product_variants').select('id,variant_name,unit,cost_override,price_override').eq('product_id', productId).eq('is_active', true),
        db.from('product_components').select(`
          id,
          qty_per_unit,
          product_variant_id,
          component_id,
          variant_id,
          component:products!product_components_component_id_fkey(id,name,cost,unit),
          component_variant:product_variants!product_components_variant_id_fkey(id,variant_name,cost_override,unit)
        `).eq('product_id', productId),
        db.from('product_processes').select('cost_per_unit').eq('product_id', productId),
        db.from('product_optional_costs').select('cost_per_unit').eq('product_id', productId).eq('is_active', true),
      ]);

      if (cancelled) return;
      const firstError = productResult.error || variantResult.error || bomResult.error || processResult.error || optionalResult.error;
      if (firstError) {
        setError(firstError.message || 'Não foi possível carregar a composição de custos.');
        setLoading(false);
        return;
      }

      const loadedProduct = productResult.data as ProductRow;
      const loadedVariants = (variantResult.data ?? []) as VariantRow[];
      const loadedBom = (bomResult.data ?? []) as BomRow[];
      const componentIds = Array.from(new Set([productId, ...loadedBom.map(line => line.component_id)]));

      const historyResult = await db
        .from('purchase_order_items')
        .select(`
          product_id,
          variant_id,
          unit_price,
          conversion_factor,
          order:purchase_orders!purchase_order_items_purchase_order_id_fkey(status,ordered_at,created_at)
        `)
        .in('product_id', componentIds);

      if (cancelled) return;
      if (historyResult.error) {
        setError(historyResult.error.message || 'Não foi possível carregar o histórico de compras para os custos.');
        setLoading(false);
        return;
      }

      setProduct(loadedProduct);
      setVariants(loadedVariants);
      setBom(loadedBom);
      setPurchaseHistory((historyResult.data ?? []) as PurchaseHistoryRow[]);
      setProcessCost((processResult.data ?? []).reduce((sum: number, row: any) => sum + (Number(row.cost_per_unit) || 0), 0));
      setOptionalCost((optionalResult.data ?? []).reduce((sum: number, row: any) => sum + (Number(row.cost_per_unit) || 0), 0));
      setLoading(false);
    };

    void load();
    return () => { cancelled = true; };
  }, [open, productId]);

  const latestPurchaseCost = useMemo(() => {
    const map = new Map<string, { cost: number; occurredAt: number }>();
    for (const row of purchaseHistory) {
      if (!row.order || row.order.status === 'rascunho' || row.order.status === 'cancelado') continue;
      const price = positiveOrNull(row.unit_price);
      const factor = positiveOrNull(row.conversion_factor);
      if (price === null || factor === null) continue;
      const occurredAt = new Date(row.order.ordered_at ?? row.order.created_at).getTime();
      if (!Number.isFinite(occurredAt)) continue;
      const key = identityKey(row.product_id, row.variant_id);
      const current = map.get(key);
      if (!current || occurredAt > current.occurredAt) map.set(key, { cost: price / factor, occurredAt });
    }
    return map;
  }, [purchaseHistory]);

  const identities = useMemo<IdentityCost[]>(() => {
    if (!product) return [];

    const outputIdentities: Array<{ variantId: string | null; name: string; salePrice: number | null; storedCost: number | null }> =
      product.variation_mode === 'variacoes_fisicas' && variants.length
        ? variants.map(variant => ({
            variantId: variant.id,
            name: variant.variant_name,
            salePrice: positiveOrNull(variant.price_override) ?? positiveOrNull(product.price),
            storedCost: positiveOrNull(variant.cost_override) ?? positiveOrNull(product.cost),
          }))
        : [{
            variantId: null,
            name: product.name,
            salePrice: positiveOrNull(product.price),
            storedCost: positiveOrNull(product.cost),
          }];

    return outputIdentities.map(identity => {
      if (!product.is_manufactured) {
        const variant = identity.variantId ? variants.find(row => row.id === identity.variantId) : null;
        const variantOverride = positiveOrNull(variant?.cost_override);
        const purchaseCost = latestPurchaseCost.get(identityKey(product.id, identity.variantId))?.cost ?? null;
        const productCost = positiveOrNull(product.cost);
        const calculatedCost = variantOverride ?? purchaseCost ?? productCost ?? 0;
        const source: CostSource = variantOverride !== null
          ? 'variant_override'
          : purchaseCost !== null
            ? 'latest_purchase'
            : productCost !== null
              ? 'product_cost'
              : 'missing';
        const complete = source !== 'missing';
        const grossProfit = complete && identity.salePrice !== null ? identity.salePrice - calculatedCost : null;
        return {
          key: identityKey(product.id, identity.variantId),
          name: identity.name,
          variantId: identity.variantId,
          salePrice: identity.salePrice,
          storedCost: identity.storedCost,
          materials: calculatedCost,
          processes: 0,
          optionals: 0,
          calculatedCost,
          isComplete: complete,
          missingCount: complete ? 0 : 1,
          grossProfit,
          grossMarginPct: grossProfit !== null && identity.salePrice ? (grossProfit / identity.salePrice) * 100 : null,
          markupPct: grossProfit !== null && calculatedCost > 0 ? (grossProfit / calculatedCost) * 100 : null,
          lines: [],
          directPurchaseSource: source,
        };
      }

      const relevantBom = bom.filter(line => identity.variantId ? line.product_variant_id === identity.variantId : line.product_variant_id === null);
      const lines = relevantBom.map<ComponentCostLine>(line => {
        const override = positiveOrNull(line.component_variant?.cost_override);
        const purchaseCost = latestPurchaseCost.get(identityKey(line.component_id, line.variant_id))?.cost ?? null;
        const fallbackCost = positiveOrNull(line.component?.cost);
        const unitCost = override ?? purchaseCost ?? fallbackCost;
        const source: CostSource = override !== null
          ? 'variant_override'
          : purchaseCost !== null
            ? 'latest_purchase'
            : fallbackCost !== null
              ? 'product_cost'
              : 'missing';
        const qty = Number(line.qty_per_unit) || 0;
        return {
          key: line.id,
          name: `${line.component?.name ?? 'Componente'}${line.component_variant ? ` · ${line.component_variant.variant_name}` : ''}`,
          qty,
          unitCost,
          totalCost: unitCost === null ? null : qty * unitCost,
          source,
        };
      });
      const missingCount = lines.filter(line => line.source === 'missing').length + (relevantBom.length === 0 ? 1 : 0);
      const materials = lines.reduce((sum, line) => sum + (line.totalCost ?? 0), 0);
      const calculatedCost = materials + processCost + optionalCost;
      const isComplete = missingCount === 0;
      const grossProfit = isComplete && identity.salePrice !== null ? identity.salePrice - calculatedCost : null;

      return {
        key: identityKey(product.id, identity.variantId),
        name: identity.name,
        variantId: identity.variantId,
        salePrice: identity.salePrice,
        storedCost: identity.storedCost,
        materials,
        processes: processCost,
        optionals: optionalCost,
        calculatedCost,
        isComplete,
        missingCount,
        grossProfit,
        grossMarginPct: grossProfit !== null && identity.salePrice ? (grossProfit / identity.salePrice) * 100 : null,
        markupPct: grossProfit !== null && calculatedCost > 0 ? (grossProfit / calculatedCost) * 100 : null,
        lines,
        directPurchaseSource: null,
      };
    });
  }, [product, variants, bom, latestPurchaseCost, processCost, optionalCost]);

  const title = product ? `Custos e margens — ${product.name}` : 'Custos e margens';

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={title} className="sm:max-w-6xl" scrollable>
      <div className="space-y-4 p-1">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            O custo de referência usa, nesta ordem: override da variante do insumo, última compra comercial válida normalizada por unidade física e custo gravado no cadastro. Para produtos fabricados, soma BOM + processos + custos opcionais ativos. Frete de compra ainda não é rateado por item nesta V1.
          </AlertDescription>
        </Alert>

        {loading ? (
          <div className="space-y-2">{[0, 1, 2].map(index => <Skeleton key={index} className="h-24 w-full" />)}</div>
        ) : error ? (
          <p className="py-6 text-center text-sm text-destructive">{error}</p>
        ) : identities.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Não há identidade física disponível para calcular custo.</p>
        ) : (
          <div className="space-y-4">
            {identities.map(identity => (
              <Card key={identity.key}>
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{identity.name}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {identity.isComplete ? (
                          <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" />Custo completo</Badge>
                        ) : (
                          <Badge variant="destructive">Custo incompleto · {identity.missingCount} pendência(s)</Badge>
                        )}
                        {identity.directPurchaseSource && <Badge variant="outline">Fonte: {sourceLabel(identity.directPurchaseSource)}</Badge>}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-muted-foreground">Preço de venda</p>
                      <p className="font-semibold">{identity.salePrice !== null ? formatCurrency(identity.salePrice) : '—'}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <Metric label="Materiais" value={formatCurrency(identity.materials)} />
                    <Metric label="Processos" value={formatCurrency(identity.processes)} />
                    <Metric label="Opcionais" value={formatCurrency(identity.optionals)} />
                    <Metric label={identity.isComplete ? 'Custo referência' : 'Custo parcial'} value={formatCurrency(identity.calculatedCost)} />
                    <Metric label="Margem bruta" value={formatPercent(identity.grossMarginPct)} muted={!identity.isComplete} />
                    <Metric label="Lucro bruto/un" value={identity.grossProfit !== null ? formatCurrency(identity.grossProfit) : '—'} muted={!identity.isComplete} />
                  </div>

                  <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                    <span>Custo gravado no cadastro: {identity.storedCost !== null ? formatCurrency(identity.storedCost) : '—'}</span>
                    <span>Markup: {formatPercent(identity.markupPct)}</span>
                    <span>{identity.isComplete ? 'Margem calculável com a base atual.' : 'Margem não exibida porque a base de custo está incompleta.'}</span>
                  </div>

                  {identity.lines.length > 0 && (
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Componente</TableHead>
                            <TableHead className="text-right">Qtd/un</TableHead>
                            <TableHead className="text-right">Custo unitário</TableHead>
                            <TableHead className="text-right">Custo no produto</TableHead>
                            <TableHead>Fonte</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {identity.lines.map(line => (
                            <TableRow key={line.key}>
                              <TableCell>{line.name}</TableCell>
                              <TableCell className="text-right font-mono">{line.qty.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}</TableCell>
                              <TableCell className="text-right font-mono">{line.unitCost !== null ? formatCurrency(line.unitCost) : '—'}</TableCell>
                              <TableCell className="text-right font-mono">{line.totalCost !== null ? formatCurrency(line.totalCost) : '—'}</TableCell>
                              <TableCell><Badge variant={line.source === 'missing' ? 'destructive' : 'outline'}>{sourceLabel(line.source)}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Esta visão é analítica e não sobrescreve automaticamente `products.cost`. Margem bruta V1 não inclui taxas de canal, impostos, frete de venda nem rateios gerais; esses elementos permanecem na camada de precificação/Financeiro até terem contrato próprio.
        </p>
      </div>
    </ResponsiveDialog>
  );
}

function Metric({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={muted ? 'mt-1 font-semibold text-muted-foreground' : 'mt-1 font-semibold'}>{value}</p>
    </div>
  );
}
