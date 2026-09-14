import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PurchaseOrder } from '@/hooks/usePurchases';
import type { StorageLocation } from '@/hooks/useStorageLocations';
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

  return (
    <ResponsiveDialog
      open={Boolean(order)}
      onOpenChange={onOpenChange}
      title={order?.internal_purchase_number ? `Confirmar recebimento · ${order.internal_purchase_number}` : 'Confirmar recebimento'}
      description="A confirmação cria a entrada física no estoque pela rotina oficial."
      className="sm:max-w-2xl"
      footer={(
        <Button className="w-full" disabled={busy} onClick={() => void onConfirm(locationId, lines)}>
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
            const projectedReceived = confirmed + (Number(line.received_purchase_qty) || 0);
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
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={line.received_purchase_qty}
                      onChange={event => {
                        const received = event.target.value;
                        updateLine(item.id, {
                          received_purchase_qty: received,
                          ...(line.operationalEdited ? {} : { operational_received_qty: String((Number(received) || 0) * Number(item.conversion_factor)) }),
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantidade operacional ({item.stock_unit_label})</Label>
                    {item.presentation_snapshot?.is_approximate && (
                      <p className="text-xs text-muted-foreground">Previsão aproximada: ≈ {Number(line.received_purchase_qty || 0) * Number(item.conversion_factor)} {item.stock_unit_label}. Confirme a medida física real.</p>
                    )}
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={line.operational_received_qty}
                      onChange={event => updateLine(item.id, { operational_received_qty: event.target.value, operationalEdited: true })}
                    />
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
