import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { PurchaseItem } from '@/hooks/usePurchases';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';

const db = supabase as any;

interface Props {
  item: PurchaseItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface HistoryLine {
  id: string;
  ordered_purchase_qty: number;
  purchase_unit_label: string;
  stock_unit_label: string;
  conversion_factor: number;
  unit_price: number | null;
  presentation_snapshot: any;
  order: {
    id: string;
    status: string;
    ordered_at: string | null;
    created_at: string;
    expected_at: string | null;
    supplier_contact_id: string;
    supplier?: { name: string } | null;
    receipts?: Array<{
      status: string;
      confirmed_at: string | null;
      received_at: string | null;
    }>;
  } | null;
}

interface SupplierMetric {
  key: string;
  supplierName: string;
  presentationName: string;
  purchaseUnitLabel: string;
  stockUnitLabel: string;
  isApproximate: boolean;
  observations: number;
  lastCommercialPrice: number;
  lastPhysicalPrice: number;
  averagePhysicalPrice: number;
  variationPct: number | null;
  averageLeadDays: number | null;
  averageDeliveryDeviationDays: number | null;
  lastDate: string;
}

function dayDiff(from: string, to: string) {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return (end - start) / 86_400_000;
}

function formatDays(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} d`;
}

function formatDeviation(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  const signal = value > 0 ? '+' : '';
  return `${signal}${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} d`;
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  const signal = value > 0 ? '+' : '';
  return `${signal}${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function latestConfirmedReceipt(order: HistoryLine['order']) {
  if (!order || order.status !== 'recebido') return null;
  const timestamps = (order.receipts ?? [])
    .filter(receipt => receipt.status === 'confirmed')
    .map(receipt => receipt.confirmed_at ?? receipt.received_at)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  return timestamps.length ? timestamps[timestamps.length - 1] : null;
}

export function PurchaseItemSupplierIntelligenceDialog({ item, open, onOpenChange }: Props) {
  const [history, setHistory] = useState<HistoryLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !item) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      let query = db
        .from('purchase_order_items')
        .select(`
          id,
          ordered_purchase_qty,
          purchase_unit_label,
          stock_unit_label,
          conversion_factor,
          unit_price,
          presentation_snapshot,
          order:purchase_orders!purchase_order_items_purchase_order_id_fkey(
            id,
            status,
            ordered_at,
            created_at,
            expected_at,
            supplier_contact_id,
            supplier:contacts!purchase_orders_supplier_contact_id_fkey(name),
            receipts:purchase_receipts(status,confirmed_at,received_at)
          )
        `)
        .eq('product_id', item.product_id);

      query = item.variant_id ? query.eq('variant_id', item.variant_id) : query.is('variant_id', null);
      const { data, error: queryError } = await query;
      if (cancelled) return;
      if (queryError) {
        setError(queryError.message || 'Não foi possível carregar o histórico de compras.');
        setHistory([]);
      } else {
        setHistory((data ?? []) as HistoryLine[]);
      }
      setLoading(false);
    };

    void load();
    return () => { cancelled = true; };
  }, [open, item?.product_id, item?.variant_id]);

  const metrics = useMemo<SupplierMetric[]>(() => {
    const valid = history.filter(line => {
      if (!line.order || line.order.status === 'rascunho' || line.order.status === 'cancelado') return false;
      const price = Number(line.unit_price);
      const factor = Number(line.conversion_factor);
      const qty = Number(line.ordered_purchase_qty);
      return Number.isFinite(price) && price >= 0 && Number.isFinite(factor) && factor > 0 && Number.isFinite(qty) && qty > 0;
    });

    const groups = new Map<string, HistoryLine[]>();
    valid.forEach(line => {
      const order = line.order!;
      const presentationName = line.presentation_snapshot?.name ?? line.purchase_unit_label;
      const key = [order.supplier_contact_id, presentationName, Number(line.conversion_factor)].join(':');
      const entries = groups.get(key) ?? [];
      entries.push(line);
      groups.set(key, entries);
    });

    return Array.from(groups.entries()).map(([key, entries]) => {
      const sorted = [...entries].sort((a, b) => {
        const aDate = a.order?.ordered_at ?? a.order?.created_at ?? '';
        const bDate = b.order?.ordered_at ?? b.order?.created_at ?? '';
        return new Date(aDate).getTime() - new Date(bDate).getTime();
      });
      const last = sorted[sorted.length - 1];
      const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
      const lastPrice = Number(last.unit_price);
      const lastFactor = Number(last.conversion_factor);
      const lastPhysicalPrice = lastPrice / lastFactor;
      const previousPhysicalPrice = previous ? Number(previous.unit_price) / Number(previous.conversion_factor) : null;
      const variationPct = previousPhysicalPrice && previousPhysicalPrice > 0
        ? ((lastPhysicalPrice - previousPhysicalPrice) / previousPhysicalPrice) * 100
        : null;
      const totalSpend = sorted.reduce((sum, line) => sum + Number(line.ordered_purchase_qty) * Number(line.unit_price), 0);
      const totalPhysicalQty = sorted.reduce((sum, line) => sum + Number(line.ordered_purchase_qty) * Number(line.conversion_factor), 0);

      const uniqueOrders = new Map<string, HistoryLine['order']>();
      sorted.forEach(line => { if (line.order) uniqueOrders.set(line.order.id, line.order); });
      const leadTimes: number[] = [];
      const deviations: number[] = [];
      uniqueOrders.forEach(order => {
        if (!order?.ordered_at) return;
        const finalReceipt = latestConfirmedReceipt(order);
        if (!finalReceipt) return;
        const lead = dayDiff(order.ordered_at, finalReceipt);
        if (lead !== null && lead >= 0) leadTimes.push(lead);
        if (order.expected_at) {
          const deviation = dayDiff(`${order.expected_at}T00:00:00`, finalReceipt);
          if (deviation !== null) deviations.push(deviation);
        }
      });

      return {
        key,
        supplierName: last.order?.supplier?.name ?? 'Fornecedor sem nome',
        presentationName: last.presentation_snapshot?.name ?? last.purchase_unit_label,
        purchaseUnitLabel: last.purchase_unit_label,
        stockUnitLabel: last.stock_unit_label,
        isApproximate: Boolean(last.presentation_snapshot?.is_approximate),
        observations: sorted.length,
        lastCommercialPrice: lastPrice,
        lastPhysicalPrice,
        averagePhysicalPrice: totalPhysicalQty > 0 ? totalSpend / totalPhysicalQty : 0,
        variationPct,
        averageLeadDays: leadTimes.length ? leadTimes.reduce((sum, value) => sum + value, 0) / leadTimes.length : null,
        averageDeliveryDeviationDays: deviations.length ? deviations.reduce((sum, value) => sum + value, 0) / deviations.length : null,
        lastDate: last.order?.ordered_at ?? last.order?.created_at ?? '',
      };
    }).sort((a, b) => a.lastPhysicalPrice - b.lastPhysicalPrice || a.supplierName.localeCompare(b.supplierName, 'pt-BR'));
  }, [history]);

  const title = item
    ? `Fornecedores — ${item.product?.name ?? 'Produto'}${item.variant ? ` · ${item.variant.variant_name}` : ''}`
    : 'Inteligência de fornecedores';

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={title} className="sm:max-w-6xl" scrollable>
      <div className="space-y-4 p-1">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Comparação baseada em compras reais. O preço equivalente físico é o preço comercial dividido pela conversão registrada na compra. Conversões aproximadas continuam aproximadas. Frete ainda não é rateado por item.
          </AlertDescription>
        </Alert>

        {loading ? (
          <div className="space-y-2">{[0, 1, 2].map(index => <Skeleton key={index} className="h-12 w-full" />)}</div>
        ) : error ? (
          <p className="py-6 text-center text-sm text-destructive">{error}</p>
        ) : metrics.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Ainda não há histórico comercial confiável para este item.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Apresentação</TableHead>
                  <TableHead className="text-right">Histórico</TableHead>
                  <TableHead className="text-right">Último preço</TableHead>
                  <TableHead className="text-right">Equiv. físico</TableHead>
                  <TableHead className="text-right">Média física</TableHead>
                  <TableHead className="text-right">Variação</TableHead>
                  <TableHead className="text-right">Lead time real</TableHead>
                  <TableHead className="text-right">Desvio da previsão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.map(metric => (
                  <TableRow key={metric.key}>
                    <TableCell className="font-medium">{metric.supplierName}</TableCell>
                    <TableCell>
                      <span>{metric.presentationName}</span>
                      <span className="block text-xs text-muted-foreground">{metric.purchaseUnitLabel}{metric.isApproximate ? ' · aprox.' : ''}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{metric.observations}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(metric.lastCommercialPrice)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(metric.lastPhysicalPrice)} / {metric.stockUnitLabel}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(metric.averagePhysicalPrice)} / {metric.stockUnitLabel}</TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-1 font-mono">
                        {metric.variationPct !== null && metric.variationPct > 0 && <TrendingUp className="h-3.5 w-3.5" />}
                        {metric.variationPct !== null && metric.variationPct < 0 && <TrendingDown className="h-3.5 w-3.5" />}
                        {formatPercent(metric.variationPct)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatDays(metric.averageLeadDays)}</TableCell>
                    <TableCell className="text-right font-mono">{formatDeviation(metric.averageDeliveryDeviationDays)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Lead time real só usa compras com `ordered_at` registrado e recebimento total confirmado. Compras legadas sem `ordered_at` não são convertidas artificialmente em lead time. Desvio positivo significa recebimento após a data prevista; negativo, antes.
        </p>
      </div>
    </ResponsiveDialog>
  );
}
