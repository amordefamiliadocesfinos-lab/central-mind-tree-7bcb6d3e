import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resolveStockLocation } from '@/lib/inventoryOps';
import { notifyInventoryChanged } from '@/hooks/useInventorySync';
import { toast } from 'sonner';
import { createUnifiedSale } from '@/lib/unifiedSales';
import { transitionOrderStatusWithStock } from '@/lib/orderStock';

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  min_stock: number;
  cost: number | null;
  price: number | null;
  is_active: boolean;
  category: string | null;
  attributes: Record<string, unknown>;
  media_urls: string[];
  cover_image_url: string | null;
  expiry_days: number | null;
  height_cm: number | null;
  width_cm: number | null;
  length_cm: number | null;
  weight_g: number | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  location: string | null;
  updated_at: string;
  product?: Product;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  unit_price: number | null;
  notes: string | null;
  product?: Product;
  variant?: { id: string; variant_name: string; sku: string } | null;
}

export type OrderType = 'stock' | 'production';

export interface Order {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  customer_contact: string | null;
  contact_id: string | null;
  channel: string;
  status: string;
  total_value: number | null;
  order_date: string;
  due_date: string | null;
  delivery_date?: string | null;
  financial_due_date?: string | null;
  payment_status?: 'pendente' | 'pago' | 'parcial';
  payment_method?: string | null;
  financial_account_id?: string | null;
  discount_amount?: number;
  shipping_amount?: number;
  channel_account_id?: string | null;
  marketplace_account?: string | null;
  delivery_snapshot?: Record<string, unknown> | null;
  marketplace_metadata?: Record<string, unknown> | null;
  notes: string | null;
  order_type: OrderType;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export interface ProductionNeed {
  product_id: string;
  product: Product;
  ordered: number;
  inStock: number;
  toProduce: number;
}

const ORDER_STATUS = {
  pendente: { label: 'Pendente', color: 'bg-yellow-500' },
  producao: { label: 'Em Produção', color: 'bg-red-500' },
  produzido: { label: 'Produzido', color: 'bg-emerald-600' },
  pronto: { label: 'Pronto', color: 'bg-green-500' },
  enviado: { label: 'Enviado', color: 'bg-blue-500' },
  faturado: { label: 'Faturado', color: 'bg-indigo-600' },
  entregue: { label: 'Entregue', color: 'bg-teal-600' },
  concluido: { label: 'Concluído', color: 'bg-gray-500' },
  cancelado: { label: 'Cancelado', color: 'bg-gray-400' },
};

const ORDER_CHANNELS = {
  direto: 'Venda Direta',
  marketplace: 'Marketplace',
  ecommerce: 'E-commerce',
  social: 'Redes Sociais',
};

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*, product:products(*), variant:product_variants(*))')
        .is('deleted_at', null)
        .order('order_date', { ascending: false });

      if (error) {
        console.error('Error fetching orders:', error);
        return;
      }

      // Transform to match expected format
      const ordersWithItems = (data || []).map(order => ({
        ...order,
        items: order.order_items || [],
      }));

      setOrders(ordersWithItems as Order[]);
    } catch (err) {
      console.error('Error in fetchOrders:', err);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name');

      if (error) {
        console.error('Error fetching products:', error);
        return;
      }

      setProducts((data as Product[]) || []);
    } catch (err) {
      console.error('Error in fetchProducts:', err);
    }
  }, []);

  const deleteProduct = useCallback(async (productId: string) => {
    // Soft delete by setting deleted_at
    const { error } = await supabase
      .from('products')
      .update({ 
        deleted_at: new Date().toISOString(),
        is_active: false 
      })
      .eq('id', productId);

    if (error) {
      toast.error('Erro ao excluir produto');
      return false;
    }

    toast.success('Produto excluído!');
    fetchProducts();
    return true;
  }, [fetchProducts]);

  const fetchInventory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*, product:products(*)');

      if (error) {
        console.error('Error fetching inventory:', error);
        return;
      }

      setInventory((data as InventoryItem[]) || []);
      setLoading(false);
    } catch (err) {
      console.error('Error in fetchInventory:', err);
      setLoading(false);
    }
  }, []);

  const createProduct = useCallback(async (product: Partial<Product>) => {
    const { data, error } = await (supabase
      .from('products')
      .insert({
        sku: product.sku || `SKU-${Date.now()}`,
        name: product.name || 'Novo Produto',
        description: product.description || null,
        unit: product.unit || 'un',
        min_stock: product.min_stock || 0,
        cost: product.cost || null,
        price: product.price || null,
        category: product.category || null,
        attributes: (product.attributes || {}) as any,
        media_urls: (product.media_urls || []) as any,
        cover_image_url: product.cover_image_url || null,
        expiry_days: product.expiry_days || null,
      }) as any)
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar produto');
      return null;
    }

    toast.success('Produto criado!');
    fetchProducts();
    return data as Product;
  }, [fetchProducts]);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    const updateData: any = { ...updates };
    if (updates.attributes) updateData.attributes = updates.attributes;
    if (updates.media_urls) updateData.media_urls = updates.media_urls;
    
    const { error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar produto');
      return;
    }

    toast.success('Produto atualizado!');
    fetchProducts();
  }, [fetchProducts]);

  const updateInventory = useCallback(async (productId: string, quantity: number, location?: string, variantId?: string | null) => {
    const loc = location && location.trim() !== '' ? location : await resolveStockLocation(productId, variantId);
    // Upsert inventory
    const { error } = await supabase
      .from('inventory')
      .upsert({
        product_id: productId,
        variant_id: variantId || null,
        quantity,
        location: loc,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'product_id,variant_id,location',
      });

    if (error) {
      toast.error('Erro ao atualizar estoque');
      return;
    }

    notifyInventoryChanged();
    toast.success('Estoque atualizado!');
    fetchInventory();
  }, [fetchInventory]);

  const createOrder = useCallback(async (order: Partial<Order>, items: Partial<OrderItem>[]) => {
    const pricingData = order as Partial<Order> & { discount_amount?: number; shipping_amount?: number };
    const orderType = order.order_type || 'production';
    try {
      const result = await createUnifiedSale({
        order_number: order.order_number,
        customer_name: order.customer_name,
        customer_contact: order.customer_contact,
        contact_id: order.contact_id,
        channel: order.channel || 'direto',
        order_type: orderType,
        order_date: order.order_date,
        delivery_date: order.delivery_date || order.due_date,
        financial_due_date: order.financial_due_date || order.due_date,
        notes: order.notes,
        discount_amount: pricingData.discount_amount || 0,
        shipping_amount: pricingData.shipping_amount || 0,
        payment_status: order.payment_status || 'pendente',
        payment_method: order.payment_method,
        financial_account_id: order.financial_account_id,
        marketplace_account: order.marketplace_account,
        channel_account_id: order.channel_account_id,
        sale_origin: 'operacoes',
      }, items.map(item => ({
        product_id: item.product_id || '', quantity: item.quantity || 1,
        variant_id: item.variant_id || null,
        unit_price: item.unit_price || 0, notes: item.notes,
      })));
      toast.success('Pedido e financeiro registrados! Estoque será baixado na expedição.');
      fetchOrders();
      return { ...order, id: result.order_id, order_number: result.order_number, total_value: result.total_value } as Order;
    } catch (error: any) {
      console.error('Error creating unified sale:', error);
      toast.error(error?.message || 'Erro ao criar pedido e financeiro');
      return null;
    }
  }, [fetchOrders]);

  const updateOrderStatus = useCallback(async (orderId: string, status: string) => {
    const currentOrder = orders.find(o => o.id === orderId);
    const isChangingToConcluido = status === 'concluido' && currentOrder?.status !== 'concluido';

    try {
      await transitionOrderStatusWithStock(orderId, status);
    } catch (error) {
      console.error('Erro ao atualizar status do pedido:', error);
      toast.error('Erro ao atualizar status');
      return;
    }

    // Ensure financial entry exists for this order (safety check)
    if (currentOrder && (currentOrder.total_value || 0) > 0) {
      const { data: existingEntry } = await supabase
        .from('financial_entries')
        .select('id, value, value_paid')
        .eq('order_id', orderId)
        .maybeSingle();

      if (!existingEntry) {
        // Create entry if it doesn't exist (e.g., legacy orders)
        await supabase
          .from('financial_entries')
          .insert({
            type: 'receber',
            description: `Pedido ${currentOrder.order_number || orderId.slice(0, 8)} - ${currentOrder.customer_name || 'Cliente'}`,
            value: currentOrder.total_value || 0,
            due_date: currentOrder.due_date || new Date().toISOString().split('T')[0],
            order_id: orderId,
            contact_id: currentOrder.contact_id || null,
            notes: `Gerado automaticamente do pedido`,
          });
      }

      // Entry exists or was just created — no auto-payment.
      // User must go to Financeiro > A Receber to register payment manually.
    }

    // Propagate terminal status to linked production orders (OPs)
    if (status === 'cancelado' || status === 'concluido' || status === 'entregue') {
      const { data: linkedOps } = await supabase
        .from('production_orders')
        .select('id, order_number')
        .eq('source_order_id', orderId)
        .not('status', 'in', '("concluido","cancelado")');

      if (linkedOps && linkedOps.length > 0) {
        const isCancel = status === 'cancelado';
        const stamp = new Date().toLocaleString('pt-BR');
        const noteLine = isCancel
          ? `[${stamp}] Cancelada automaticamente — pedido ${currentOrder?.order_number || orderId.slice(0, 8)} cancelado`
          : `[${stamp}] Encerrada automaticamente — pedido ${currentOrder?.order_number || orderId.slice(0, 8)} concluído`;

        await supabase
          .from('production_orders')
          .update({
            status: isCancel ? 'cancelado' : 'concluido',
            completed_at: isCancel ? null : new Date().toISOString(),
            notes: noteLine,
            updated_at: new Date().toISOString(),
          })
          .in('id', linkedOps.map(op => op.id));

        toast.info(`${linkedOps.length} ordem(ns) de produção ${isCancel ? 'cancelada(s)' : 'encerrada(s)'}`);
      }
    }

    toast.success('Status atualizado!');
    fetchOrders();
  }, [fetchOrders, orders]);

  const updateOrder = useCallback(async (
    orderId: string, 
    updates: Partial<Order>, 
    items?: Partial<OrderItem>[]
  ) => {
    // Update order
    const total = items?.reduce((acc, item) => {
      return acc + (item.quantity || 0) * (item.unit_price || 0);
    }, 0) || updates.total_value;

    // Get current order to check if order_number changed
    const currentOrder = orders.find(o => o.id === orderId);
    const orderNumberChanged = updates.order_number && currentOrder?.order_number !== updates.order_number;
    const statusChanged = Boolean(updates.status && updates.status !== currentOrder?.status);

    const { error: orderError } = await supabase
      .from('orders')
      .update({
        order_number: updates.order_number,
        customer_name: updates.customer_name,
        customer_contact: updates.customer_contact,
        contact_id: updates.contact_id,
        channel: updates.channel,
        // A mudança de status é feita pelo contrato após salvar os itens.
        // Assim, editar um pedido para "Enviado" não contorna a baixa idempotente.
        status: statusChanged ? currentOrder?.status : updates.status,
        order_date: updates.order_date,
        due_date: updates.due_date,
        notes: updates.notes,
        total_value: total,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (orderError) {
      toast.error('Erro ao atualizar pedido');
      return;
    }

    // Sync production orders names when order_number changes
    if (orderNumberChanged && updates.order_number) {
      const newOPName = `OP-${updates.order_number}`;
      const { error: opError } = await supabase
        .from('production_orders')
        .update({ order_number: newOPName, updated_at: new Date().toISOString() })
        .eq('source_order_id', orderId);

      if (opError) {
        console.error('Error updating production orders names:', opError);
      }
    }

    // Update items if provided
    if (items) {
      // Delete existing items
      await supabase.from('order_items').delete().eq('order_id', orderId);
      
      // Insert new items
      if (items.length > 0) {
        await supabase.from('order_items').insert(
          items.map(item => ({
            order_id: orderId,
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            quantity: item.quantity || 1,
            unit_price: item.unit_price,
            notes: item.notes,
          }))
        );
      }
    }

    if (statusChanged && updates.status) {
      try {
        await transitionOrderStatusWithStock(orderId, updates.status);
      } catch (error) {
        console.error('Erro ao aplicar estoque na atualização do pedido:', error);
        toast.error('Pedido salvo, mas não foi possível alterar o status por causa do estoque');
        fetchOrders();
        return;
      }
    }

    // Sync financial entry when order value or details change
    const { data: existingFinEntry } = await supabase
      .from('financial_entries')
      .select('id, value_paid')
      .eq('order_id', orderId)
      .maybeSingle();

    if (existingFinEntry && total !== undefined) {
      // Only update if the entry hasn't been fully paid yet
      if (existingFinEntry.value_paid < (total || 0)) {
        await supabase
          .from('financial_entries')
          .update({
            description: `Pedido ${updates.order_number || currentOrder?.order_number || orderId.slice(0, 8)} - ${updates.customer_name || currentOrder?.customer_name || 'Cliente'}`,
            value: total,
            due_date: updates.due_date || currentOrder?.due_date || new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingFinEntry.id);
      }
    }

    // No auto-payment on status change — user handles payment manually in Financeiro > A Receber

    toast.success('Pedido atualizado!');
    fetchOrders();
  }, [fetchOrders, orders]);

  const updateOrderDueDate = useCallback(async (orderId: string, dueDate: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ due_date: dueDate, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (error) {
      toast.error('Erro ao atualizar prazo');
      return;
    }

    toast.success('Prazo atualizado!');
    fetchOrders();
  }, [fetchOrders]);

  const deleteOrder = useCallback(async (orderId: string) => {
    // Soft delete: mantém histórico e evita órfãos em produção/financeiro
    const { error } = await supabase
      .from('orders')
      .update({
        deleted_at: new Date().toISOString(),
        status: 'cancelado',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (error) {
      toast.error('Erro ao excluir pedido');
      return;
    }

    // Cancela OPs vinculadas ainda abertas
    await supabase
      .from('production_orders')
      .update({ status: 'cancelado', updated_at: new Date().toISOString() })
      .eq('source_order_id', orderId)
      .not('status', 'in', '("concluido","cancelado")');

    // Remove cobrança gerada automaticamente se ainda não houve recebimento
    const { data: entry } = await supabase
      .from('financial_entries')
      .select('id, value_paid')
      .eq('order_id', orderId)
      .maybeSingle();

    if (entry && (entry.value_paid || 0) === 0) {
      await supabase.from('financial_entries').delete().eq('id', entry.id);
    }

    toast.success('Pedido excluído!');
    fetchOrders();
  }, [fetchOrders]);

  // Calculate production needs
  const calculateProductionPlan = useCallback((): ProductionNeed[] => {
    const pendingOrders = orders.filter(o => 
      o.status === 'pendente' || o.status === 'producao'
    );

    // Sum quantities by product
    const ordersByProduct: Record<string, number> = {};
    pendingOrders.forEach(order => {
      order.items?.forEach(item => {
        ordersByProduct[item.product_id] = 
          (ordersByProduct[item.product_id] || 0) + item.quantity;
      });
    });

    // Calculate needs
    const needs: ProductionNeed[] = [];
    Object.entries(ordersByProduct).forEach(([productId, ordered]) => {
      const product = products.find(p => p.id === productId);
      if (!product) return;

      const invItem = inventory.find(i => i.product_id === productId);
      const inStock = invItem?.quantity || 0;
      const toProduce = Math.max(0, ordered - inStock);

      needs.push({
        product_id: productId,
        product,
        ordered,
        inStock,
        toProduce,
      });
    });

    return needs.filter(n => n.toProduce > 0);
  }, [orders, products, inventory]);

  // Calculate KPIs
  const calculateKPIs = useCallback(() => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthOrders = orders.filter(o => o.order_date.startsWith(thisMonth));
    
    const totalOrders = monthOrders.length;
    const totalValue = monthOrders.reduce((acc, o) => acc + (o.total_value || 0), 0);
    const avgTicket = totalOrders > 0 ? totalValue / totalOrders : 0;

    const byChannel = monthOrders.reduce((acc, o) => {
      acc[o.channel] = (acc[o.channel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byStatus = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const lowStock = inventory.filter(i => {
      const product = products.find(p => p.id === i.product_id);
      return product && i.quantity <= product.min_stock;
    });

    return {
      totalOrders,
      totalValue,
      avgTicket,
      byChannel,
      byStatus,
      lowStock,
    };
  }, [orders, inventory, products]);

  useEffect(() => {
    // Fetch all data in parallel for better performance
    Promise.all([fetchOrders(), fetchProducts(), fetchInventory()]).catch(err => {
      console.error('Error fetching initial data:', err);
    });

    const channel = supabase
      .channel('orders-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
      }, fetchOrders)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products',
      }, fetchProducts)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'inventory',
      }, fetchInventory)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders, fetchProducts, fetchInventory]);

  return {
    orders,
    products,
    inventory,
    loading,
    createProduct,
    updateProduct,
    deleteProduct,
    updateInventory,
    createOrder,
    updateOrder,
    updateOrderStatus,
    updateOrderDueDate,
    deleteOrder,
    calculateProductionPlan,
    calculateKPIs,
    orderStatus: ORDER_STATUS,
    orderChannels: ORDER_CHANNELS,
    refetch: () => {
      fetchOrders();
      fetchProducts();
      fetchInventory();
    },
  };
}
