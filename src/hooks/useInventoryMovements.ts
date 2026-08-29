import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { notifyInventoryChanged } from '@/hooks/useInventorySync';
import { applyStockDelta, resolveStockLocation } from '@/lib/inventoryOps';

export type MovementType = 'in' | 'out' | 'reserve' | 'consume' | 'adjust';

export interface InventoryMovement {
  id: string;
  product_id: string;
  variant_id?: string | null;
  movement_type: MovementType;
  quantity: number;
  previous_balance: number;
  new_balance: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

export const MOVEMENT_LABELS: Record<MovementType, { label: string; color: string }> = {
  in: { label: 'Entrada', color: 'bg-green-500' },
  out: { label: 'Saída', color: 'bg-red-500' },
  reserve: { label: 'Reserva', color: 'bg-amber-500' },
  consume: { label: 'Consumo', color: 'bg-orange-500' },
  adjust: { label: 'Ajuste', color: 'bg-blue-500' },
};

export function useInventoryMovements() {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMovements = useCallback(async (productId?: string) => {
    setLoading(true);
    let query = supabase
      .from('inventory_movements')
      .select('*')
      .order('created_at', { ascending: false });

    if (productId) {
      query = query.eq('product_id', productId);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      console.error('Error fetching movements:', error);
      setLoading(false);
      return [];
    }

    setMovements((data as InventoryMovement[]) || []);
    setLoading(false);
    return (data as InventoryMovement[]) || [];
  }, []);

  const getCurrentBalance = useCallback(async (productId: string, variantId?: string | null): Promise<number> => {
    let query = supabase
      .from('inventory')
      .select('quantity')
      .eq('product_id', productId);
    query = variantId ? query.eq('variant_id', variantId) : query.is('variant_id', null);
    const { data, error } = await query;

    if (error) {
      console.error('Error getting balance:', error);
      return 0;
    }

    return (data || []).reduce((sum, inv: any) => sum + (Number(inv.quantity) || 0), 0);
  }, []);

  const createMovement = useCallback(async (
    productId: string,
    type: MovementType,
    quantity: number,
    notes?: string,
    referenceType?: string,
    referenceId?: string,
    variantId?: string | null,
  ): Promise<boolean> => {
    const location = await resolveStockLocation(productId, variantId);

    let currentQuery = supabase
      .from('inventory')
      .select('quantity')
      .eq('product_id', productId)
      .eq('location', location);
    currentQuery = variantId ? currentQuery.eq('variant_id', variantId) : currentQuery.is('variant_id', null);
    const { data: current } = await currentQuery.maybeSingle();

    const previousBalance = Number(current?.quantity) || 0;

    let delta = 0;
    switch (type) {
      case 'in':
        delta = quantity;
        break;
      case 'out':
      case 'consume':
        delta = -Math.min(quantity, previousBalance);
        break;
      case 'reserve':
        delta = 0;
        break;
      case 'adjust':
        delta = quantity - previousBalance;
        break;
    }

    if (delta === 0 && type !== 'reserve') {
      toast.info('Nenhuma alteração de saldo');
      return true;
    }

    const ok = delta === 0 ? true : await applyStockDelta({
      productId,
      variantId,
      delta,
      movementType: type === 'adjust' ? 'adjust' : type,
      location,
      referenceType,
      referenceId,
      notes,
    });

    if (!ok) {
      toast.error('Erro ao registrar movimento');
      return false;
    }

    notifyInventoryChanged();
    toast.success(`Movimento registrado: ${MOVEMENT_LABELS[type].label}`);
    return true;
  }, []);

  const getProductHistory = useCallback(async (productId: string): Promise<InventoryMovement[]> => {
    const { data, error } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching history:', error);
      return [];
    }

    return (data as InventoryMovement[]) || [];
  }, []);

  return {
    movements,
    loading,
    fetchMovements,
    createMovement,
    getProductHistory,
    getCurrentBalance,
    movementLabels: MOVEMENT_LABELS,
  };
}
