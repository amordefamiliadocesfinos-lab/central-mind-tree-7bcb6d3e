import { useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore, type Product as StoreProduct } from '@/stores/appStore';

const INVENTORY_EVENT = 'inventory:changed';

/** Dispara um refresh global de estoque (saldos + inventário) em todas as telas abertas. */
export function notifyInventoryChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(INVENTORY_EVENT));
  }
}

interface Options {
  /** Também carrega os produtos ativos para o store (telas que não usam useOrders). */
  loadProducts?: boolean;
}

/**
 * Fonte única de saldo de estoque: lê a tabela `inventory` em uma única consulta,
 * agrega por produto e alimenta o store (productBalances + inventory).
 * Recarrega automaticamente após qualquer movimento de estoque.
 */
export function useInventorySync({ loadProducts = false }: Options = {}) {
  const setInventory = useAppStore((s) => s.setInventory);
  const setProductBalances = useAppStore((s) => s.setProductBalances);
  const setProducts = useAppStore((s) => s.setProducts);

  const reload = useCallback(async () => {
    const [invRes, prodRes] = await Promise.all([
      supabase.from('inventory').select('id, product_id, variant_id, location, quantity, updated_at'),
      loadProducts
        ? supabase.from('products').select('*').eq('is_active', true).is('deleted_at', null).order('name')
        : Promise.resolve({ data: null, error: null } as const),
    ]);

    if (invRes.error) {
      console.error('Erro ao carregar estoque:', invRes.error);
      return;
    }

    const rows = invRes.data || [];
    const balances: Record<string, number> = {};
    rows.forEach((row: any) => {
      balances[row.product_id] = (balances[row.product_id] || 0) + (Number(row.quantity) || 0);
    });

    setInventory(
      rows.map((row: any) => ({
        id: row.id,
        product_id: row.product_id,
        variant_id: row.variant_id ?? null,
        quantity: Number(row.quantity) || 0,
        location: row.location ?? null,
        location_id: null,
        updated_at: row.updated_at,
      }))
    );

    if (loadProducts && prodRes.data) {
      // garante saldo 0 para produtos sem linha em inventory
      (prodRes.data as any[]).forEach((p) => {
        if (balances[p.id] === undefined) balances[p.id] = 0;
      });
      setProducts(prodRes.data as unknown as StoreProduct[]);
    }

    setProductBalances(balances);
  }, [loadProducts, setInventory, setProductBalances, setProducts]);

  useEffect(() => {
    reload();
    const handler = () => reload();
    window.addEventListener(INVENTORY_EVENT, handler);
    window.addEventListener('focus', handler);
    return () => {
      window.removeEventListener(INVENTORY_EVENT, handler);
      window.removeEventListener('focus', handler);
    };
  }, [reload]);

  return { reloadInventory: reload };
}
