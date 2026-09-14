import { PackageCheck, Pencil, Trash2, Truck, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PURCHASE_STATUS_LABEL, type PurchaseItem, type PurchaseOrder } from '@/hooks/usePurchases';
import { formatDisplayDate } from '@/lib/dateUtils';
import { formatCurrency } from '@/lib/utils';

interface PurchaseOrderCardProps {
  order: PurchaseOrder;
  busy: boolean;
  onConfirm: (order: PurchaseOrder) => Promise<void>;
  onMarkInTransit: (order: PurchaseOrder) => Promise<void>;
  onReceive: (order: PurchaseOrder) => void;
  onEdit: (order: PurchaseOrder) => void;
  onDelete: (order: PurchaseOrder) => Promise<void>;
  onCancel: (order: PurchaseOrder) => Promise<void>;
}

export function getConfirmedPurchaseQuantity(order: PurchaseOrder, itemId: string) {
  return (order.receipts ?? [])
    .filter(receipt => receipt.status === 'confirmed')
    .flatMap(receipt => receipt.items ?? [])
    .filter(item => item.purchase_order_item_id === itemId)
    .reduce((total, item) => total + Number(item.received_purchase_qty), 0);
}

function hasConfirmedReceiptForItem(order: PurchaseOrder, itemId: string) {
  return (order.receipts ?? [])
    .filter(receipt => receipt.status === 'confirmed')
    .some(receipt => (receipt.items ?? []).some(item => item.purchase_order_item_id === itemId));
}

function PurchaseOrderLine({ order, item }: { order: PurchaseOrder; item: PurchaseItem }) {
  const received = getConfirmedPurchaseQuantity(order, item.id);
  const pending = Math.max(0, Number(item.ordered_purchase_qty) - received);
  const divergence = received - Number(item.ordered_purchase_qty);
  const hasConfirmedReceipt = hasConfirmedReceiptForItem(order, item.id);
  const subtotal = item.unit_price === null ? null : Number(item.ordered_purchase_qty) * Number(item.unit_price);

  return (
    <div className="space-y-1 rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-medium">
          {item.product?.name ?? 'Produto'}
          {item.variant ? ` · ${item.variant.variant_name}` : ''}
        </p>
        {subtotal !== null && <span className="font-medium">{formatCurrency(subtotal)}</span>}
      </div>
      <p className="text-muted-foreground">
        {item.presentation_snapshot?.name ?? 'Apresentação'}: pedido {item.ordered_purchase_qty} {item.purchase_unit_label}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Pedido: {item.ordered_purchase_qty} {item.purchase_unit_label}</span>
        <span>Recebido: {received} {item.purchase_unit_label}</span>
        <span>Pendente: {pending} {item.purchase_unit_label}</span>
        <span className={hasConfirmedReceipt && divergence !== 0 ? divergence > 0 ? 'text-amber-600' : 'text-destructive' : undefined}>
          Divergência: {hasConfirmedReceipt ? `${divergence > 0 ? '+' : ''}${divergence} ${item.purchase_unit_label}` : '—'}
        </span>
      </div>
    </div>
  );
}

export function PurchaseOrderCard({ order, busy, onConfirm, onMarkInTransit, onReceive, onEdit, onDelete, onCancel }: PurchaseOrderCardProps) {
  const canReceive = ['confirmado', 'em_transito', 'parcialmente_recebido'].includes(order.status);
  const confirmedReceipts = (order.receipts ?? []).filter(receipt => receipt.status === 'confirmed');
  const hasPhysicalReceipt = confirmedReceipts.length > 0;
  const canEdit = !hasPhysicalReceipt || order.status === 'parcialmente_recebido';

  return (
    <Card>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              {order.internal_purchase_number ?? 'Compra'} · {order.supplier?.name ?? 'Fornecedor'}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {order.expected_at ? `Previsão ${formatDisplayDate(order.expected_at)}` : 'Sem previsão informada'}
            </p>
          </div>
          <Badge variant="secondary">{PURCHASE_STATUS_LABEL[order.status]}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="space-y-2">
          {(order.items ?? []).map(item => <PurchaseOrderLine key={item.id} order={order} item={item} />)}
        </div>

        {order.notes && <p className="text-sm text-muted-foreground">Observação: {order.notes}</p>}

        {confirmedReceipts.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium uppercase text-muted-foreground">Histórico de recebimentos</p>
            {confirmedReceipts.map(receipt => (
              <div key={receipt.id} className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span>{receipt.location?.name ?? 'Local não informado'}</span>
                <span>{formatDisplayDate(receipt.confirmed_at ?? receipt.received_at)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {canEdit && <Button size="sm" variant="outline" disabled={busy} onClick={() => onEdit(order)}><Pencil className="mr-1 h-4 w-4" />Editar</Button>}
          {order.status === 'rascunho' && (
            <><Button size="sm" disabled={busy} onClick={() => void onConfirm(order)}>Confirmar compra</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void onDelete(order)}><Trash2 className="mr-1 h-4 w-4" />Excluir</Button></>
          )}
          {order.status === 'confirmado' && (
            <><Button size="sm" variant="outline" disabled={busy} onClick={() => void onMarkInTransit(order)}>
              <Truck className="mr-1 h-4 w-4" />Em trânsito
            </Button>{!hasPhysicalReceipt && <Button size="sm" variant="outline" disabled={busy} onClick={() => void onCancel(order)}><X className="mr-1 h-4 w-4" />Cancelar</Button>}</>
          )}
          {order.status === 'em_transito' && !hasPhysicalReceipt && <Button size="sm" variant="outline" disabled={busy} onClick={() => void onCancel(order)}><X className="mr-1 h-4 w-4" />Cancelar</Button>}
          {canReceive && (
            <Button size="sm" disabled={busy} onClick={() => onReceive(order)}>
              <PackageCheck className="mr-1 h-4 w-4" />Registrar recebimento
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
