import { useState, useEffect } from 'react';
import { FullScreenDialog } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DecimalInput } from '@/components/ui/decimal-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Calendar, Factory, ExternalLink, Package } from 'lucide-react';
import { Order, OrderItem, Product, OrderType } from '@/hooks/useOrders';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { ContactAutocomplete } from './ContactAutocomplete';

const asRecord = (value: unknown): Record<string, string> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, string> : {};

const maskDocument = (value?: string) => {
  const digits = (value || '').replace(/\D/g, '');
  if (digits.length < 5) return value || '';
  return `${digits.slice(0, 3)}.***.***-${digits.slice(-2)}`;
};

const ORDER_TYPE_LABELS: Record<OrderType, { label: string; icon: typeof Factory; className: string }> = {
  stock: { label: 'Venda de Estoque', icon: Package, className: 'border-green-500 text-green-600' },
  production: { label: 'Produção', icon: Factory, className: 'border-amber-500 text-amber-600' },
};
interface OrderEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  products: Product[];
  orderChannels: Record<string, string>;
  orderStatus: Record<string, { label: string; color: string }>;
  onSave: (orderId: string, updates: Partial<Order>, items: Partial<OrderItem>[]) => Promise<void>;
  onDelete?: (orderId: string) => Promise<void>;
}

export function OrderEditDialog({
  open,
  onOpenChange,
  order,
  products,
  orderChannels,
  orderStatus,
  onSave,
  onDelete,
}: OrderEditDialogProps) {
  const [formData, setFormData] = useState<Partial<Order>>({});
  const [items, setItems] = useState<Partial<OrderItem>[]>([]);
  const [saving, setSaving] = useState(false);
  const [linkedProductionOrders, setLinkedProductionOrders] = useState<any[]>([]);
  const [variants, setVariants] = useState<Array<{ id: string; product_id: string; variant_name: string; sku: string; price_override: number | null }>>([]);

  // Fetch linked production orders
  useEffect(() => {
    if (!order?.id) {
      setLinkedProductionOrders([]);
      return;
    }

    const fetchLinkedOrders = async () => {
      const { data } = await supabase
        .from('production_orders')
        .select('id, order_number, status, target_quantity, product_id, products(name)')
        .eq('source_order_id', order.id);
      
      setLinkedProductionOrders(data || []);
    };

    fetchLinkedOrders();
  }, [order?.id]);

  useEffect(() => {
    if (!open) return;
    (supabase as any).from('product_variants').select('id,product_id,variant_name,sku,price_override').eq('is_active', true).order('variant_name')
      .then(({ data }: any) => setVariants(data || []));
  }, [open]);

  useEffect(() => {
    if (order) {
      setFormData({
        order_number: order.order_number,
        customer_name: order.customer_name,
        customer_contact: order.customer_contact,
        contact_id: order.contact_id,
        channel: order.channel,
        status: order.status,
        order_date: order.order_date,
        due_date: order.due_date,
        notes: order.notes,
      });
      setItems(order.items?.map(i => ({
        id: i.id,
        product_id: i.product_id,
        variant_id: i.variant_id || null,
        quantity: i.quantity,
        unit_price: i.unit_price,
        notes: i.notes,
      })) || []);
    }
  }, [order]);

  const handleSave = async () => {
    if (!order) return;
    setSaving(true);
    await onSave(order.id, formData, items);
    setSaving(false);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!order || !onDelete) return;
    if (confirm('Excluir este pedido?')) {
      await onDelete(order.id);
      onOpenChange(false);
    }
  };

  const addItem = () => {
    setItems([...items, { product_id: '', variant_id: null, quantity: 1, unit_price: 0 }]);
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      (newItems[index] as any).variant_id = null;
      if (product?.price) {
        newItems[index].unit_price = product.price;
      }
    }
    
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return items.reduce((acc, item) => {
      return acc + (item.quantity || 0) * (item.unit_price || 0);
    }, 0);
  };

  if (!order) return null;

  const delivery = asRecord(order.delivery_snapshot);
  const marketplace = asRecord(order.marketplace_metadata);
  const isShopee = order.channel === 'shopee';

  return (
    <FullScreenDialog 
      open={open} 
      onOpenChange={onOpenChange}
      title={`Editar Pedido #${order.order_number || order.id.slice(0, 8)}`}
    >
        <div className="space-y-4 p-4">
          {/* Order Type Badge */}
          {(() => {
            const orderType = order.order_type || 'production';
            const typeInfo = ORDER_TYPE_LABELS[orderType];
            const Icon = typeInfo.icon;
            return (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                <Badge variant="outline" className={`gap-1 ${typeInfo.className}`}>
                  <Icon className="h-3 w-3" />
                  {typeInfo.label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {orderType === 'stock' 
                    ? 'Consumiu do estoque acabado' 
                    : 'Gerou ordens de produção'}
                </span>
              </div>
            );
          })()}

          {isShopee && (
            <Card className="border-emerald-200 bg-emerald-50/40">
              <CardContent className="grid gap-3 pt-4 text-sm md:grid-cols-2">
                <div><Label>Entrega</Label><div className="mt-1 font-medium">{delivery.recipient_name || order.customer_name || 'Destinatário não informado'}</div><div className="text-muted-foreground">{[delivery.phone || order.customer_contact, delivery.document ? `Documento ${maskDocument(delivery.document)}` : ''].filter(Boolean).join(' · ')}</div><div className="text-muted-foreground">{[delivery.address, delivery.number, delivery.complement, delivery.neighborhood, [delivery.city, delivery.state].filter(Boolean).join('/') , delivery.zip_code].filter(Boolean).join(' · ') || 'Endereço não informado'}</div></div>
                <div><Label>Shopee / logística</Label><div className="mt-1 font-medium">Shopee · {marketplace.account || order.marketplace_account || 'Conta não informada'}</div><div className="text-muted-foreground">Usuário: {marketplace.buyer_username || 'Não informado'}</div><div className="text-muted-foreground">Rastreio: {marketplace.tracking_number || 'Não informado'}</div><div className="text-muted-foreground">Pagamento: {marketplace.paid_at || 'Não informado'} · Envio: {marketplace.shipping_at || order.delivery_date || 'Não informado'}</div></div>
              </CardContent>
            </Card>
          )}

          {/* Editable Order Number */}
          <div>
            <Label>Número do Pedido</Label>
            <Input
              className="h-12 font-medium"
              value={formData.order_number || ''}
              onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
              placeholder="Ex: PED-001"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cliente</Label>
              <ContactAutocomplete
                value={formData.customer_name || ''}
                contactId={formData.contact_id}
                onSelect={(contact, manualName) => {
                  if (contact) {
                    setFormData({ 
                      ...formData, 
                      customer_name: contact.name,
                      contact_id: contact.id,
                      customer_contact: contact.phone || contact.whatsapp || formData.customer_contact,
                    });
                  } else {
                    setFormData({ 
                      ...formData, 
                      customer_name: manualName || '',
                      contact_id: undefined,
                    });
                  }
                }}
                placeholder="Digite o nome do cliente..."
              />
            </div>
            <div>
              <Label>Contato</Label>
              <Input
                className="h-12"
                value={formData.customer_contact || ''}
                onChange={(e) => setFormData({ ...formData, customer_contact: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Canal</Label>
              <Select
                value={formData.channel || 'direto'}
                onValueChange={(v) => setFormData({ ...formData, channel: v })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(orderChannels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={formData.status || 'pendente'}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(orderStatus).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data do Pedido
              </Label>
              <Input
                type="date"
                className="h-12"
                value={formData.order_date || ''}
                onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Data real do movimento (retroativa permitida)
              </p>
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Prazo de Entrega
              </Label>
              <Input
                type="date"
                className="h-12"
                value={formData.due_date || ''}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          {/* Linked Production Orders */}
          {linkedProductionOrders.length > 0 && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Factory className="h-4 w-4 text-primary" />
                  <Label className="text-base font-semibold">Ordens de Produção</Label>
                  <Badge variant="secondary" className="ml-auto">
                    {linkedProductionOrders.length} OP{linkedProductionOrders.length > 1 ? 's' : ''}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {linkedProductionOrders.map((op) => (
                    <div 
                      key={op.id} 
                      className="flex items-center justify-between p-2 bg-background rounded-md border"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm">{op.order_number}</div>
                        <div className="text-xs text-muted-foreground">
                          {(op.products as any)?.name || 'Produto'} • {op.target_quantity} un
                        </div>
                      </div>
                      <Badge 
                        variant={op.status === 'concluido' ? 'default' : 'outline'}
                        className="text-xs"
                      >
                        {op.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Items */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex justify-between items-center mb-3">
                <Label className="text-base font-semibold">Itens</Label>
                <Button size="sm" variant="outline" onClick={addItem}>
                  <Plus className="h-3 w-3 mr-1" />
                  Item
                </Button>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum item adicionado
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="flex gap-2">
                      <Select
                        value={item.product_id || ''}
                        onValueChange={(v) => updateItem(i, 'product_id', v)}
                      >
                        <SelectTrigger className="flex-1 h-10">
                          <SelectValue placeholder="Produto" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {variants.some(variant => variant.product_id === item.product_id) && (
                        <Select
                          value={item.variant_id || '__none__'}
                          onValueChange={(value) => {
                            const variant = variants.find(itemVariant => itemVariant.id === value);
                            updateItem(i, 'variant_id', value === '__none__' ? '' : value);
                            if (variant?.price_override != null) updateItem(i, 'unit_price', variant.price_override);
                          }}
                        >
                          <SelectTrigger className="w-40 h-10"><SelectValue placeholder="Variante" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Sem variante</SelectItem>
                            {variants.filter(variant => variant.product_id === item.product_id).map(variant => (
                              <SelectItem key={variant.id} value={variant.id}>{variant.variant_name} · {variant.sku}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Input
                        type="number"
                        className="w-16 h-10"
                        placeholder="Qtd"
                        value={item.quantity || ''}
                        onChange={(e) => updateItem(i, 'quantity', parseInt(e.target.value) || 1)}
                      />
                      <DecimalInput
                        className="w-24 h-10"
                        placeholder="R$"
                        value={(item as any)._unit_price_text ?? String(item.unit_price ?? '')}
                        onValueChange={(v) => updateItem(i, '_unit_price_text', v)}
                        onValueCommit={(parsed) => updateItem(i, 'unit_price', parsed?.number ?? 0)}
                        min={0}
                        maxDecimals={10}
                      />
                      <Button size="icon" variant="ghost" className="h-10 w-10" onClick={() => removeItem(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between items-center mt-4 pt-3 border-t">
                <span className="font-medium">Total</span>
                <span className="text-xl font-bold">
                  {formatCurrency(calculateTotal())}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1 h-12">
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
            {onDelete && (
              <Button variant="destructive" size="icon" className="h-12 w-12" onClick={handleDelete}>
                <Trash2 className="h-5 w-5" />
              </Button>
            )}
          </div>
      </div>
    </FullScreenDialog>
  );
}
