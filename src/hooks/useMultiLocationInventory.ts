import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { notifyInventoryChanged } from '@/hooks/useInventorySync';
import { PhysicalIdentityError, resolvePhysicalIdentity } from '@/lib/products/physicalIdentity';

export type MovementType = 'in' | 'out' | 'transfer' | 'adjust' | 'reserve' | 'consume';

export interface LocationInventory {
  id: string;
  product_id: string;
  location: string;
  quantity: number;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
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

export function useMultiLocationInventory() {
  const [loading, setLoading] = useState(false);

  // Get balance for a product at a specific location
  const getLocationBalance = useCallback(async (productId: string, location: string, variantId?: string | null): Promise<number> => {
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

  // Get total balance across all locations for a product
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

  // Get inventory breakdown by location for a product
  const getProductInventoryByLocation = useCallback(async (productId: string): Promise<LocationInventory[]> => {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('product_id', productId);

    if (error) {
      console.error('Error getting inventory by location:', error);
      return [];
    }

    return (data || []) as LocationInventory[];
  }, []);

  // Create entry movement (Entrada)
  const createEntry = useCallback(async (
    productId: string,
    location: string,
    quantity: number,
    notes?: string,
    variantId?: string | null,
  ): Promise<boolean> => {
    try { await resolvePhysicalIdentity(productId, variantId); } catch (error) { toast.error(error instanceof PhysicalIdentityError ? error.message : 'Produto inválido'); return false; }
    setLoading(true);
    
    const previousBalance = await getLocationBalance(productId, location, variantId);
    const newBalance = previousBalance + quantity;

    // Create movement record
    const { error: movementError } = await supabase
      .from('inventory_movements')
      .insert({
        product_id: productId,
        variant_id: variantId || null,
        movement_type: 'in',
        quantity,
        previous_balance: previousBalance,
        new_balance: newBalance,
        location,
        notes: notes || null,
      });

    if (movementError) {
      toast.error('Erro ao registrar entrada');
      console.error('Movement error:', movementError);
      setLoading(false);
      return false;
    }

    // Upsert inventory
    const { error: inventoryError } = await supabase
      .from('inventory')
      .upsert({
        product_id: productId,
        variant_id: variantId || null,
        location,
        quantity: newBalance,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'product_id,variant_id,location',
      });

    if (inventoryError) {
      console.error('Inventory error:', inventoryError);
      toast.error('Erro ao atualizar estoque');
      setLoading(false);
      return false;
    }

    notifyInventoryChanged();
    toast.success('Entrada registrada!');
    setLoading(false);
    return true;
  }, [getLocationBalance]);

  // Create exit movement (Saída)
  const createExit = useCallback(async (
    productId: string,
    location: string,
    quantity: number,
    notes?: string,
    variantId?: string | null,
  ): Promise<boolean> => {
    try { await resolvePhysicalIdentity(productId, variantId); } catch (error) { toast.error(error instanceof PhysicalIdentityError ? error.message : 'Produto inválido'); return false; }
    setLoading(true);
    
    const previousBalance = await getLocationBalance(productId, location, variantId);
    
    if (previousBalance < quantity) {
      toast.error(`Saldo insuficiente. Disponível: ${previousBalance}`);
      setLoading(false);
      return false;
    }

    const newBalance = previousBalance - quantity;

    // Create movement record
    const { error: movementError } = await supabase
      .from('inventory_movements')
      .insert({
        product_id: productId,
        variant_id: variantId || null,
        movement_type: 'out',
        quantity,
        previous_balance: previousBalance,
        new_balance: newBalance,
        location,
        notes: notes || null,
      });

    if (movementError) {
      toast.error('Erro ao registrar saída');
      setLoading(false);
      return false;
    }

    // Update inventory
    const { error: inventoryError } = await supabase
      .from('inventory')
      .upsert({
        product_id: productId,
        variant_id: variantId || null,
        location,
        quantity: newBalance,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'product_id,variant_id,location',
      });

    if (inventoryError) {
      console.error('Inventory error:', inventoryError);
      setLoading(false);
      return false;
    }

    notifyInventoryChanged();
    toast.success('Saída registrada!');
    setLoading(false);
    return true;
  }, [getLocationBalance]);

  // Create transfer between locations
  const createTransfer = useCallback(async (
    productId: string,
    fromLocation: string,
    toLocation: string,
    quantity: number,
    notes?: string,
    variantId?: string | null,
  ): Promise<boolean> => {
    try { await resolvePhysicalIdentity(productId, variantId); } catch (error) { toast.error(error instanceof PhysicalIdentityError ? error.message : 'Produto inválido'); return false; }
    setLoading(true);

    // Check source balance
    const sourceBalance = await getLocationBalance(productId, fromLocation, variantId);
    if (sourceBalance < quantity) {
      toast.error(`Saldo insuficiente em ${fromLocation}. Disponível: ${sourceBalance}`);
      setLoading(false);
      return false;
    }

    const destBalance = await getLocationBalance(productId, toLocation, variantId);

    const newSourceBalance = sourceBalance - quantity;
    const newDestBalance = destBalance + quantity;

    // Create transfer movement record
    const { error: movementError } = await supabase
      .from('inventory_movements')
      .insert({
        product_id: productId,
        variant_id: variantId || null,
        movement_type: 'transfer',
        quantity,
        previous_balance: sourceBalance,
        new_balance: newSourceBalance,
        from_location: fromLocation,
        to_location: toLocation,
        notes: notes || `Transferência de ${fromLocation} para ${toLocation}`,
      });

    if (movementError) {
      toast.error('Erro ao registrar transferência');
      setLoading(false);
      return false;
    }

    // Update source inventory
    const { error: sourceError } = await supabase
      .from('inventory')
      .upsert({
        product_id: productId,
        variant_id: variantId || null,
        location: fromLocation,
        quantity: newSourceBalance,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'product_id,variant_id,location',
      });

    if (sourceError) {
      console.error('Source inventory error:', sourceError);
      setLoading(false);
      return false;
    }

    // Update destination inventory
    const { error: destError } = await supabase
      .from('inventory')
      .upsert({
        product_id: productId,
        variant_id: variantId || null,
        location: toLocation,
        quantity: newDestBalance,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'product_id,variant_id,location',
      });

    if (destError) {
      console.error('Dest inventory error:', destError);
      setLoading(false);
      return false;
    }

    notifyInventoryChanged();
    toast.success('Transferência realizada!');
    setLoading(false);
    return true;
  }, [getLocationBalance]);

  // Adjust inventory at a location
  const adjustInventory = useCallback(async (
    productId: string,
    location: string,
    newQuantity: number,
    notes?: string,
    variantId?: string | null,
  ): Promise<boolean> => {
    try { await resolvePhysicalIdentity(productId, variantId); } catch (error) { toast.error(error instanceof PhysicalIdentityError ? error.message : 'Produto inválido'); return false; }
    setLoading(true);
    
    const previousBalance = await getLocationBalance(productId, location, variantId);
    const difference = newQuantity - previousBalance;

    // Create movement record
    const { error: movementError } = await supabase
      .from('inventory_movements')
      .insert({
        product_id: productId,
        variant_id: variantId || null,
        movement_type: 'adjust',
        quantity: difference,
        previous_balance: previousBalance,
        new_balance: newQuantity,
        location,
        notes: notes || 'Ajuste manual de estoque',
      });

    if (movementError) {
      toast.error('Erro ao registrar ajuste');
      setLoading(false);
      return false;
    }

    // Update inventory
    const { error: inventoryError } = await supabase
      .from('inventory')
      .upsert({
        product_id: productId,
        variant_id: variantId || null,
        location,
        quantity: newQuantity,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'product_id,variant_id,location',
      });

    if (inventoryError) {
      console.error('Inventory error:', inventoryError);
      setLoading(false);
      return false;
    }

    notifyInventoryChanged();
    toast.success('Estoque ajustado!');
    setLoading(false);
    return true;
  }, [getLocationBalance]);

  // Get movement history for a product
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
