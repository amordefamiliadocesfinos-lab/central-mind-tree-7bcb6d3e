import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { parseDecimalInput } from '@/lib/decimal';
import { confirmPurchaseWithFinancialEntries } from '@/lib/purchases/confirmPurchaseFinancial';
import type { PurchaseFinancialInstallment } from '@/lib/purchases/purchaseFinancialCondition';
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
import { PurchaseFinancialConditionDialog } from './purchases/PurchaseFinancialConditionDialog';
import {
  PurchaseReceiptDialog,
  type PurchaseReceiptDraftLine,
} from './purchases/PurchaseReceiptDialog';

const db = supabase as any;
const RECEIVABLE_STATUSES: PurchaseStatus[] = ['confirmado', 'em_transito', 'parcialmente_recebido'];

interface MrpPurchaseContext {
  product_name: string;
  operational_qty: string;
  unit: string;
  orders_affected: string[];
}

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
    planning_source: null,
    planning_context: null,
  };
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function presentationIdentityKey(productId: string, variantId: string | null) {
  return `${productId}:${variantId ?? 'simple'}`;
}

function parsePurchaseNumber(value: string) {
  return parseDecimalInput(value, { min: 0, maxDecimals: 10, locale: 'pt-BR' });
}

function requirePurchaseNumber(value: string, label: string) {
  const parsed = parsePurchaseNumber(value);
  if (!parsed) throw new Error(`Informe ${label} em formato numérico válido.`);
  return parsed.number;
}

export function PurchasesTab({ products }: { products: Product[] }) {
  const purchases = usePurchases();
  const { contacts } = useContacts();
  const { locations } = useStorageLocations();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<PurchaseOrder | null>(null);
  const [financialConditionOrder, setFinancialConditionOrder] = useState<PurchaseOrder | null>(null);
  const [supplierId, setSupplierId] = useState('');
  const [expectedAt, setExpectedAt] = useState('');
  const [notes, setNotes] = useState('');
  const [freight, setFreight] = useState('0');
  const [lines, setLines] = useState<PurchaseDraftLine[]>([]);
  const [presentationsByIdentity, setPresentationsByIdentity] = useState<Record<string, PurchasePresentationOption[]>>({});
  const [statusFilter, setStatusFilter] = useState<PurchaseStatus | 'all'>('all');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [mrpContext, setMrpContext] = useState<MrpPurchaseContext | null>(null);

  const mrpProductId = searchParams.get('mrpProductId');
  const mrpVariantId = searchParams.get('mrpVariantId');
  const mrpNeedQty = searchParams.get('mrpNeedQty');
  const mrpUnit = searchParams.get('mrpUnit');
  const mrpName = searchParams.get('mrpName');
  const mrpOrders = searchParams.get('mrpOrders');

  const suppliers = useMemo(
    () => contacts.filter(contact => contact.is_active && (contact.type === 'fornecedor' || contact.type === 'ambos')),
    [contacts],
  );
  const visibleOrders = useMemo(
    () => statusFilter === 'all' ? purchases.orders : purchases.orders.filter(order => order.status === statusFilter),
    [purchases.orders, statusFilter],
  );
  const editingHasConfirmedReceipts = Boolean(editingOrder?.receipts?.some(receipt => receipt.status === 'confirmed'));
  const itemsTotal = useMemo(
    () => lines.reduce((sum, line) => {
      const qty = parsePurchaseNumber(line.qty)?.number ?? 0;
      const price = parsePurchaseNumber(line.price)?.number ?? 0;
      return sum + qty * price;
    }, 0),
    [lines],
  );
  const freightAmount = parsePurchaseNumber(freight)?.number ?? 0;
  const total = itemsTotal + freightAmount;

  const updateLine = (lineId: string, nextLine: PurchaseDraftLine) => {
    setLines(current => current.map(line => line.id === lineId ? nextLine : line));
  };

  const loadVariants = async (lineId: string, productId: string) => {
    const currentLine = lines.find(line => line.id === lineId);
    const identityChanged = Boolean(currentLine && currentLine.product_id !== productId);
    if (identityChanged && currentLine?.planning_source === 'mrp') setMrpContext(null);

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
      ...(line.product_id !== productId ? { planning_source: null, planning_context: null } : {}),
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
    const identityChanged = line.variant_id !== variantId;
    if (identityChanged && line.planning_source === 'mrp') setMrpContext(null);
    const product = products.find(item => item.id === line.product_id);
    setLines(current => current.map(item => item.id === lineId ? {
      ...item,
      variant_id: variantId,
      presentation: directPresentation(product, line.variants.find(item => item.id === variantId)),
      presentationOverridden: false,
      presentations: [],
      ...(identityChanged ? { planning_source: null, planning_context: null } : {}),
    } : item));
    await loadPresentations(lineId, line.product_id, variantId);
  };

  const resetEditor = () => {
    setSupplierId('');
    setExpectedAt('');
    setNotes('');
    setFreight('0');
    setLines([]);
    setEditingOrder(null);
    setMrpContext(null);
  };

  const openEditor = () => {
    resetEditor();
    setEditorOpen(true);
  };

  useEffect(() => {
    if (!mrpProductId || !products.length) return;
    let cancelled = false;

    const prepareFromMrp = async () => {
      const product = products.find(item => item.id === mrpProductId);
      if (!product) {
        toastError('O material indicado pelo MRP não foi encontrado no catálogo de produtos.');
        setSearchParams({ tab: 'purchases' }, { replace: true });
        return;
      }

      let variants: PurchaseVariantOption[] = [];
      if (product.variation_mode === 'variacoes_fisicas') {
        const { data, error } = await db
          .from('product_variants')
          .select('id,variant_name,unit')
          .eq('product_id', mrpProductId)
          .eq('is_active', true);
        if (error) {
          toastError(errorMessage(error, 'Não foi possível carregar a variante indicada pelo MRP.'));
          return;
        }
        variants = (data ?? []) as PurchaseVariantOption[];
      }
      if (cancelled) return;

      const selectedVariantId = mrpVariantId && variants.some(variant => variant.id === mrpVariantId)
        ? mrpVariantId
        : null;
      const operationalUnit = mrpUnit || getPhysicalIdentityUnit(product, variants.find(variant => variant.id === selectedVariantId));
      const ordersAffected = (mrpOrders || '').split('|').filter(Boolean);
      const operationalQty = Number(mrpNeedQty || 0);

      setSupplierId('');
      setExpectedAt('');
      setNotes('');
      setFreight('0');
      setEditingOrder(null);
      setLines([{
        id: crypto.randomUUID(),
        product_id: mrpProductId,
        variant_id: selectedVariantId,
        qty: '',
        price: '',
        presentation: null,
        presentationOverridden: false,
        variants,
        presentations: [],
        planning_source: 'mrp',
        planning_context: {
          operational_qty: operationalQty,
          unit: operationalUnit,
          orders_affected: ordersAffected,
        },
      }]);
      setMrpContext({
        product_name: mrpName || product.name,
        operational_qty: mrpNeedQty || '0',
        unit: operationalUnit,
        orders_affected: ordersAffected,
      });
      setEditorOpen(true);
      setSearchParams({ tab: 'purchases' }, { replace: true });
    };

    void prepareFromMrp();
    return () => { cancelled = true; };
  }, [mrpProductId, mrpVariantId, mrpNeedQty, mrpUnit, mrpName, mrpOrders, products, setSearchParams]);

  const openEdit = async (order: PurchaseOrder) => {
    const hasConfirmedReceipts = (order.receipts ?? []).some(receipt => receipt.status === 'confirmed');
    setMrpContext(null);
    setEditingOrder(order);
    setSupplierId(order.supplier_contact_id);
    setExpectedAt(order.expected_at ?? '');
    setNotes(order.notes ?? '');
    setFreight(String(order.freight_amount ?? 0));
    if (hasConfirmedReceipts) {
      setLines([]);
    } else {
      const restoredLines = await Promise.all((order.items ?? []).map(async item => {
        let variants: PurchaseVariantOption[] = [];
        if (item.product?.variation_mode === 'variacoes_fisicas') {
          const { data } = await db.from('product_variants').select('id,variant_name,unit').eq('product_id', item.product_id).eq('is_active', true);
          variants = (data ?? []) as PurchaseVariantOption[];
        }
        const planningSource = (item as any).planning_source === 'mrp' ? 'mrp' : null;
        const planningContext = planningSource ? (item as any).planning_context ?? null : null;
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
          planning_source: planningSource,
          planning_context: planningContext,
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

        const orderedPurchaseQty = requirePurchaseNumber(line.qty, 'a quantidade');
        if (orderedPurchaseQty <= 0) throw new Error('A quantidade deve ser maior que zero.');
        const unitPrice = line.price === '' ? null : requirePurchaseNumber(line.price, 'o preço por unidade');
        const presentation = line.presentation;
        const canonicalUnit = getPhysicalIdentityUnit(
          product,
          line.variants.find(variant => variant.id === line.variant_id),
        );
        return {
          product_id: line.product_id,
          variant_id: line.variant_id,
          purchase_presentation_id: presentation.id,
          ordered_purchase_qty: orderedPurchaseQty,
          purchase_unit_label: presentation.purchase_unit_label,
          conversion_factor: Number(presentation.conversion_factor),
          stock_unit_label: canonicalUnit,
          unit_price: unitPrice,
          presentation_snapshot: {
            presentation_id: presentation.id,
            name: presentation.name,
            purchase_unit_label: presentation.purchase_unit_label,
            stock_unit_label: canonicalUnit,
            conversion_factor: presentation.conversion_factor,
            is_approximate: presentation.is_approximate,
            notes: presentation.notes || null,
          },
          planning_source: line.planning_source,
          planning_context: line.planning_context,
        };
      });

      const header = {
        ...(hasConfirmedReceipts ? {} : { supplier_contact_id: supplierId }),
        expected_at: expectedAt || null,
        notes: notes || null,
        freight_amount: requirePurchaseNumber(freight || '0', 'o frete'),
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

  const confirmFinancialCondition = async (installments: PurchaseFinancialInstallment[]) => {
    const order = financialConditionOrder;
    if (!order) return;

    const busyKey = `financial-confirm:${order.id}`;
    try {
      setBusyAction(busyKey);
      const result = await confirmPurchaseWithFinancialEntries(order.id, installments);
      await purchases.refetch();
      setFinancialConditionOrder(null);
      toastSuccess(result.already_confirmed
        ? 'Compra já estava confirmada e as obrigações financeiras foram preservadas.'
        : `Compra confirmada e ${result.financial_entry_ids.length} obrigação(ões) financeira(s) criada(s).`);
    } catch (error) {
      toastError(errorMessage(error, 'Não foi possível confirmar a compra e gerar as obrigações financeiras.'));
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

    let items;
    try {
      items = receiptLines
        .map(line => ({
          purchase_order_item_id: line.purchase_order_item_id,
          received_purchase_qty: requirePurchaseNumber(line.received_purchase_qty, 'a quantidade recebida'),
          operational_received_qty: requirePurchaseNumber(line.operational_received_qty, 'a quantidade física recebida'),
        }))
        .filter(line => line.received_purchase_qty > 0);
    } catch (error) {
      return toastError(errorMessage(error, 'Informe quantidades recebidas válidas.'));
    }
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
              busy={busyAction === order.id || busyAction === `financial-confirm:${order.id}`}
              onConfirm={setFinancialConditionOrder}
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
          {mrpContext && !editingOrder && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Preparado pelo MRP:</strong> necessidade física de <strong>{mrpContext.operational_qty} {mrpContext.unit}</strong> de {mrpContext.product_name}.
                {' '}Escolha fornecedor, forma de compra, quantidade comercial e preço. O MRP não tomou essas decisões.
                {mrpContext.orders_affected.length > 0 && <span className="mt-1 block">Demanda relacionada: {mrpContext.orders_affected.join(', ')}.</span>}
              </AlertDescription>
            </Alert>
          )}

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
            <div className="space-y-2">
              <Label>Frete da compra</Label>
              <Input inputMode="decimal" value={freight} onChange={event => setFreight(event.target.value)} placeholder="0,00" />
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

      <PurchaseFinancialConditionDialog
        order={financialConditionOrder}
        open={Boolean(financialConditionOrder)}
        onOpenChange={open => !open && setFinancialConditionOrder(null)}
        onValidated={installments => void confirmFinancialCondition(installments)}
      />

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
