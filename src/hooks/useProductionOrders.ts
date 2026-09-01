import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useBOM } from './useBOM';
import { applyStockDelta } from '@/lib/inventoryOps';
import { PhysicalIdentityError, resolvePhysicalIdentity } from '@/lib/products/physicalIdentity';

export interface ProductionOrderProcess {
  id: string;
  production_order_id: string;
  process_id: string;
  is_required: boolean;
  created_at: string;
  process?: {
    id: string;
    name: string;
    value_per_unit: number;
  };
}

export interface ProductionEntry {
  id: string;
  production_order_id: string;
  process_id: string;
  employee_name: string;
  date: string;
  period: string;
  quantity: number;
  value_per_unit: number;
  total_value: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  process?: {
    id: string;
    name: string;
  };
}

export interface ProductionOrder {
  id: string;
  order_number: string | null;
  product_id: string | null;
  variant_id: string | null;
  batch_code: string | null;
  target_quantity: number;
  consolidated_quantity: number;
  status: string;
  notes: string | null;
  source_order_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  scheduled_date: string | null;
  product?: {
    id: string;
    name: string;
    sku: string;
  };
  variant?: {
    id: string;
    variant_name: string;
    sku: string;
  } | null;
  source_order?: {
    id: string;
    order_number: string | null;
    customer_name: string | null;
    due_date: string | null;
  } | null;
  processes?: ProductionOrderProcess[];
  entries?: ProductionEntry[];
}


export const PRODUCTION_ORDER_STATUS = {
  aberto: { label: 'Aberto', color: 'bg-blue-500' },
  producao: { label: 'Em Produção', color: 'bg-amber-500' },
  concluido: { label: 'Concluído', color: 'bg-green-500' },
  cancelado: { label: 'Cancelado', color: 'bg-red-500' },
};

export function useProductionOrders() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const { calculateBOM } = useBOM();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('production_orders')
      .select(`
        *,
        product:products(id, name, sku),
        variant:product_variants!production_orders_variant_id_fkey(id, variant_name, sku),
        source_order:orders!production_orders_source_order_id_fkey(id, order_number, customer_name, due_date),
        processes:production_order_processes(
          *,
          process:processes(id, name, value_per_unit)
        ),
        entries:production_entries(
          *,
          process:processes(id, name)
        )
      `)
      .order('created_at', { ascending: false });


    if (error) {
      console.error('Error fetching production orders:', error);
      toast.error('Erro ao carregar ordens de produção');
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  }, []);

  const createOrder = useCallback(async (
    order: Partial<ProductionOrder>,
    processIds: { process_id: string; is_required: boolean }[]
  ) => {
    try {
      if (!order.product_id) throw new PhysicalIdentityError('Selecione o produto a produzir.');
      await resolvePhysicalIdentity(order.product_id, order.variant_id);
    } catch (error) {
      toast.error(error instanceof PhysicalIdentityError ? error.message : 'Identidade física inválida.');
      return null;
    }
    // Generate order number
    const orderNumber = `OP-${Date.now().toString(36).toUpperCase()}`;

    const { data, error } = await supabase
      .from('production_orders')
      .insert({ ...order, order_number: orderNumber })
      .select()
      .single();

    if (error) {
      console.error('Error creating production order:', error);
      toast.error('Erro ao criar ordem de produção');
      return null;
    }

    // Add processes
    if (processIds.length > 0) {
      const { error: procError } = await supabase
        .from('production_order_processes')
        .insert(processIds.map(p => ({
          production_order_id: data.id,
          process_id: p.process_id,
          is_required: p.is_required,
        })));

      if (procError) {
        console.error('Error adding processes:', procError);
      }
    }

    toast.success('Ordem de produção criada');
    fetchOrders();
    return data;
  }, [fetchOrders]);

  const updateOrder = useCallback(async (id: string, updates: Partial<ProductionOrder>) => {
    const { error } = await supabase
      .from('production_orders')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating order:', error);
      toast.error('Erro ao atualizar ordem');
      return false;
    }

    toast.success('Ordem atualizada');
    fetchOrders();
    return true;
  }, [fetchOrders]);

  const deleteOrder = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('production_orders')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting order:', error);
      toast.error('Erro ao excluir ordem');
      return false;
    }

    toast.success('Ordem excluída');
    setOrders(prev => prev.filter(o => o.id !== id));
    return true;
  }, []);

  // Calculate consolidated quantity (minimum across required processes, or min across all entries if no required processes)
  const calculateConsolidation = useCallback((order: ProductionOrder) => {
    const entries = order.entries || [];
    if (entries.length === 0) return 0;

    const entriesByProcess: Record<string, number> = {};
    entries.forEach(entry => {
      entriesByProcess[entry.process_id] = (entriesByProcess[entry.process_id] || 0) + entry.quantity;
    });

    const requiredProcesses = order.processes?.filter(p => p.is_required) || [];
    
    // If there are required processes, use minimum across them
    if (requiredProcesses.length > 0) {
      const quantities = requiredProcesses.map(p => entriesByProcess[p.process_id] || 0);
      return Math.min(...quantities);
    }
    
    // If no required processes defined, use minimum across all processes with entries
    const allQuantities = Object.values(entriesByProcess);
    return allQuantities.length > 0 ? Math.min(...allQuantities) : 0;
  }, []);

  // Add production entry
  const createEntry = useCallback(async (entry: Omit<ProductionEntry, 'id' | 'created_at' | 'updated_at' | 'total_value' | 'process'>) => {
    const { data, error } = await supabase
      .from('production_entries')
      .insert(entry)
      .select(`*, process:processes(id, name)`)
      .single();

    if (error) {
      console.error('Error creating entry:', error);
      toast.error('Erro ao criar lançamento');
      return null;
    }

    toast.success('Lançamento registrado');
    
    // Recalculate consolidated quantity
    const order = orders.find(o => o.id === entry.production_order_id);
    if (order) {
      const updatedOrder = {
        ...order,
        entries: [...(order.entries || []), data],
      };
      const consolidated = calculateConsolidation(updatedOrder);
      await supabase
        .from('production_orders')
        .update({ consolidated_quantity: consolidated })
        .eq('id', entry.production_order_id);
    }
    
    fetchOrders();
    return data;
  }, [orders, calculateConsolidation, fetchOrders]);

  // Recalcula e persiste a quantidade consolidada da OP a partir dos lançamentos atuais
  const recalcConsolidation = useCallback(async (productionOrderId: string) => {
    const { data: fresh } = await supabase
      .from('production_orders')
      .select(`id, entries:production_entries(*), processes:production_order_processes(*)`)
      .eq('id', productionOrderId)
      .maybeSingle();

    if (!fresh) return;
    const consolidated = calculateConsolidation(fresh as unknown as ProductionOrder);
    await supabase
      .from('production_orders')
      .update({ consolidated_quantity: consolidated })
      .eq('id', productionOrderId);
  }, [calculateConsolidation]);

  const updateEntry = useCallback(async (id: string, updates: Partial<ProductionEntry>) => {
    const { data, error } = await supabase
      .from('production_entries')
      .update(updates)
      .eq('id', id)
      .select('production_order_id')
      .maybeSingle();

    if (error) {
      console.error('Error updating entry:', error);
      toast.error('Erro ao atualizar lançamento');
      return false;
    }

    if (data?.production_order_id) await recalcConsolidation(data.production_order_id);

    toast.success('Lançamento atualizado');
    fetchOrders();
    return true;
  }, [fetchOrders, recalcConsolidation]);

  const deleteEntry = useCallback(async (id: string) => {
    const { data: existing } = await supabase
      .from('production_entries')
      .select('production_order_id')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabase
      .from('production_entries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting entry:', error);
      toast.error('Erro ao excluir lançamento');
      return false;
    }

    if (existing?.production_order_id) await recalcConsolidation(existing.production_order_id);

    toast.success('Lançamento excluído');
    fetchOrders();
    return true;
  }, [fetchOrders, recalcConsolidation]);


  // Check BOM shortages for an order
  const checkBOMShortages = useCallback(async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || !order.product_id) return [];

    const consolidatedQty = calculateConsolidation(order);
    if (consolidatedQty <= 0) return [];

    const bomLines = await calculateBOM(order.product_id, consolidatedQty, order.variant_id);
    if (bomLines === null) return [];
    return bomLines.filter(line => line.shortage > 0);
  }, [orders, calculateConsolidation, calculateBOM]);

  // Complete production order (consume BOM, add finished product to stock)
  const completeOrder = useCallback(async (orderId: string, skipShortageCheck = false, location = 'Fábrica') => {
    const order = orders.find(o => o.id === orderId);
    if (!order || !order.product_id) return { success: false, shortages: [] };

    // Guard: never re-process a terminal OP (evita crédito duplicado em estoque)
    if (order.status === 'concluido' || order.status === 'cancelado') {
      toast.error('Esta OP já está finalizada');
      return { success: false, shortages: [] };
    }

    const consolidatedQty = calculateConsolidation(order);
    if (consolidatedQty <= 0) {
      toast.error('Nenhuma quantidade consolidada para concluir');
      return { success: false, shortages: [] };
    }

    const targetLocation = location && location.trim() !== '' ? location.trim() : 'Fábrica';

    // Get BOM and check for shortages
    const bomLines = await calculateBOM(order.product_id, consolidatedQty, order.variant_id);
    if (bomLines === null) {
      toast.error('BOM não configurada para a variante final desta OP');
      return { success: false, shortages: [], missingBom: true };
    }
    const shortages = bomLines.filter(line => line.shortage > 0);
    
    if (!skipShortageCheck && shortages.length > 0) {
      return { success: false, shortages };
    }

    // Consumo de matéria-prima (saldo por localização + histórico centralizados)
    for (const line of bomLines) {
      await applyStockDelta({
        productId: line.component_id,
        variantId: line.variant_id,
        delta: -Math.abs(line.qty_needed),
        movementType: 'consume',
        location: targetLocation,
        referenceType: 'production_order',
        referenceId: orderId,
        notes: `Consumo OP ${order.order_number}`,
      });
    }

    // Entrada do produto acabado
    const finishedOk = await applyStockDelta({
      productId: order.product_id,
      variantId: order.variant_id,
      delta: consolidatedQty,
      movementType: 'in',
      location: targetLocation,
      referenceType: 'production_order',
      referenceId: orderId,
      notes: `Entrada produção OP ${order.order_number}`,
    });

    if (!finishedOk) {
      toast.error('Falha ao creditar produto acabado no estoque');
      return { success: false, shortages: [] };
    }


    // Update order status
    await supabase
      .from('production_orders')
      .update({
        status: 'concluido',
        consolidated_quantity: consolidatedQty,
        completed_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    // Sync linked sales order: bump status to 'produzido' and append note
    let linkedOrderSynced = false;
    if (order.source_order_id) {
      const { data: linkedOrder } = await supabase
        .from('orders')
        .select('id, order_number, status, notes')
        .eq('id', order.source_order_id)
        .maybeSingle();

      if (linkedOrder) {
        const STATUS_RANK: Record<string, number> = {
          rascunho: 0, confirmado: 1, producao: 2,
          produzido: 3, pronto: 4, enviado: 5, concluido: 6, cancelado: 7,
        };
        const currentRank = STATUS_RANK[linkedOrder.status] ?? -1;
        const targetRank = STATUS_RANK['produzido'];
        const noteLine = `[${new Date().toLocaleString('pt-BR')}] OP ${order.order_number} concluída — ${consolidatedQty} un. creditadas em ${targetLocation}`;
        const newNotes = linkedOrder.notes
          ? `${linkedOrder.notes}\n${noteLine}`
          : noteLine;

        const updates: Record<string, unknown> = {
          notes: newNotes,
          updated_at: new Date().toISOString(),
        };
        // Only advance status if current is earlier than 'produzido' and not terminal
        if (currentRank < targetRank && linkedOrder.status !== 'cancelado' && linkedOrder.status !== 'concluido') {
          updates.status = 'produzido';
        }

        const { error: linkErr } = await supabase
          .from('orders')
          .update(updates)
          .eq('id', linkedOrder.id);

        if (!linkErr) {
          linkedOrderSynced = true;
          toast.success(`Pedido ${linkedOrder.order_number || linkedOrder.id.slice(0, 8)} atualizado → Produzido`);
        }
      }
    }

    toast.success(`OP concluída! ${consolidatedQty} unidades produzidas em ${targetLocation}`);
    fetchOrders();
    return { success: true, shortages: [], linkedOrderSynced };
  }, [orders, calculateConsolidation, calculateBOM, fetchOrders]);

  // Get payment summary by employee
  const getPaymentSummary = useCallback((entries: ProductionEntry[]) => {
    const byEmployee: Record<string, { total: number; byProcess: Record<string, { qty: number; value: number }> }> = {};

    entries.forEach(entry => {
      if (!byEmployee[entry.employee_name]) {
        byEmployee[entry.employee_name] = { total: 0, byProcess: {} };
      }

      const emp = byEmployee[entry.employee_name];
      emp.total += entry.total_value;

      const processName = entry.process?.name || entry.process_id;
      if (!emp.byProcess[processName]) {
        emp.byProcess[processName] = { qty: 0, value: 0 };
      }
      emp.byProcess[processName].qty += entry.quantity;
      emp.byProcess[processName].value += entry.total_value;
    });

    return byEmployee;
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    loading,
    fetchOrders,
    createOrder,
    updateOrder,
    deleteOrder,
    createEntry,
    updateEntry,
    deleteEntry,
    calculateConsolidation,
    completeOrder,
    checkBOMShortages,
    getPaymentSummary,
  };
}
