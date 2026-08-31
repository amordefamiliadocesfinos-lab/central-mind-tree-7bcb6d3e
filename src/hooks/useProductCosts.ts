import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProductProcess {
  id: string;
  product_id: string;
  process_id: string;
  cost_per_unit: number;
  created_at: string;
  process?: {
    id: string;
    name: string;
    value_per_unit: number;
  };
}

export interface ProductOptionalCost {
  id: string;
  product_id: string;
  name: string;
  cost_per_unit: number;
  is_active: boolean;
  created_at: string;
}

export interface ProductCostBreakdown {
  materials: number;
  processes: number;
  optionals: number;
  total: number;
}

export function useProductCosts() {
  const [productProcesses, setProductProcesses] = useState<ProductProcess[]>([]);
  const [optionalCosts, setOptionalCosts] = useState<ProductOptionalCost[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch processes linked to a product
  const fetchProductProcesses = useCallback(async (productId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('product_processes')
      .select(`
        *,
        process:processes(id, name, value_per_unit)
      `)
      .eq('product_id', productId);

    if (error) {
      console.error('Error fetching product processes:', error);
    } else {
      setProductProcesses(data || []);
    }
    setLoading(false);
    return data || [];
  }, []);

  // Add process to product
  const addProductProcess = useCallback(async (
    productId: string,
    processId: string,
    costPerUnit: number
  ) => {
    const { data, error } = await supabase
      .from('product_processes')
      .insert({
        product_id: productId,
        process_id: processId,
        cost_per_unit: costPerUnit,
      })
      .select(`*, process:processes(id, name, value_per_unit)`)
      .single();

    if (error) {
      if (error.code === '23505') {
        toast.error('Este processo já está vinculado');
      } else {
        toast.error('Erro ao adicionar processo');
        console.error(error);
      }
      return null;
    }

    toast.success('Processo vinculado');
    setProductProcesses(prev => [...prev, data]);
    return data;
  }, []);

  // Update product process cost
  const updateProductProcess = useCallback(async (id: string, costPerUnit: number) => {
    const { error } = await supabase
      .from('product_processes')
      .update({ cost_per_unit: costPerUnit })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar processo');
      return false;
    }

    toast.success('Custo atualizado');
    setProductProcesses(prev => prev.map(p => p.id === id ? { ...p, cost_per_unit: costPerUnit } : p));
    return true;
  }, []);

  // Remove process from product
  const removeProductProcess = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('product_processes')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao remover processo');
      return false;
    }

    toast.success('Processo removido');
    setProductProcesses(prev => prev.filter(p => p.id !== id));
    return true;
  }, []);

  // Fetch optional costs for a product
  const fetchOptionalCosts = useCallback(async (productId: string) => {
    const { data, error } = await supabase
      .from('product_optional_costs')
      .select('*')
      .eq('product_id', productId);

    if (error) {
      console.error('Error fetching optional costs:', error);
    } else {
      setOptionalCosts(data || []);
    }
    return data || [];
  }, []);

  // Add optional cost
  const addOptionalCost = useCallback(async (
    productId: string,
    name: string,
    costPerUnit: number
  ) => {
    const { data, error } = await supabase
      .from('product_optional_costs')
      .insert({
        product_id: productId,
        name,
        cost_per_unit: costPerUnit,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao adicionar custo opcional');
      return null;
    }

    toast.success('Custo opcional adicionado');
    setOptionalCosts(prev => [...prev, data]);
    return data;
  }, []);

  // Update optional cost
  const updateOptionalCost = useCallback(async (
    id: string,
    updates: Partial<ProductOptionalCost>
  ) => {
    const { error } = await supabase
      .from('product_optional_costs')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar custo opcional');
      return false;
    }

    toast.success('Custo atualizado');
    setOptionalCosts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    return true;
  }, []);

  // Delete optional cost
  const deleteOptionalCost = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('product_optional_costs')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir custo opcional');
      return false;
    }

    toast.success('Custo removido');
    setOptionalCosts(prev => prev.filter(c => c.id !== id));
    return true;
  }, []);

  // Calculate total product cost
  const calculateProductCost = useCallback(async (productId: string, productVariantId: string | null = null): Promise<ProductCostBreakdown> => {
    // Get BOM cost (materials)
    const query = supabase
      .from('product_components')
      .select(`
        qty_per_unit,
        component:products!product_components_component_id_fkey(cost),
        variant:product_variants!product_components_variant_id_fkey(cost_override)
      `)
      .eq('product_id', productId);
    const { data: components } = productVariantId
      ? await query.eq('product_variant_id', productVariantId)
      : await query.is('product_variant_id', null);

    const materialsCost = (components || []).reduce((sum, comp: any) => {
      const unitCost = comp.variant?.cost_override ?? comp.component?.cost ?? 0;
      return sum + (unitCost * comp.qty_per_unit);
    }, 0);

    // Get processes cost
    const { data: processes } = await supabase
      .from('product_processes')
      .select('cost_per_unit')
      .eq('product_id', productId);

    const processesCost = (processes || []).reduce((sum, p) => sum + p.cost_per_unit, 0);

    // Get active optional costs
    const { data: optionals } = await supabase
      .from('product_optional_costs')
      .select('cost_per_unit')
      .eq('product_id', productId)
      .eq('is_active', true);

    const optionalsCost = (optionals || []).reduce((sum, o) => sum + o.cost_per_unit, 0);

    return {
      materials: materialsCost,
      processes: processesCost,
      optionals: optionalsCost,
      total: materialsCost + processesCost + optionalsCost,
    };
  }, []);

  // Sync product cost to products table
  const syncProductCost = useCallback(async (productId: string) => {
    const breakdown = await calculateProductCost(productId);
    
    const { error } = await supabase
      .from('products')
      .update({ cost: breakdown.total })
      .eq('id', productId);

    if (error) {
      toast.error('Erro ao sincronizar custo');
      return false;
    }

    toast.success('Custo do produto atualizado');
    return true;
  }, [calculateProductCost]);

  return {
    productProcesses,
    optionalCosts,
    loading,
    fetchProductProcesses,
    addProductProcess,
    updateProductProcess,
    removeProductProcess,
    fetchOptionalCosts,
    addOptionalCost,
    updateOptionalCost,
    deleteOptionalCost,
    calculateProductCost,
    syncProductCost,
  };
}
