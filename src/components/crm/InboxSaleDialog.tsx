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
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { createUnifiedSale, SalePaymentStatus } from '@/lib/unifiedSales';

interface SaleItem {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  unit_price: number;
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
  const [marketplaceAccount, setMarketplaceAccount] = useState('');
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [variants, setVariants] = useState<Array<{ id: string; product_id: string; variant_name: string; sku: string; price_override: number | null }>>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const saleRequestKeyRef = useRef<string | null>(null);

  const subtotal = useMemo(() => items.reduce((acc, item) => acc + (item.quantity || 0) * (item.unit_price || 0), 0), [items]);
  const total = Math.max(0, subtotal - discount + shipping);

  useEffect(() => {
    if (!open) return;
    supabase.from('financial_accounts').select('id,name').eq('is_active', true).order('name')
      .then(({ data }) => setAccounts(data || []));
    (supabase as any).from('product_variants').select('id,product_id,variant_name,sku,price_override').eq('is_active', true).order('variant_name')
      .then(({ data }: any) => setVariants(data || []));
    saleRequestKeyRef.current = crypto.randomUUID();
  }, [open]);

  const addItem = () => setItems((current) => [...current, { product_id: '', variant_id: null, quantity: 1, unit_price: 0 }]);

  const updateItem = (index: number, patch: Partial<SaleItem>) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const pickProduct = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    updateItem(index, { product_id: productId, variant_id: null, unit_price: product?.price ?? 0 });
  };

  const pickVariant = (index: number, variantId: string) => {
    const variant = variants.find((item) => item.id === variantId);
    updateItem(index, { variant_id: variantId || null, unit_price: variant?.price_override ?? items[index]?.unit_price ?? 0 });
  };

  const handleSave = async () => {
    const validItems = items.filter(item => item.product_id && item.quantity > 0);
    if (!validItems.length) return toast.error('Adicione ao menos um produto para registrar a venda.');
    if (paymentStatus === 'pago' && !accountId) return toast.error('Selecione a conta que recebeu o pagamento.');
    setSaving(true);
    try {
      const result = await createUnifiedSale({
        customer_name: contactName, customer_contact: contactHandle || null, contact_id: contactId,
        channel, order_type: orderType, delivery_date: dueDate || null,
        financial_due_date: financialDueDate, notes: notes || null,
        discount_amount: discount, shipping_amount: shipping, payment_status: paymentStatus,
        payment_method: paymentMethod || null, financial_account_id: accountId || null,
        payment_date: paymentStatus === 'pago' ? new Date().toISOString().slice(0, 10) : null,
        marketplace_account: marketplaceAccount || null,
        sale_origin: 'crm_inbox', sale_request_key: saleRequestKeyRef.current,
        crm_order_confirmed: true,
      }, validItems);
      toast.success(result.already_registered
        ? `Venda já registrada · ${result.order_number}`
        : `Venda, operação e financeiro registrados · ${result.order_number}`);
      setItems([]); setNotes(''); setDueDate('');
      setFinancialDueDate(new Date().toISOString().slice(0, 10));
      setPaymentStatus('pendente'); setPaymentMethod(''); setAccountId('');
      setDiscount(0); setShipping(0); setMarketplaceAccount('');
      onOpenChange(false); onCreated?.(); onSaleCreated?.();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Não foi possível registrar a venda completa.');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-4 w-4 text-emerald-600" /> Registrar venda
          </DialogTitle>
          <DialogDescription className="text-xs">
            {contactName} · o pedido entra em Operações e no funil como Fechado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-muted-foreground">Itens da venda</Label>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={addItem}>
                <Plus className="h-3 w-3" /> Adicionar
              </Button>
            </div>
            {items.length === 0 && (
              <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                Nenhum item. Adicione o produto vendido.
              </p>
            )}
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-[minmax(120px,1fr)_minmax(120px,1fr)_64px_88px_32px] items-center gap-1.5">
                <Select value={item.product_id} onValueChange={(v) => pickProduct(index, v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Produto" /></SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id} className="text-xs">{product.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {variants.some((variant) => variant.product_id === item.product_id) ? (
                  <Select value={item.variant_id || '__none__'} onValueChange={(value) => pickVariant(index, value === '__none__' ? '' : value)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Variante" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem variante</SelectItem>
                      {variants.filter((variant) => variant.product_id === item.product_id).map((variant) => (
                        <SelectItem key={variant.id} value={variant.id} className="text-xs">{variant.variant_name} · {variant.sku}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : <div />}
                <Input
                  type="number" inputMode="decimal" className="h-8 text-xs" value={item.quantity}
                  onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                />
                <Input
                  type="number" inputMode="decimal" className="h-8 text-xs" value={item.unit_price}
                  onChange={(e) => updateItem(index, { unit_price: Number(e.target.value) })}
                />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setItems((c) => c.filter((_, i) => i !== index))}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

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
              <Label className="text-[11px] text-muted-foreground">Vencimento financeiro</Label>
              <Input type="date" className="h-9" value={financialDueDate} onChange={e => setFinancialDueDate(e.target.value)} />
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

          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <span>Subtotal {formatCurrency(subtotal)} · desconto {formatCurrency(discount)} · frete {formatCurrency(shipping)}</span>
            <strong>{formatCurrency(total)}</strong>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Observações da venda</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Combinações, forma de pagamento, prazo..." />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5" />}
              Registrar venda
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
