import { useState } from 'react';
import { BarChart3, FileText, PackageCheck, Pencil, Trash2, Truck, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PURCHASE_STATUS_LABEL, type PurchaseItem, type PurchaseOrder } from '@/hooks/usePurchases';
import { formatDisplayDate } from '@/lib/dateUtils';
import { getPurchaseCommercialTotal } from '@/lib/purchases/purchaseFinancialCondition';
import { formatCurrency } from '@/lib/utils';
import { PurchaseDocumentsDialog } from './PurchaseDocumentsDialog';
import { PurchaseItemSupplierIntelligenceDialog } from './PurchaseItemSupplierIntelligenceDialog';

const STATUS_STRIPE: Record<PurchaseOrder['status'], string> = {
  rascunho: 'border-l-slate-500',
  confirmado: 'border-l-blue-600',
  em_transito: 'border-l-amber-500',
  parcialmente_recebido: 'border-l-orange-600',
  recebido: 'border-l-green-600',
  cancelado: 'border-l-red-600',
};

const STATUS_TONE: Record<PurchaseOrder['status'], string> = {
  rascunho: 'border-slate-300 bg-slate-700 text-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
  confirmado: 'border-blue-700 bg-blue-700 text-white dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200',
  em_transito: 'border-amber-600 bg-amber-600 text-white dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
  parcialmente_recebido: 'border-orange-700 bg-orange-700 text-white dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200',
  recebido: 'border-green-700 bg-green-700 text-white dark:border-green-800 dark:bg-green-950 dark:text-green-200',
  cancelado: 'border-red-700 bg-red-700 text-white dark:border-red-800 dark:bg-red-950 dark:text-red-200',
};

interface PurchaseOrderCardProps {
  order: PurchaseOrder;
  busy: boolean;
  onConfirmOrder: (order: PurchaseOrder) => Promise<void> | void;
  onRegisterBilling: (order: PurchaseOrder) => Promise<void> | void;
  onMarkInTransit: (order: PurchaseOrder) => Promise<void>;
  onReceive: (order: PurchaseOrder) => void;
  onFinalizePartial: (order: PurchaseOrder) => void;
  onEdit: (order: PurchaseOrder) => void;
  onDelete: (order: PurchaseOrder) => Promise<void>;
  onCancel: (order: PurchaseOrder) => Promise<void>;
  onRefresh: () => Promise<void>;
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

function PurchaseOrderLine({ order, item, onCompare }: { order: PurchaseOrder; item: PurchaseItem; onCompare: (item: PurchaseItem) => void }) {
  const received = getConfirmedPurchaseQuantity(order, item.id);
  const pending = Math.max(0, Number(item.ordered_purchase_qty) - received);
  const divergence = received - Number(item.ordered_purchase_qty);
  const hasConfirmedReceipt = hasConfirmedReceiptForItem(order, item.id);
  const subtotal = item.unit_price === null ? null : Number(item.ordered_purchase_qty) * Number(item.unit_price);

  return (
    <div className="space-y-3 rounded-lg border-2 border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-950">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-[15px] font-bold leading-snug text-slate-950 dark:text-slate-50">
          {item.product?.name ?? 'Produto'}
          {item.variant ? ` · ${item.variant.variant_name}` : ''}
        </p>
        {subtotal !== null && <span className="text-sm font-bold text-slate-950 dark:text-slate-50">{formatCurrency(subtotal)}</span>}
      </div>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {item.presentation_snapshot?.name ?? 'Apresentação'}: pedido {item.ordered_purchase_qty} {item.purchase_unit_label}
      </p>
      <div className="grid grid-cols-2 gap-2 text-[13px] sm:flex sm:flex-wrap sm:gap-2">
        <span className="rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">Pedido: <strong className="text-foreground">{item.ordered_purchase_qty} {item.purchase_unit_label}</strong></span>
        <span className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100">Recebido: <strong className="text-foreground">{received} {item.purchase_unit_label}</strong></span>
        <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">Pendente: <strong className="text-foreground">{pending} {item.purchase_unit_label}</strong></span>
        <span className={`rounded-md border border-slate-200 bg-slate-100 px-3 py-2 dark:border-slate-700 dark:bg-slate-800 ${hasConfirmedReceipt && divergence !== 0 ? divergence > 0 ? 'text-amber-800 dark:text-amber-300' : 'text-destructive' : 'text-foreground/75'}`}>
          Divergência: {hasConfirmedReceipt ? `${divergence > 0 ? '+' : ''}${divergence} ${item.purchase_unit_label}` : '—'}
        </span>
      </div>
      <Button type="button" size="sm" variant="ghost" className="h-9 px-2 text-[13px] font-medium" onClick={() => onCompare(item)}>
        <BarChart3 className="mr-1 h-3.5 w-3.5" />Comparar fornecedores e preços
      </Button>
    </div>
  );
}

export function PurchaseOrderCard({ order, busy, onConfirmOrder, onRegisterBilling, onMarkInTransit, onReceive, onFinalizePartial, onEdit, onDelete, onCancel, onRefresh }: PurchaseOrderCardProps) {
  const [intelligenceItem, setIntelligenceItem] = useState<PurchaseItem | null>(null);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const canReceive = !order.closure && ['confirmado', 'em_transito', 'parcialmente_recebido'].includes(order.status);
  const confirmedReceipts = (order.receipts ?? []).filter(receipt => receipt.status === 'confirmed');
  const hasPhysicalReceipt = confirmedReceipts.length > 0;
  const canEdit = order.status === 'rascunho';

  return (
    <Card className={`overflow-hidden rounded-xl border-2 border-slate-300 border-l-[7px] bg-white shadow-md dark:border-slate-700 dark:bg-slate-950 ${STATUS_STRIPE[order.status]}`}>
      <CardHeader className="space-y-3 border-b-2 border-slate-700 bg-slate-900 px-4 py-4 text-white dark:border-slate-500 dark:bg-slate-900 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-300">Pedido de compra</p>
            <CardTitle className="text-lg font-extrabold tracking-tight text-white sm:text-xl">
              {order.internal_purchase_number ?? 'Compra'}
            </CardTitle>
            <p className="mt-1 truncate text-[15px] font-semibold text-slate-100">
              {order.supplier?.name ?? 'Fornecedor não informado'}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-200">
              {order.expected_at ? `Previsão ${formatDisplayDate(order.expected_at)}` : 'Sem previsão informada'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={`border px-3 py-1.5 text-[13px] font-bold shadow-none ${STATUS_TONE[order.status]}`}>{PURCHASE_STATUS_LABEL[order.status]}</Badge>
            {order.status !== 'rascunho' && order.status !== 'cancelado' && (
              <Badge variant="outline" className={`px-2.5 py-1 text-xs font-medium ${order.billing_status === 'invoiced' ? 'border-violet-300 bg-violet-700 text-white dark:border-violet-600 dark:bg-violet-700 dark:text-white' : 'border-slate-500 bg-slate-700 text-white dark:border-slate-500 dark:bg-slate-700 dark:text-white'}`}>
                {order.billing_status === 'invoiced' ? 'Faturado' : 'Faturamento pendente'}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 bg-white px-4 pt-4 dark:bg-slate-950 sm:px-5">
        <div className="space-y-3 rounded-lg border-2 border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">Itens do pedido</p>
          {(order.items ?? []).map(item => (
            <PurchaseOrderLine key={item.id} order={order} item={item} onCompare={setIntelligenceItem} />
          ))}
        </div>

        {order.notes && <p className="text-sm text-muted-foreground">Observação: {order.notes}</p>}

        {confirmedReceipts.length > 0 && (
          <div className="space-y-2 rounded-md border-2 border-green-300 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
            <p className="text-xs font-medium uppercase text-muted-foreground">Histórico de recebimentos</p>
            {confirmedReceipts.map(receipt => (
              <div key={receipt.id} className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span>{receipt.location?.name ?? 'Local não informado'}</span>
                <span><span>Recebido: {formatDisplayDate(receipt.received_at ?? receipt.confirmed_at)}</span></span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-xl border-2 border-slate-300 bg-slate-100 p-4 dark:border-slate-600 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            Total da compra: <span className="text-xl font-extrabold text-slate-950 dark:text-white">{formatCurrency(getPurchaseCommercialTotal(order))}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setDocumentsOpen(true)}><FileText className="mr-1 h-4 w-4" />{order.billing_status === 'pending' && order.status !== 'rascunho' ? 'NF / Documentos' : 'Documentos'}</Button>
            {canEdit && <Button size="sm" variant="outline" disabled={busy} onClick={() => onEdit(order)}><Pencil className="mr-1 h-4 w-4" />Editar</Button>}
            {order.status === 'rascunho' && (
              <><Button size="sm" disabled={busy} onClick={() => void onConfirmOrder(order)}>Confirmar pedido</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void onDelete(order)}><Trash2 className="mr-1 h-4 w-4" />Excluir</Button></>
            )}
            {order.status !== 'rascunho' && order.status !== 'cancelado' && order.billing_status === 'pending' && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void onRegisterBilling(order)}>
                Registrar faturamento
              </Button>
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
        </div>

        <PurchaseDocumentsDialog order={order} open={documentsOpen} onOpenChange={setDocumentsOpen} onImported={onRefresh} />
        <PurchaseItemSupplierIntelligenceDialog
          item={intelligenceItem}
          open={Boolean(intelligenceItem)}
          onOpenChange={open => !open && setIntelligenceItem(null)}
        />
      </CardContent>
    </Card>
  );
}
