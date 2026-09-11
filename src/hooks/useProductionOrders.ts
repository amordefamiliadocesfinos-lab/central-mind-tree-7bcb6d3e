import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useBOM } from './useBOM';
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
  internal_production_number?: string | null;
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
    internal_order_number?: string | null;
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
        source_order:orders!production_orders_source_order_id_fkey(id, order_number, internal_order_number, customer_name, due_date),
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
    const { data, error } = await supabase
      .from('production_orders')
      .insert(order)
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

  // A transformação física é uma única transação no banco: valida BOM e
  // componentes, consome, credita acabado e só então conclui a OP.
  const completeOrder = useCallback(async (orderId: string, location = 'Fábrica') => {
    const { data, error } = await (supabase.rpc as any)('complete_production_order', {
      p_production_order_id: orderId,
      p_finished_location: location,
    });

    if (error) {
      console.error('Erro ao concluir OP:', error);
      toast.error(error.message || 'Não foi possível concluir a OP');
      return { success: false, shortages: [] as BOMLine[] };
    }

    const result = data as {
      success: boolean;
      already_completed?: boolean;
      reason?: string;
      shortages?: Array<{
        product_id: string; variant_id: string | null; component_name: string;
        component_variant_name: string | null; component_sku: string;
        required_quantity: number; available_quantity: number; missing_quantity: number;
      }>;
    };

    if (!result.success) {
      if (result.reason === 'missing_bom') toast.error('BOM não configurada para a variante final desta OP');
      if (result.reason === 'no_consolidated_quantity') toast.error('Nenhuma quantidade consolidada para concluir');
      return {
        success: false,
        shortages: (result.shortages ?? []).map(line => ({
          component_id: line.product_id,
          variant_id: line.variant_id,
          component_name: line.component_variant_name ? `${line.component_name} · ${line.component_variant_name}` : line.component_name,
          component_sku: line.component_sku,
          unit: 'un',
          qty_per_unit: 0,
          qty_needed: Number(line.required_quantity),
          stock_available: Number(line.available_quantity),
          shortage: Number(line.missing_quantity),
        })),
      };
    }

    toast.success(result.already_completed ? 'Esta OP já estava concluída.' : 'OP concluída e produto acabado registrado.');
    fetchOrders();
    return { success: true, shortages: [] as BOMLine[] };
  }, [fetchOrders]);

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
