import { supabase } from '@/integrations/supabase/client';
import { notifyInventoryChanged } from '@/hooks/useInventorySync';
import { PhysicalIdentityError, resolvePhysicalIdentity } from '@/lib/products/physicalIdentity';

export const FALLBACK_LOCATION = 'Fábrica';

/**
 * Resolve a localização de estoque a ser usada para um produto.
 * Prioriza a localização onde o produto já possui saldo; depois o primeiro local
 * cadastrado; por fim, a localização padrão.
 * Nunca retorna null/'' — a identidade do saldo é produto + variante opcional + local.
 */
export async function resolveStockLocation(productId: string, variantId?: string | null): Promise<string> {
  let query = supabase
    .from('inventory')
    .select('location, quantity')
    .eq('product_id', productId)
    .order('quantity', { ascending: false });

  query = variantId ? query.eq('variant_id', variantId) : query.is('variant_id', null);
  const { data: rows } = await query;

  const existing = (rows || []).find((r: any) => r.location && String(r.location).trim() !== '');
  if (existing) return existing.location as string;

  const { data: locs } = await supabase
    .from('storage_locations')
    .select('name')
    .limit(1);

  return locs?.[0]?.name || FALLBACK_LOCATION;
}

interface StockDeltaParams {
  productId: string;
  /** Variante física opcional; ausente para produto simples/legado. */
  variantId?: string | null;
  /** Positivo = entrada, negativo = saída */
  delta: number;
  movementType?: 'in' | 'out' | 'adjust' | 'consume' | 'reserve';
  location?: string;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
}

/**
 * Aplica um movimento de estoque garantindo saldo consistente por localização
 * e registrando o histórico em inventory_movements.
 */
export async function applyStockDelta({
  productId,
  variantId = null,
  delta,
  movementType,
  location,
  referenceType,
  referenceId,
  notes,
}: StockDeltaParams): Promise<boolean> {
  if (!productId || !delta) return false;
  try {
    await resolvePhysicalIdentity(productId, variantId);
  } catch (error) {
    if (error instanceof PhysicalIdentityError) console.error(error.message);
    return false;
  }

  const loc = location && location.trim() !== '' ? location : await resolveStockLocation(productId, variantId);

  let currentQuery = supabase
    .from('inventory')
    .select('quantity')
    .eq('product_id', productId)
    .eq('location', loc);
  currentQuery = variantId ? currentQuery.eq('variant_id', variantId) : currentQuery.is('variant_id', null);
  const { data: current } = await currentQuery.maybeSingle();

  const previousBalance = Number(current?.quantity) || 0;
  const newBalance = Math.max(0, previousBalance + delta);
  const type = movementType || (delta >= 0 ? 'in' : 'out');

  const { error: invError } = await supabase
    .from('inventory')
    .upsert(
      {
        product_id: productId,
        variant_id: variantId,
        location: loc,
        quantity: newBalance,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'product_id,variant_id,location' }
    );

  if (invError) {
    console.error('Erro ao atualizar saldo de estoque:', invError);
    return false;
  }

  const { error: movError } = await supabase.from('inventory_movements').insert({
    product_id: productId,
    variant_id: variantId,
    movement_type: type,
    quantity: Math.abs(delta),
    previous_balance: previousBalance,
    new_balance: newBalance,
    location: loc,
    reference_type: referenceType || null,
    reference_id: referenceId || null,
    notes: notes || null,
  });

  if (movError) console.error('Erro ao registrar movimento de estoque:', movError);

  notifyInventoryChanged();
  return true;
}
