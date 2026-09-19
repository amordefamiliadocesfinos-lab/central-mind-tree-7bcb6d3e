import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DecimalInput } from '@/components/ui/decimal-input';
import { Label } from '@/components/ui/label';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PurchaseOrder } from '@/hooks/usePurchases';
import type { StorageLocation } from '@/hooks/useStorageLocations';
import { parseDecimalInput } from '@/lib/decimal';
import { getConfirmedPurchaseQuantity } from './PurchaseOrderCard';

export interface PurchaseReceiptDraftLine {
  purchase_order_item_id: string;
  received_purchase_qty: string;
  operational_received_qty: string;
  operationalEdited?: boolean;
}

interface PurchaseReceiptDialogProps {
  order: PurchaseOrder | null;
  locations: StorageLocation[];
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (locationId: string, lines: PurchaseReceiptDraftLine[]) => Promise<void>;
}

function parsePurchaseNumber(value: string) {
  return parseDecimalInput(value, { min: 0, maxDecimals: 10, locale: 'pt-BR' });
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 10 }).format(value);
}

export function PurchaseReceiptDialog({ order, locations, busy, onOpenChange, onConfirm }: PurchaseReceiptDialogProps) {
  const [locationId, setLocationId] = useState('');
  const [lines, setLines] = useState<PurchaseReceiptDraftLine[]>([]);

  useEffect(() => {
    if (!order) {
      setLocationId('');
      setLines([]);
      return;
    }

    setLines((order.items ?? []).map(item => {
      const pending = Math.max(0, Number(item.ordered_purchase_qty) - getConfirmedPurchaseQuantity(order, item.id));
      return {
        purchase_order_item_id: item.id,
        received_purchase_qty: String(pending),
        operational_received_qty: String(pending * Number(item.conversion_factor)),
        operationalEdited: false,
      };
    }));
  }, [order]);

  const itemById = useMemo(() => new Map((order?.items ?? []).map(item => [item.id, item])), [order]);
  const updateLine = (itemId: string, updates: Partial<PurchaseReceiptDraftLine>) => {
    setLines(current => current.map(line => line.purchase_order_item_id === itemId ? { ...line, ...updates } : line));
  };

  const confirmWithNormalizedValues = async () => {
    const normalizedLines = lines.map(line => {
      const received = parsePurchaseNumber(line.received_purchase_qty);
      const operational = parsePurchaseNumber(line.operational_received_qty);
      return {
        ...line,
        received_purchase_qty: received?.normalized ?? '',
        operational_received_qty: operational?.normalized ?? '',
      };
    });
    await onConfirm(locationId, normalizedLines);
  };

  return (
    <ResponsiveDialog
      open={Boolean(order)}
      onOpenChange={onOpenChange}
      title={order?.internal_purchase_number ? `Confirmar recebimento · ${order.internal_purchase_number}` : 'Confirmar recebimento'}
      description="A confirmação cria a entrada física no estoque pela rotina oficial."
      className="sm:max-w-2xl"
      footer={(
        <Button className="w-full" disabled={busy} onClick={() => void confirmWithNormalizedValues()}>
          {busy ? 'Confirmando…' : 'Confirmar recebimento'}
        </Button>
      )}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Local de estoque</Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger><SelectValue placeholder="Selecione o local de estoque" /></SelectTrigger>
            <SelectContent>
              {locations.map(location => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {lines.map(line => {
            const item = itemById.get(line.purchase_order_item_id);
            if (!item) return null;
            const pending = Math.max(0, Number(item.ordered_purchase_qty) - getConfirmedPurchaseQuantity(order as PurchaseOrder, item.id));
            const confirmed = getConfirmedPurchaseQuantity(order as PurchaseOrder, item.id);
            const receivedParsed = parsePurchaseNumber(line.received_purchase_qty);
            const operationalParsed = parsePurchaseNumber(line.operational_received_qty);
            const receivedNumber = receivedParsed?.number ?? 0;
            const operationalReceivedNumber = operationalParsed?.number ?? 0;
            const expectedOperationalQty = receivedNumber * Number(item.conversion_factor);
            const projectedReceived = confirmed + receivedNumber;
            const projectedDivergence = projectedReceived - Number(item.ordered_purchase_qty);
            return (
              <div key={line.purchase_order_item_id} className="space-y-3 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">
                    {item.product?.name ?? 'Produto'}{item.variant ? ` · ${item.variant.variant_name}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">Pendente: {pending} {item.purchase_unit_label}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Quantidade recebida ({item.purchase_unit_label})</Label>
                    <DecimalInput
                      min={0}
                      maxDecimals={10}
                      locale="pt-BR"
                      value={line.received_purchase_qty}
                      onValueChange={received => {
                        const receivedNumber = parsePurchaseNumber(received)?.number ?? 0;
                        updateLine(item.id, {
                          received_purchase_qty: received,
                          ...(line.operationalEdited ? {} : { operational_received_qty: String(receivedNumber * Number(item.conversion_factor)) }),
                        });
                      }}
                      placeholder="Ex.: 8.742"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantidade física recebida ({item.stock_unit_label})</Label>
                    {item.presentation_snapshot?.is_approximate && (
                      <p className="text-xs text-muted-foreground">Previsão aproximada: ≈ {formatQuantity(expectedOperationalQty)} {item.stock_unit_label}. Confirme a medida física real.</p>
                    )}
                    <DecimalInput
                      min={0}
                      maxDecimals={10}
                      locale="pt-BR"
                      value={line.operational_received_qty}
                      onValueChange={value => updateLine(item.id, { operational_received_qty: value, operationalEdited: true })}
                      placeholder="Ex.: 8.742 ou 8.742,5"
                    />
                  </div>
                </div>

                <div className="rounded-md bg-muted/50 p-3 text-sm" aria-label="Resumo do recebimento físico">
                  <p className="font-medium">Conferência antes de confirmar</p>
                  <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                    <p><span className="text-muted-foreground">Comprado:</span> {formatQuantity(Number(item.ordered_purchase_qty))} {item.purchase_unit_label}</p>
                    <p><span className="text-muted-foreground">Conversão prevista:</span> {item.presentation_snapshot?.is_approximate ? '≈ ' : ''}{formatQuantity(expectedOperationalQty)} {item.stock_unit_label}</p>
                    <p><span className="text-muted-foreground">Recebido fisicamente:</span> {operationalParsed ? `${formatQuantity(operationalReceivedNumber)} ${item.stock_unit_label}` : '—'}</p>
                    <p className="font-semibold"><span className="text-muted-foreground font-normal">Entrada no estoque:</span> {operationalParsed ? `+${formatQuantity(operationalReceivedNumber)} ${item.stock_unit_label}` : '—'}</p>
                  </div>
                </div>

                {projectedDivergence > 0 && <p className="text-xs text-amber-600">Este recebimento fará o total recebido ficar {projectedDivergence} {item.purchase_unit_label} acima do pedido. A divergência será preservada no histórico.</p>}
              </div>
            );
          })}
        </div>
      </div>
    </ResponsiveDialog>
  );
}
