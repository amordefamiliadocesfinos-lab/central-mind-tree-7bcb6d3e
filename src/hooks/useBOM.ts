import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PhysicalIdentityError, resolvePhysicalIdentity } from '@/lib/products/physicalIdentity';

export interface ProductComponent {
  id: string;
  product_id: string;
  /** Variante física do produto final a que esta linha de BOM pertence. */
  product_variant_id: string | null;
  component_id: string;
  variant_id: string | null;
  qty_per_unit: number;
  notes: string | null;
  created_at: string;
  component?: {
    id: string;
    name: string;
    sku: string;
    unit: string;
  };
  variant?: {
    id: string;
    variant_name: string;
    sku: string;
    unit: string | null;
    cost_override: number | null;
  } | null;
}

export interface BOMLine {
  component_id: string;
  variant_id: string | null;
  component_name: string;
  component_sku: string;
  unit: string;
  qty_per_unit: number;
  qty_needed: number;
  stock_available: number;
  shortage: number;
}

export function useBOM() {
  const [components, setComponents] = useState<ProductComponent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchComponentsForProduct = useCallback(async (productId: string, productVariantId: string | null = null) => {
    setLoading(true);
    const query = supabase
      .from('product_components')
      .select(`
        *,
        component:products!product_components_component_id_fkey(id, name, sku, unit),
        variant:product_variants!product_components_variant_id_fkey(id, variant_name, sku, unit, cost_override)
      `)
      .eq('product_id', productId);
    const { data, error } = productVariantId
      ? await query.eq('product_variant_id', productVariantId)
      : await query.is('product_variant_id', null);

    if (error) {
      console.error('Error fetching components:', error);
      setLoading(false);
      return [];
    }

    const result = (data || []) as ProductComponent[];
    setComponents(result);
    setLoading(false);
    return result;
  }, []);

  const addComponent = useCallback(async (
    productId: string,
    productVariantId: string | null,
    componentId: string,
    variantId: string | null,
    qtyPerUnit: number,
    notes?: string
  ) => {
    try {
      await resolvePhysicalIdentity(productId, productVariantId);
      await resolvePhysicalIdentity(componentId, variantId);
    } catch (error) {
      toast.error(error instanceof PhysicalIdentityError ? error.message : 'Identidade física inválida.');
      return null;
    }

    const { data, error } = await supabase
      .from('product_components')
      .insert({
        product_id: productId,
        product_variant_id: productVariantId,
        component_id: componentId,
        variant_id: variantId,
        qty_per_unit: qtyPerUnit,
        notes: notes || null,
      })
      .select(`
        *,
        component:products!product_components_component_id_fkey(id, name, sku, unit),
        variant:product_variants!product_components_variant_id_fkey(id, variant_name, sku, unit, cost_override)
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        toast.error('Este componente já está na lista');
      } else {
        toast.error('Erro ao adicionar componente');
        console.error('Error adding component:', error);
      }
      return null;
    }

    toast.success('Componente adicionado');
    return data as ProductComponent;
  }, []);

  const updateComponent = useCallback(async (
    id: string,
    qtyPerUnit: number,
    notes?: string
  ) => {
    const { error } = await supabase
      .from('product_components')
      .update({ qty_per_unit: qtyPerUnit, notes: notes || null })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar componente');
      console.error('Error updating component:', error);
      return false;
    }

    toast.success('Componente atualizado');
    return true;
  }, []);

  const removeComponent = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('product_components')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao remover componente');
      console.error('Error removing component:', error);
      return false;
    }

    toast.success('Componente removido');
    return true;
  }, []);

  // Calculate BOM for a given quantity of product
  const calculateBOM = useCallback(async (
    productId: string,
    quantity: number,
    productVariantId: string | null = null
  ): Promise<BOMLine[] | null> => {
    // Get components
    const query = supabase
      .from('product_components')
      .select(`
        *,
        component:products!product_components_component_id_fkey(id, name, sku, unit),
        variant:product_variants!product_components_variant_id_fkey(id, variant_name, sku, unit, cost_override)
      `)
      .eq('product_id', productId);
    const { data: comps, error: compsError } = productVariantId
      ? await query.eq('product_variant_id', productVariantId)
      : await query.is('product_variant_id', null);

    if (compsError || !comps) return productVariantId ? null : [];
    // Uma variante final nunca pode consumir a BOM genérica ou de outra variante.
    if (productVariantId && comps.length === 0) return null;

    // Get stock for all components
    const componentIds = comps.map((c: any) => c.component_id);
    const { data: invData } = await supabase
      .from('inventory')
      .select('product_id, variant_id, quantity')
      .in('product_id', componentIds);

    const stockMap: Record<string, number> = {};
    (invData || []).forEach((inv: any) => {
      const identity = `${inv.product_id}:${inv.variant_id || 'simple'}`;
      stockMap[identity] = (stockMap[identity] || 0) + Number(inv.quantity || 0);
    });

    return comps.map((c: any) => {
      const qtyNeeded = c.qty_per_unit * quantity;
      const stockAvailable = stockMap[`${c.component_id}:${c.variant_id || 'simple'}`] || 0;
      const shortage = Math.max(0, qtyNeeded - stockAvailable);

      return {
        component_id: c.component_id,
        variant_id: c.variant_id || null,
        component_name: c.variant ? `${c.component?.name || 'Componente'} · ${c.variant.variant_name}` : (c.component?.name || 'Unknown'),
        component_sku: c.variant?.sku || c.component?.sku || '',
        unit: c.variant?.unit || c.component?.unit || 'un',
        qty_per_unit: c.qty_per_unit,
        qty_needed: qtyNeeded,
        stock_available: stockAvailable,
        shortage,
      };
    });
  }, []);

  return {
    components,
    loading,
    fetchComponentsForProduct,
    addComponent,
    updateComponent,
    removeComponent,
    calculateBOM,
  };
}
