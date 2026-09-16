import { useMemo, useState } from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  PURCHASE_STATUS_LABEL,
  usePurchases,
  type PurchaseOrder,
  type PurchaseStatus,
} from '@/hooks/usePurchases';
import { useContacts } from '@/hooks/useContacts';
import { useStorageLocations } from '@/hooks/useStorageLocations';
import type { Product } from '@/hooks/useOrders';
import { supabase } from '@/integrations/supabase/client';
import { getPhysicalIdentityUnit } from '@/lib/productVariants';
import { formatCurrency } from '@/lib/utils';
import {
  PurchaseOrderItemEditor,
  directPresentation,
  type PurchaseDraftLine,
  type PurchasePresentationOption,
  type PurchaseVariantOption,
} from './purchases/PurchaseOrderItemEditor';
import { PurchaseOrderCard } from './purchases/PurchaseOrderCard';
import {
  PurchaseReceiptDialog,
  type PurchaseReceiptDraftLine,
} from './purchases/PurchaseReceiptDialog';

const db = supabase as any;
const RECEIVABLE_STATUSES: PurchaseStatus[] = ['confirmado', 'em_transito', 'parcialmente_recebido'];

function createDraftLine(): PurchaseDraftLine {
  return {
    id: crypto.randomUUID(),
    product_id: '',
    variant_id: null,
    qty: '1',
    price: '',
    presentation: null,
    presentationOverridden: false,
    variants: [],
    presentations: [],
  };
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function presentationIdentityKey(productId: string, variantId: string | null) {
  return `${productId}:${variantId ?? 'simple'}`;
}

export function PurchasesTab({ products }: { products: Product[] }) {
  const purchases = usePurchases();
  const { contacts } = useContacts();
  const { locations } = useStorageLocations();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<PurchaseOrder | null>(null);
  const [supplierId, setSupplierId] = useState('');
  const [expectedAt, setExpectedAt] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<PurchaseDraftLine[]>([]);
  const [presentationsByIdentity, setPresentationsByIdentity] = useState<Record<string, PurchasePresentationOption[]>>({});
  const [statusFilter, setStatusFilter] = useState<PurchaseStatus | 'all'>('all');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const suppliers = useMemo(
    () => contacts.filter(contact => contact.is_active && (contact.type === 'fornecedor' || contact.type === 'ambos')),
    [contacts],
  );
  const visibleOrders = useMemo(
    () => statusFilter === 'all' ? purchases.orders : purchases.orders.filter(order => order.status === statusFilter),
    [purchases.orders, statusFilter],
  );
  const editingHasConfirmedReceipts = Boolean(editingOrder?.receipts?.some(receipt => receipt.status === 'confirmed'));
  const total = useMemo(
    () => lines.reduce((sum, line) => sum + (Number(line.qty) || 0) * (Number(line.price) || 0), 0),
    [lines],
  );

  const updateLine = (lineId: string, nextLine: PurchaseDraftLine) => {
    setLines(current => current.map(line => line.id === lineId ? nextLine : line));
  };

  const loadVariants = async (lineId: string, productId: string) => {
    const { data, error } = await db
      .from('product_variants')
      .select('id,variant_name,unit')
      .eq('product_id', productId)
      .eq('is_active', true);
    if (error) throw error;

    setLines(current => current.map(line => line.id === lineId ? {
      ...line,
      product_id: productId,
      variant_id: null,
      presentation: directPresentation(products.find(product => product.id === productId), null),
      presentationOverridden: false,
      variants: (data ?? []) as PurchaseVariantOption[],
      presentations: [],
    } : line));
  };

  const loadPresentations = async (lineId: string, productId: string, variantId: string | null) => {
    if (!productId) return;
    try {
      const key = presentationIdentityKey(productId, variantId);
      let presentations = presentationsByIdentity[key];
      if (!presentations) {
        presentations = await purchases.getPresentations(productId, variantId) as PurchasePresentationOption[];
        setPresentationsByIdentity(current => ({ ...current, [key]: presentations }));
      }
      setLines(current => current.map(line => line.id === lineId ? { ...line, presentations } : line));
    } catch (error) {
      toastError(errorMessage(error, 'Não foi possível carregar as apresentações.'));
    }
  };

  const changeVariant = async (lineId: string, variantId: string) => {
    const line = lines.find(item => item.id === lineId);
    if (!line) return;
    const product = products.find(item => item.id === line.product_id);
    setLines(current => current.map(item => item.id === lineId ? {
      ...item,
      variant_id: variantId,
      presentation: directPresentation(product, line.variants.find(item => item.id === variantId)),
      presentationOverridden: false,
      presentations: [],
    } : item));
    await loadPresentations(lineId, line.product_id, variantId);
  };

  const resetEditor = () => {
    setSupplierId('');
    setExpectedAt('');
    setNotes('');
    setLines([]);
    setEditingOrder(null);
  };

  const openEditor = () => {
    resetEditor();
    setEditorOpen(true);
  };

  const openEdit = async (order: PurchaseOrder) => {
    const hasConfirmedReceipts = (order.receipts ?? []).some(receipt => receipt.status === 'confirmed');
    setEditingOrder(order);
    setSupplierId(order.supplier_contact_id);
    setExpectedAt(order.expected_at ?? '');
    setNotes(order.notes ?? '');
    if (hasConfirmedReceipts) {
      setLines([]);
    } else {
      const restoredLines = await Promise.all((order.items ?? []).map(async item => {
        let variants: PurchaseVariantOption[] = [];
        if (item.product?.variation_mode === 'variacoes_fisicas') {
          const { data } = await db.from('product_variants').select('id,variant_name,unit').eq('product_id', item.product_id).eq('is_active', true);
          variants = (data ?? []) as PurchaseVariantOption[];
        }
        return {
          id: item.id,
          product_id: item.product_id,
          variant_id: item.variant_id,
          qty: String(item.ordered_purchase_qty),
          price: item.unit_price === null ? '' : String(item.unit_price),
          presentation: {
            id: item.purchase_presentation_id,
            name: item.presentation_snapshot?.name ?? 'Apresentação',
            purchase_unit_label: item.purchase_unit_label,
            stock_unit_label: item.stock_unit_label,
            conversion_factor: Number(item.conversion_factor),
            is_approximate: Boolean(item.presentation_snapshot?.is_approximate),
            notes: item.presentation_snapshot?.notes ?? null,
          },
          presentationOverridden: false,
          variants,
          presentations: [],
        } satisfies PurchaseDraftLine;
      }));
      setLines(restoredLines);
    }
    setEditorOpen(true);
  };

  const savePurchase = async () => {
    try {
      setBusyAction('save');
      const hasConfirmedReceipts = (editingOrder?.receipts ?? []).some(receipt => receipt.status === 'confirmed');
      if ((!hasConfirmedReceipts && !supplierId) || (!hasConfirmedReceipts && !lines.length)) throw new Error('Informe fornecedor e ao menos um item.');

      const items = lines.map(line => {
        const product = products.find(item => item.id === line.product_id);
        if (!product) throw new Error('Selecione o produto.');
        if (product.variation_mode === 'variacoes_fisicas' && !line.variant_id) {
          throw new Error('Produto Mestre exige variante física.');
        }
        if (!line.presentation || !Number(line.presentation.conversion_factor) || Number(line.presentation.conversion_factor) <= 0) {
          throw new Error('Informe uma forma de compra com conversão maior que zero.');
        }

        const presentation = line.presentation;
        const canonicalUnit = getPhysicalIdentityUnit(
          product,
          line.variants.find(variant => variant.id === line.variant_id),
        );
        return {
          product_id: line.product_id,
          variant_id: line.variant_id,
          purchase_presentation_id: presentation.id,
          ordered_purchase_qty: Number(line.qty),
          purchase_unit_label: presentation.purchase_unit_label,
          conversion_factor: Number(presentation.conversion_factor),
          stock_unit_label: canonicalUnit,
          unit_price: line.price === '' ? null : Number(line.price),
          presentation_snapshot: {
            presentation_id: presentation.id,
            name: presentation.name,
            purchase_unit_label: presentation.purchase_unit_label,
            stock_unit_label: canonicalUnit,
            conversion_factor: presentation.conversion_factor,
            is_approximate: presentation.is_approximate,
            notes: presentation.notes || null,
          },
        };
      });

      const header = {
        ...(hasConfirmedReceipts ? {} : { supplier_contact_id: supplierId }),
        expected_at: expectedAt || null,
        notes: notes || null,
      };
      if (editingOrder) {
        await purchases.updatePurchase(editingOrder.id, header, hasConfirmedReceipts ? undefined : items);
        toastSuccess('Compra atualizada. Recebimentos físicos foram preservados.');
      } else {
        await purchases.createDraft(header, items);
        toastSuccess('Compra criada. Estoque não foi alterado.');
      }
      setEditorOpen(false);
      resetEditor();
    } catch (error) {
      toastError(errorMessage(error, 'Não foi possível salvar a compra.'));
    } finally {
      setBusyAction(null);
    }
  };

  const changeStatus = async (order: PurchaseOrder, status: PurchaseStatus) => {
    try {
      setBusyAction(order.id);
      await purchases.setStatus(order.id, status);
    } catch (error) {
      toastError(errorMessage(error, 'Não foi possível atualizar a compra.'));
    } finally {
      setBusyAction(null);
    }
  };

  const deleteDraft = async (order: PurchaseOrder) => {
    if (!window.confirm('Excluir este rascunho de compra?')) return;
    try {
      setBusyAction(order.id);
      await purchases.deleteDraft(order.id);
      toastSuccess('Rascunho excluído. Nenhum estoque foi alterado.');
    } catch (error) { toastError(errorMessage(error, 'Não foi possível excluir o rascunho.')); }
    finally { setBusyAction(null); }
  };

  const cancelPurchase = async (order: PurchaseOrder) => {
    if (!window.confirm('Cancelar esta compra?')) return;
    try {
      setBusyAction(order.id);
      await purchases.setStatus(order.id, 'cancelado');
      toastSuccess('Compra cancelada.');
    } catch (error) { toastError(errorMessage(error, 'Esta compra já possui recebimento físico confirmado e não pode ser cancelada sem reversão.')); }
    finally { setBusyAction(null); }
  };

  const confirmReceipt = async (locationId: string, receiptLines: PurchaseReceiptDraftLine[]) => {
    if (!receiptOrder) return;
    if (!locationId) return toastError('Selecione o local de estoque.');

    const items = receiptLines
      .map(line => ({
        purchase_order_item_id: line.purchase_order_item_id,
        received_purchase_qty: Number(line.received_purchase_qty),
        operational_received_qty: Number(line.operational_received_qty),
      }))
      .filter(line => line.received_purchase_qty > 0);
    if (!items.length) return toastError('Informe ao menos uma quantidade recebida.');

    try {
      setBusyAction('receipt');
      const receipt = await purchases.createReceipt({
        purchase_order_id: receiptOrder.id,
        storage_location_id: locationId,
      }, items);
      await purchases.confirmReceipt(receipt.id);
      toastSuccess('Recebimento confirmado e estoque atualizado.');
      setReceiptOrder(null);
    } catch (error) {
      toastError(errorMessage(error, 'Não foi possível confirmar o recebimento.'));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Compras</h2>
          <p className="text-sm text-muted-foreground">Pedidos, trânsito e recebimentos físicos.</p>
        </div>
        <Button onClick={openEditor}><Plus className="mr-1 h-4 w-4" />Nova compra</Button>
      </header>

      <div className="max-w-xs">
        <Label className="sr-only">Filtrar compras por status</Label>
        <Select value={statusFilter} onValueChange={value => setStatusFilter(value as PurchaseStatus | 'all')}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(PURCHASE_STATUS_LABEL).map(([status, label]) => (
              <SelectItem key={status} value={status}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {purchases.loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(item => <Skeleton key={item} className="h-36 w-full" />)}
        </div>
      ) : visibleOrders.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {purchases.orders.length ? 'Nenhuma compra encontrada neste status.' : 'Nenhum pedido de compra registrado.'}
            </p>
            {!purchases.orders.length && <Button className="mt-3" onClick={openEditor}>Nova compra</Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleOrders.map(order => (
            <PurchaseOrderCard
              key={order.id}
              order={order}
              busy={busyAction === order.id}
              onConfirm={current => changeStatus(current, 'confirmado')}
              onMarkInTransit={current => changeStatus(current, 'em_transito')}
              onReceive={setReceiptOrder}
              onEdit={order => void openEdit(order)}
              onDelete={deleteDraft}
              onCancel={cancelPurchase}
            />
          ))}
        </div>
      )}

      <ResponsiveDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        title={editingOrder ? `Editar ${editingOrder.internal_purchase_number ?? 'compra'}` : 'Nova compra'}
        className="sm:max-w-4xl"
        scrollable
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium">Total previsto: {formatCurrency(total)}</p>
            <Button disabled={busyAction === 'save'} onClick={() => void savePurchase()}>
              {busyAction === 'save' ? 'Salvando…' : editingOrder ? 'Salvar alterações' : 'Salvar rascunho'}
            </Button>
          </div>
        )}
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Fornecedor</Label>
              <Select value={supplierId} onValueChange={setSupplierId} disabled={editingHasConfirmedReceipts}>
                <SelectTrigger><SelectValue placeholder="Selecione o fornecedor" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map(supplier => <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Previsão</Label>
              <Input type="date" value={expectedAt} onChange={event => setExpectedAt(event.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Observação</Label>
              <Textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Observação" />
            </div>
          </div>

          {editingOrder && (editingOrder.receipts ?? []).some(receipt => receipt.status === 'confirmed') && (
            <Alert><AlertTriangle className="h-4 w-4" /><AlertDescription>Esta compra já possui recebimento físico confirmado. Apenas previsão e observação podem ser alteradas nesta etapa.</AlertDescription></Alert>
          )}

          {(!editingOrder || !(editingOrder.receipts ?? []).some(receipt => receipt.status === 'confirmed')) && <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Itens</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => setLines(current => [...current, createDraftLine()])}>
                <Plus className="mr-1 h-4 w-4" />Adicionar item
              </Button>
            </div>

            {lines.length === 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Adicione ao menos um item à compra.</AlertDescription>
              </Alert>
            )}

            {lines.map(line => (
              <PurchaseOrderItemEditor
                key={line.id}
                line={line}
                products={products}
                canRemove={lines.length > 0}
                onChange={nextLine => updateLine(line.id, nextLine)}
                onProductChange={productId => loadVariants(line.id, productId).catch(error => toastError(errorMessage(error, 'Não foi possível carregar as variantes.')))}
                onVariantChange={variantId => changeVariant(line.id, variantId)}
                onLoadPresentations={() => loadPresentations(line.id, line.product_id, line.variant_id)}
                onRemove={() => setLines(current => current.filter(item => item.id !== line.id))}
              />
            ))}
          </section>}
        </div>
      </ResponsiveDialog>

      <PurchaseReceiptDialog
        order={receiptOrder}
        locations={locations}
        busy={busyAction === 'receipt'}
        onOpenChange={open => !open && setReceiptOrder(null)}
        onConfirm={confirmReceipt}
      />
    </div>
  );
}

function toastSuccess(message: string) {
  import('sonner').then(({ toast }) => toast.success(message));
}

function toastError(message: string) {
  import('sonner').then(({ toast }) => toast.error(message));
}
