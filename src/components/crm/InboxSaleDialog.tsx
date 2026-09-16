import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ShoppingCart, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProductsList } from '@/hooks/useProductsList';
import { getInventoryBalanceByIdentity, useInventorySync } from '@/hooks/useInventorySync';
import { useAppStore } from '@/stores/appStore';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { createUnifiedSale, SalePaymentStatus } from '@/lib/unifiedSales';
import { OperationalDestinationFields } from '@/components/operations/OperationalDestinationFields';
import { PendingOrderDocumentsFields } from '@/components/operations/PendingOrderDocumentsFields';
import type { OperationalDestination } from '@/lib/orders/operationalDestination';
import { uploadOrderDocument } from '@/lib/orders/orderDocuments';
import type { PendingOrderDocument } from '@/lib/orders/orderDocuments';
import { useCommercialPresentations } from '@/hooks/useCommercialPresentations';
import type { CommercialPresentation } from '@/lib/products/commercialPresentation';
import { buildCommercialOrderItem, getOrderItemLineTotal } from '@/lib/orders/commercialOrderItem';

interface SaleItem {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  unit_price: number;
  commercial_quantity: number;
  commercial_presentation: CommercialPresentation | null;
}

interface InboxSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  contactHandle?: string | null;
  onCreated?: () => void;
  onSaleCreated?: () => void;
}

const CHANNELS: Array<[string, string]> = [
  ['direto', 'Venda Direta'],
  ['whatsapp', 'WhatsApp'],
  ['marketplace', 'Marketplace'],
  ['ecommerce', 'E-commerce'],
  ['social', 'Redes Sociais'],
];

export function InboxSaleDialog({ open, onOpenChange, contactId, contactName, contactHandle, onCreated, onSaleCreated }: InboxSaleDialogProps) {
  const { products } = useProductsList();
  const commercialPresentations = useCommercialPresentations();
  const inventory = useAppStore((state) => state.inventory);
  useInventorySync();
  const [items, setItems] = useState<SaleItem[]>([]);
  const [channel, setChannel] = useState('whatsapp');
  const [orderType, setOrderType] = useState<'stock' | 'production'>('stock');
  const [dueDate, setDueDate] = useState('');
  const [financialDueDate, setFinancialDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentStatus, setPaymentStatus] = useState<SalePaymentStatus>('pendente');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [accountId, setAccountId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [negotiatedTotal, setNegotiatedTotal] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [marketplaceAccount, setMarketplaceAccount] = useState('');
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [variants, setVariants] = useState<Array<{ id: string; product_id: string; variant_name: string; sku: string; price_override: number | null }>>([]);
  const [notes, setNotes] = useState('');
  const [operationalDestination, setOperationalDestination] = useState<OperationalDestination | null>(null);
  const [logisticsMode, setLogisticsMode] = useState('');
  const [operationalDestinationDetails, setOperationalDestinationDetails] = useState<Record<string, unknown>>({});
  const [pendingDocuments, setPendingDocuments] = useState<PendingOrderDocument[]>([]);
  const [presentationsByIdentity, setPresentationsByIdentity] = useState<Record<string, CommercialPresentation[]>>({});
  const [saving, setSaving] = useState(false);
  const saleRequestKeyRef = useRef<string | null>(null);

  const subtotal = useMemo(() => items.reduce((acc, item) => acc + getOrderItemLineTotal(item), 0), [items]);
  const total = Math.max(0, subtotal - discount + shipping);

  useEffect(() => {
    if (!open) return;
    supabase.from('financial_accounts').select('id,name').eq('is_active', true).order('name')
      .then(({ data }) => setAccounts(data || []));
    (supabase as any).from('product_variants').select('id,product_id,variant_name,sku,price_override').eq('is_active', true).order('variant_name')
      .then(({ data }: any) => setVariants(data || []));
    saleRequestKeyRef.current = crypto.randomUUID();
  }, [open]);

  const addItem = () => setItems((current) => [...current, { product_id: '', variant_id: null, quantity: 1, commercial_quantity: 1, unit_price: 0, commercial_presentation: null }]);

  const updateItem = (index: number, patch: Partial<SaleItem>) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const pickProduct = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    updateItem(index, { product_id: productId, variant_id: null, unit_price: product?.price ?? 0, commercial_presentation: null, commercial_quantity: 1 });
  };

  const pickVariant = (index: number, variantId: string) => {
    const variant = variants.find((item) => item.id === variantId);
    updateItem(index, { variant_id: variantId || null, unit_price: variant?.price_override ?? items[index]?.unit_price ?? 0, commercial_presentation: null, commercial_quantity: 1 });
  };

  const presentationKey = (productId: string, variantId: string | null) => `${productId}:${variantId ?? 'direct'}`;
  const loadPresentations = async (productId: string, variantId: string | null) => {
    if (!productId || presentationsByIdentity[presentationKey(productId, variantId)]) return;
    try {
      const data = await commercialPresentations.list(productId, variantId, false);
      setPresentationsByIdentity(current => ({ ...current, [presentationKey(productId, variantId)]: data }));
    } catch (error) { console.error('Erro ao carregar apresentações comerciais', error); }
  };

  useEffect(() => {
    items.forEach((item) => {
      const product = products.find(candidate => candidate.id === item.product_id);
      if (product && (product.variation_mode !== 'variacoes_fisicas' || item.variant_id)) {
        void loadPresentations(item.product_id, item.variant_id ?? null);
      }
    });
  }, [items, products]);

  const getItemStockBalance = (item: SaleItem) => {
    const product = products.find((candidate) => candidate.id === item.product_id);
    if (!product || (product.variation_mode === 'variacoes_fisicas' && !item.variant_id)) return null;
    return getInventoryBalanceByIdentity(inventory, item.product_id, item.variant_id ?? null);
  };

  const formatStockBalance = (item: SaleItem) => {
    const balance = getItemStockBalance(item);
    const product = products.find((candidate) => candidate.id === item.product_id);
    if (balance === null) return '—';
    return `${balance} ${product?.unit || 'un'}`;
  };

  const handleSave = async () => {
    const validItems = items.filter(item => item.product_id && item.quantity > 0);
    if (!validItems.length) return toast.error('Adicione ao menos um produto para registrar a venda.');
    const missingVariant = validItems.map(item => ({ item, product: products.find(product => product.id === item.product_id) }))
      .find(({ item, product }) => product?.variation_mode === 'variacoes_fisicas' && !item.variant_id);
    if (missingVariant?.product) return toast.error(`Selecione a variante física de ${missingVariant.product.name}.`);
    if (paymentStatus === 'pago' && !accountId) return toast.error('Selecione a conta que recebeu o pagamento.');
    setSaving(true);
    try {
      const result = await createUnifiedSale({
        customer_name: contactName, customer_contact: contactHandle || null, contact_id: contactId,
        channel, order_type: orderType, delivery_date: dueDate || null,
        financial_due_date: financialDueDate, notes: notes || null,
        discount_amount: discount, shipping_amount: shipping, payment_status: paymentStatus,
        payment_method: paymentMethod || null, financial_account_id: accountId || null,
        payment_date: paymentStatus === 'pago' ? paymentDate : null,
        marketplace_account: marketplaceAccount || null,
        operational_destination: operationalDestination,
        logistics_mode: logisticsMode,
        operational_destination_details: operationalDestinationDetails,
        sale_origin: 'crm_inbox', sale_request_key: saleRequestKeyRef.current,
        crm_order_confirmed: true,
      }, validItems.map(item => {
        const product = products.find(candidate => candidate.id === item.product_id);
        const variant = item.variant_id ? variants.find(candidate => candidate.id === item.variant_id) : null;
        if (!product) throw new Error('Produto não encontrado.');
        return buildCommercialOrderItem(product, variant, item.commercial_quantity || 0, item.unit_price, item.commercial_presentation);
      }));
      const documentResults = await Promise.allSettled(
        pendingDocuments.map(document => uploadOrderDocument({
          orderId: result.order_id,
          documentType: document.documentType,
          file: document.file,
          source: 'crm_inbox',
        })),
      );
      toast.success(result.already_registered
        ? `Venda já registrada · ${result.order_number}`
        : `Venda, operação e financeiro registrados · ${result.order_number}`);
      if (documentResults.some(result => result.status === 'rejected')) {
        toast.error('Pedido criado, mas um documento não pôde ser anexado.');
      }
      setItems([]); setNotes(''); setDueDate('');
      setFinancialDueDate(new Date().toISOString().slice(0, 10));
      setPaymentStatus('pendente'); setPaymentMethod(''); setAccountId('');
      setDiscount(0); setShipping(0); setMarketplaceAccount('');
      setNegotiatedTotal(''); setPaymentDate(new Date().toISOString().slice(0, 10));
      setOperationalDestination(null); setLogisticsMode(''); setOperationalDestinationDetails({});
      setPendingDocuments([]);
      onOpenChange(false); onCreated?.(); onSaleCreated?.();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Não foi possível registrar a venda completa.');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={nextOpen => { if (!nextOpen) setPendingDocuments([]); onOpenChange(nextOpen); }}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-3xl max-h-[calc(100dvh-1rem)] sm:max-h-[85vh] flex flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-4 py-4 sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-4 w-4 text-emerald-600" /> Registrar venda
          </DialogTitle>
          <DialogDescription className="text-xs">
            {contactName} · o pedido entra em Operações e no funil como Fechado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="space-y-5 pb-4">
          <section className="space-y-3 rounded-xl border bg-muted/20 p-3 sm:p-4">
          <h3 className="text-sm font-semibold">Contexto da venda</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Canal</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Tipo</Label>
              <Select value={orderType} onValueChange={(v) => setOrderType(v as 'stock' | 'production')}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock">Venda de estoque</SelectItem>
                  <SelectItem value="production">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          </section>

          <section className="space-y-3 rounded-xl border p-3 sm:p-4">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Itens</h3><Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={addItem}><Plus className="h-3.5 w-3.5" /> Adicionar item</Button></div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Total negociado</Label>
            <Input type="number" min="0" step="0.01" className="h-9" value={negotiatedTotal} placeholder="Opcional — calcula o desconto" onChange={e => {
              const value = e.target.value;
              setNegotiatedTotal(value);
              if (value === '') return;
              const target = Number(value);
              if (Number.isFinite(target)) setDiscount(Math.max(0, subtotal + shipping - target));
            }} />
            <p className="text-[10px] text-muted-foreground">Mantém o preço unitário base e calcula o desconto para atingir o total combinado.</p>
          </div>

          <div className="space-y-2">
            {items.length === 0 && (
              <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                Nenhum item. Adicione o produto vendido.
              </p>
            )}
            {items.map((item, index) => (
              <div key={index} className="space-y-1">
                <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(120px,1fr)_minmax(120px,1fr)_64px_88px_32px] sm:gap-1.5">
                <Select value={item.product_id} onValueChange={(v) => pickProduct(index, v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Produto" /></SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id} className="text-xs">{product.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {products.find(product => product.id === item.product_id)?.variation_mode === 'variacoes_fisicas' ? (
                  <Select value={item.variant_id || ''} onValueChange={(value) => pickVariant(index, value)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Variante" /></SelectTrigger>
                    <SelectContent>
                      {variants.filter((variant) => variant.product_id === item.product_id).map((variant) => (
                        <SelectItem key={variant.id} value={variant.id} className="text-xs">{variant.variant_name} · {variant.sku}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : <div />}
                <Select value={item.commercial_presentation?.id ?? '__direct__'} onValueChange={(value) => {
                  const presentation = value === '__direct__' ? null : (presentationsByIdentity[presentationKey(item.product_id, item.variant_id ?? null)] ?? []).find(candidate => candidate.id === value) ?? null;
                  updateItem(index, { commercial_presentation: presentation, commercial_quantity: 1 });
                }} disabled={!item.product_id || (products.find(product => product.id === item.product_id)?.variation_mode === 'variacoes_fisicas' && !item.variant_id)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Apresentação" /></SelectTrigger>
                  <SelectContent><SelectItem value="__direct__">Unidade direta</SelectItem>{(presentationsByIdentity[presentationKey(item.product_id, item.variant_id ?? null)] ?? []).map(presentation => <SelectItem key={presentation.id} value={presentation.id}>{presentation.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input
                  type="number" inputMode="decimal" className="h-8 text-xs" value={item.commercial_quantity}
                  onChange={(e) => updateItem(index, { commercial_quantity: Number(e.target.value) })}
                />
                <Input
                  type="number" inputMode="decimal" className="h-8 text-xs" value={item.unit_price}
                  onChange={(e) => updateItem(index, { unit_price: Number(e.target.value) })}
                />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setItems((c) => c.filter((_, i) => i !== index))}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Estoque: {formatStockBalance(item)} · quantidade física: {(item.commercial_quantity || 0) * (item.commercial_presentation?.conversion_factor ?? 1)} {products.find(product => product.id === item.product_id)?.unit ?? 'un'}</p>
              </div>
            ))}
          </div>
          </section>

          <section className="space-y-3 rounded-xl border bg-muted/20 p-3 sm:p-4"><h3 className="text-sm font-semibold">Logística e destino</h3>
          <OperationalDestinationFields
            destination={operationalDestination}
            logisticsMode={logisticsMode}
            details={operationalDestinationDetails}
            onChange={({ destination, logisticsMode: nextLogisticsMode, details }) => {
              setOperationalDestination(destination);
              setLogisticsMode(nextLogisticsMode);
              setOperationalDestinationDetails(details);
            }}
          />
          </section>

          <section className="space-y-3 rounded-xl border p-3 sm:p-4"><h3 className="text-sm font-semibold">Financeiro</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Desconto</Label>
              <Input type="number" min="0" step="0.01" className="h-9" value={discount} onChange={e => setDiscount(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Frete cobrado</Label>
              <Input type="number" min="0" step="0.01" className="h-9" value={shipping} onChange={e => setShipping(Number(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Entrega prevista</Label>
              <Input type="date" className="h-9" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">{paymentStatus === 'pago' ? 'Data do recebimento' : 'Vencimento financeiro'}</Label>
              <Input type="date" className="h-9" value={paymentStatus === 'pago' ? paymentDate : financialDueDate} onChange={e => paymentStatus === 'pago' ? setPaymentDate(e.target.value) : setFinancialDueDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Situação do pagamento</Label>
              <Select value={paymentStatus} onValueChange={v => setPaymentStatus(v as SalePaymentStatus)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="pendente">A receber</SelectItem><SelectItem value="pago">Já recebido</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Forma de pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent><SelectItem value="pix">PIX</SelectItem><SelectItem value="dinheiro">Dinheiro</SelectItem><SelectItem value="cartao">Cartão</SelectItem><SelectItem value="boleto">Boleto</SelectItem><SelectItem value="marketplace">Marketplace</SelectItem></SelectContent>
              </Select>
            </div>
          </div>

          {paymentStatus === 'pago' && <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Conta que recebeu</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
              <SelectContent>{accounts.map(account => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>}

          {(channel === 'marketplace' || paymentMethod === 'marketplace') && <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Conta do marketplace</Label>
            <Input className="h-9" value={marketplaceAccount} onChange={e => setMarketplaceAccount(e.target.value)} placeholder="Ex.: Shopee Viviane" />
          </div>}
          </section>

          <section className="space-y-3 rounded-xl border p-3 sm:p-4"><h3 className="text-sm font-semibold">Documentos</h3>
          <PendingOrderDocumentsFields value={pendingDocuments} onChange={setPendingDocuments} />
          </section>

          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <span>Subtotal {formatCurrency(subtotal)} · desconto {formatCurrency(discount)} · frete {formatCurrency(shipping)}</span>
            <strong>{formatCurrency(total)}</strong>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Observações da venda</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Combinações, forma de pagamento, prazo..." />
          </div>

        </div>
        </div>
        <div className="shrink-0 border-t bg-background px-4 py-3 sm:px-6"><div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button><Button onClick={handleSave} disabled={saving} className="flex-[2] gap-1.5">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}Registrar venda</Button></div></div>
      </DialogContent>
    </Dialog>
  );
}
