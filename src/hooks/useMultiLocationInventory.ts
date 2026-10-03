import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { notifyInventoryChanged } from '@/hooks/useInventorySync';

export type MovementType = 'in' | 'out' | 'transfer' | 'adjust' | 'reserve' | 'consume';

export interface LocationInventory {
  id: string;
  product_id: string;
  variant_id?: string | null;
  location: string;
  quantity: number;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  variant_id?: string | null;
  movement_type: string;
  quantity: number;
  previous_balance: number;
  new_balance: number;
  location: string | null;
  from_location: string | null;
  to_location: string | null;
  notes: string | null;
  created_at: string;
}

export const MOVEMENT_LABELS: Record<MovementType, { label: string; color: string }> = {
  in: { label: 'Entrada', color: 'bg-green-500' },
  out: { label: 'Saída', color: 'bg-red-500' },
  transfer: { label: 'Transferência', color: 'bg-purple-500' },
  reserve: { label: 'Reserva', color: 'bg-amber-500' },
  consume: { label: 'Consumo', color: 'bg-orange-500' },
  adjust: { label: 'Ajuste', color: 'bg-blue-500' },
};

type ManualOperation = 'entry' | 'exit' | 'transfer' | 'adjust';

export function useMultiLocationInventory() {
  const [loading, setLoading] = useState(false);

  const getLocationBalance = useCallback(async (
    productId: string,
    location: string,
    variantId?: string | null,
  ): Promise<number> => {
    let query = supabase
      .from('inventory')
      .select('quantity')
      .eq('product_id', productId)
      .eq('location', location);
    query = variantId ? query.eq('variant_id', variantId) : query.is('variant_id', null);
    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('Error getting location balance:', error);
      return 0;
    }
    return data?.quantity || 0;
  }, []);

  const getTotalBalance = useCallback(async (productId: string): Promise<number> => {
    const { data, error } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('product_id', productId);

    if (error) {
      console.error('Error getting total balance:', error);
      return 0;
    }
    return (data || []).reduce((sum, inv) => sum + (inv.quantity || 0), 0);
  }, []);

  const getProductInventoryByLocation = useCallback(async (
    productId: string,
    variantId?: string | null,
  ): Promise<LocationInventory[]> => {
    let query = supabase
      .from('inventory')
      .select('*')
      .eq('product_id', productId);
    query = variantId ? query.eq('variant_id', variantId) : query.is('variant_id', null);
    const { data, error } = await query;

    if (error) {
      console.error('Error getting inventory by location:', error);
      return [];
    }
    return (data || []) as LocationInventory[];
  }, []);

  const executeManualMovement = useCallback(async (
    operation: ManualOperation,
    productId: string,
    location: string,
    quantity: number,
    notes?: string,
    variantId?: string | null,
    toLocation?: string | null,
  ): Promise<boolean> => {
    setLoading(true);
    try {
      const eventKey = `manual_inventory:${crypto.randomUUID()}`;
      const { data, error } = await (supabase.rpc as any)('record_manual_inventory_movement', {
        p_product_id: productId,
        p_variant_id: variantId || null,
        p_operation: operation,
        p_quantity: quantity,
        p_location: location,
        p_to_location: toLocation || null,
        p_notes: notes || null,
        p_event_key: eventKey,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.reason || 'Movimentação não aplicada.');

      notifyInventoryChanged();
      const labels: Record<ManualOperation, string> = {
        entry: 'Entrada registrada!',
        exit: 'Saída registrada!',
        transfer: 'Transferência realizada!',
        adjust: 'Estoque ajustado!',
      };
      toast.success(labels[operation]);
      return true;
    } catch (error: any) {
      console.error('Manual inventory movement error:', error);
      toast.error(error?.message || 'Não foi possível movimentar o estoque.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const createEntry = useCallback((
    productId: string,
    location: string,
    quantity: number,
    notes?: string,
    variantId?: string | null,
  ) => executeManualMovement('entry', productId, location, quantity, notes, variantId), [executeManualMovement]);

  const createExit = useCallback((
    productId: string,
    location: string,
    quantity: number,
    notes?: string,
    variantId?: string | null,
  ) => executeManualMovement('exit', productId, location, quantity, notes, variantId), [executeManualMovement]);

  const createTransfer = useCallback((
    productId: string,
    fromLocation: string,
    toLocation: string,
    quantity: number,
    notes?: string,
    variantId?: string | null,
  ) => executeManualMovement('transfer', productId, fromLocation, quantity, notes, variantId, toLocation), [executeManualMovement]);

  const adjustInventory = useCallback((
    productId: string,
    location: string,
    newQuantity: number,
    notes?: string,
    variantId?: string | null,
  ) => executeManualMovement('adjust', productId, location, newQuantity, notes, variantId), [executeManualMovement]);

  const getProductHistory = useCallback(async (productId: string): Promise<InventoryMovement[]> => {
    const { data, error } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching history:', error);
      return [];
    }
    return (data || []) as InventoryMovement[];
  }, []);

  return {
    loading,
    getLocationBalance,
    getTotalBalance,
    getProductInventoryByLocation,
    createEntry,
    createExit,
    createTransfer,
    adjustInventory,
    getProductHistory,
    movementLabels: MOVEMENT_LABELS,
  };
}
