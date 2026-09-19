import { useMemo } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { PurchaseOrder } from '@/hooks/usePurchases';
import { formatCurrency } from '@/lib/utils';

interface Props {
  orders: PurchaseOrder[];
}

interface PriceObservation {
  supplierId: string;
  supplierName: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  presentationName: string;
  purchaseUnitLabel: string;
  stockUnitLabel: string;
  isApproximate: boolean;
  conversionFactor: number;
  commercialQty: number;
  unitPrice: number;
  physicalUnitPrice: number;
  occurredAt: string;
}

interface IntelligenceRow {
  key: string;
  supplierName: string;
  productName: string;
  variantName: string | null;
  presentationName: string;
  purchaseUnitLabel: string;
  stockUnitLabel: string;
  isApproximate: boolean;
  purchases: number;
  lastCommercialPrice: number;
  lastPhysicalPrice: number;
  averagePhysicalPrice: number;
  lastVariationPct: number | null;
  lastOccurredAt: string;
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  const signal = value > 0 ? '+' : '';
  return `${signal}${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
}

export function PurchaseSupplierIntelligence({ orders }: Props) {
  const rows = useMemo<IntelligenceRow[]>(() => {
    const observations: PriceObservation[] = [];

    for (const order of orders) {
      if (order.status === 'rascunho' || order.status === 'cancelado') continue;
      const occurredAt = order.ordered_at ?? order.created_at;
      const supplierName = order.supplier?.name ?? 'Fornecedor sem nome';

      for (const item of order.items ?? []) {
        const unitPrice = Number(item.unit_price);
        const conversionFactor = Number(item.conversion_factor);
        const commercialQty = Number(item.ordered_purchase_qty);
        if (!Number.isFinite(unitPrice) || unitPrice < 0) continue;
        if (!Number.isFinite(conversionFactor) || conversionFactor <= 0) continue;
        if (!Number.isFinite(commercialQty) || commercialQty <= 0) continue;

        observations.push({
          supplierId: order.supplier_contact_id,
          supplierName,
          productId: item.product_id,
          variantId: item.variant_id,
          productName: item.product?.name ?? 'Produto',
          variantName: item.variant?.variant_name ?? null,
          presentationName: item.presentation_snapshot?.name ?? item.purchase_unit_label,
          purchaseUnitLabel: item.purchase_unit_label,
          stockUnitLabel: item.stock_unit_label,
          isApproximate: Boolean(item.presentation_snapshot?.is_approximate),
          conversionFactor,
          commercialQty,
          unitPrice,
          physicalUnitPrice: unitPrice / conversionFactor,
          occurredAt,
        });
      }
    }

    const groups = new Map<string, PriceObservation[]>();
    for (const observation of observations) {
      const key = [
        observation.supplierId,
        observation.productId,
        observation.variantId ?? 'simple',
        observation.presentationName,
        observation.conversionFactor,
      ].join(':');
      const current = groups.get(key) ?? [];
      current.push(observation);
      groups.set(key, current);
    }

    return Array.from(groups.entries()).map(([key, entries]) => {
      const sorted = [...entries].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
      const last = sorted[sorted.length - 1];
      const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
      const totalSpend = sorted.reduce((sum, item) => sum + item.commercialQty * item.unitPrice, 0);
      const totalPhysicalQty = sorted.reduce((sum, item) => sum + item.commercialQty * item.conversionFactor, 0);
      const variation = previous && previous.physicalUnitPrice > 0
        ? ((last.physicalUnitPrice - previous.physicalUnitPrice) / previous.physicalUnitPrice) * 100
        : null;

      return {
        key,
        supplierName: last.supplierName,
        productName: last.productName,
        variantName: last.variantName,
        presentationName: last.presentationName,
        purchaseUnitLabel: last.purchaseUnitLabel,
        stockUnitLabel: last.stockUnitLabel,
        isApproximate: last.isApproximate,
        purchases: sorted.length,
        lastCommercialPrice: last.unitPrice,
        lastPhysicalPrice: last.physicalUnitPrice,
        averagePhysicalPrice: totalPhysicalQty > 0 ? totalSpend / totalPhysicalQty : 0,
        lastVariationPct: variation,
        lastOccurredAt: last.occurredAt,
      };
    }).sort((a, b) => {
      const product = `${a.productName} ${a.variantName ?? ''}`.localeCompare(`${b.productName} ${b.variantName ?? ''}`, 'pt-BR');
      if (product !== 0) return product;
      if (a.lastPhysicalPrice !== b.lastPhysicalPrice) return a.lastPhysicalPrice - b.lastPhysicalPrice;
      return a.supplierName.localeCompare(b.supplierName, 'pt-BR');
    });
  }, [orders]);

  if (!rows.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Inteligência de compras</CardTitle>
        <p className="text-xs text-muted-foreground">
          Histórico real por fornecedor × item × apresentação. Comparações usam preço equivalente por unidade física; conversões aproximadas permanecem sinalizadas.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item / apresentação</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead className="text-right">Compras</TableHead>
                <TableHead className="text-right">Último preço</TableHead>
                <TableHead className="text-right">Equiv. físico</TableHead>
                <TableHead className="text-right">Média física</TableHead>
                <TableHead className="text-right">Variação</TableHead>
                <TableHead className="text-right">Último registro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.key}>
                  <TableCell>
                    <div className="min-w-[13rem]">
                      <p className="font-medium">{row.productName}{row.variantName ? ` · ${row.variantName}` : ''}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.presentationName} · {row.purchaseUnitLabel}{row.isApproximate ? ' · conversão aproximada' : ''}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{row.supplierName}</TableCell>
                  <TableCell className="text-right font-mono">{row.purchases}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(row.lastCommercialPrice)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(row.lastPhysicalPrice)} / {row.stockUnitLabel}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(row.averagePhysicalPrice)} / {row.stockUnitLabel}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1 font-mono">
                      {row.lastVariationPct !== null && row.lastVariationPct > 0 && <TrendingUp className="h-3.5 w-3.5" />}
                      {row.lastVariationPct !== null && row.lastVariationPct < 0 && <TrendingDown className="h-3.5 w-3.5" />}
                      {formatPercent(row.lastVariationPct)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm">{formatDate(row.lastOccurredAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="border-t px-4 py-3 text-xs text-muted-foreground">
          Frete ainda não é rateado por item. A data exibida usa `ordered_at` quando existir; registros legados sem essa captura usam apenas a data de criação para ordenar o histórico de preço, não para calcular lead time.
        </div>
      </CardContent>
    </Card>
  );
}
