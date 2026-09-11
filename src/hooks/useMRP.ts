import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SIMPLE_VARIANT_KEY = '__simple__';
export const physicalIdentityKey = (productId: string, variantId: string | null) => `${productId}:${variantId ?? SIMPLE_VARIANT_KEY}`;

export interface ProductionNeed {
  product_id: string; variant_id: string | null; product_name: string; variant_name: string | null;
  product_sku: string; variant_sku: string | null; unit: string; demand: number;
  stock_available: number; production_programmed: number; shortage: number; orders_affected: string[];
}
export interface MaterialNeed {
  component_id: string; variant_id: string | null; component_name: string; component_sku: string;
  unit: string; total_needed: number; stock_available: number; shortage: number; orders_affected: string[];
}
type InventoryRow = { product_id: string; variant_id: string | null; quantity: number | null };
type ProductionOrderRow = { product_id: string | null; variant_id: string | null; target_quantity: number | null; status: string };

function sumInventory(rows: InventoryRow[]) {
  return rows.reduce<Record<string, number>>((totals, row) => {
    const key = physicalIdentityKey(row.product_id, row.variant_id);
    totals[key] = (totals[key] || 0) + Number(row.quantity || 0);
    return totals;
  }, {});
}
function sumProgrammedProduction(rows: ProductionOrderRow[]) {
  return rows.reduce<Record<string, number>>((totals, row) => {
    if (!row.product_id || !['aberto', 'producao'].includes(row.status)) return totals;
    const key = physicalIdentityKey(row.product_id, row.variant_id);
    totals[key] = (totals[key] || 0) + Number(row.target_quantity || 0);
    return totals;
  }, {});
}

/** Pure planning calculation. It never writes inventory, reservations, orders or OP completion. */
export function calculateMrpProductionNeeds(
  demandRows: Array<{ product_id: string; variant_id: string | null; quantity: number; product_name: string; variant_name: string | null; product_sku: string; variant_sku: string | null; unit: string; order_reference: string }>,
  inventoryRows: InventoryRow[], productionOrders: ProductionOrderRow[],
): ProductionNeed[] {
  const demand = new Map<string, ProductionNeed>();
  for (const row of demandRows) {
    const key = physicalIdentityKey(row.product_id, row.variant_id);
    const current = demand.get(key) ?? { product_id: row.product_id, variant_id: row.variant_id, product_name: row.product_name, variant_name: row.variant_name, product_sku: row.product_sku, variant_sku: row.variant_sku, unit: row.unit, demand: 0, stock_available: 0, production_programmed: 0, shortage: 0, orders_affected: [] };
    current.demand += Number(row.quantity || 0);
    if (!current.orders_affected.includes(row.order_reference)) current.orders_affected.push(row.order_reference);
    demand.set(key, current);
  }
  const stock = sumInventory(inventoryRows);
  const programmed = sumProgrammedProduction(productionOrders);
  return [...demand.entries()].map(([key, need]) => ({ ...need, stock_available: stock[key] || 0, production_programmed: programmed[key] || 0, shortage: Math.max(0, need.demand - (stock[key] || 0) - (programmed[key] || 0)) }));
}

export function useMRP() {
  const calculateProductionNeeds = useCallback(async (): Promise<ProductionNeed[]> => {
    const { data: orders, error } = await supabase.from('orders').select(`
      id, order_number, internal_order_number, status, operational_status,
      items:order_items(product_id, variant_id, quantity, product:products!order_items_product_id_fkey(id, name, sku, unit), variant:product_variants!order_items_variant_id_fkey(id, variant_name, sku, unit))
    `).is('deleted_at', null);
    if (error || !orders) { console.error('Error fetching MRP demand:', error); return []; }

    const demandRows = orders
      .filter((order: any) => !['cancelado', 'concluido', 'entregue'].includes(order.status) && !['finalizado', 'concluido', 'cancelado'].includes(order.operational_status || ''))
      .flatMap((order: any) => (order.items || []).filter((item: any) => item.product_id).map((item: any) => ({
        product_id: item.product_id, variant_id: item.variant_id || null, quantity: Number(item.quantity || 0),
        product_name: item.product?.name || 'Produto não identificado', variant_name: item.variant?.variant_name || null,
        product_sku: item.product?.sku || '', variant_sku: item.variant?.sku || null, unit: item.variant?.unit || item.product?.unit || 'un',
        order_reference: order.internal_order_number || order.order_number || order.id.slice(0, 8),
      })));
    if (!demandRows.length) return [];
    const productIds = [...new Set(demandRows.map(row => row.product_id))];
    const [{ data: inventory }, { data: productionOrders }] = await Promise.all([
      supabase.from('inventory').select('product_id, variant_id, quantity').in('product_id', productIds),
      supabase.from('production_orders').select('product_id, variant_id, target_quantity, status').in('status', ['aberto', 'producao']),
    ]);
    return calculateMrpProductionNeeds(demandRows, (inventory || []) as InventoryRow[], (productionOrders || []) as ProductionOrderRow[])
      .sort((a, b) => b.shortage - a.shortage || a.product_name.localeCompare(b.product_name));
  }, []);

  const calculateMaterialNeeds = useCallback(async (): Promise<MaterialNeed[]> => {
    const productionNeeds = (await calculateProductionNeeds()).filter(need => need.shortage > 0);
    if (!productionNeeds.length) return [];
    const { data: components } = await supabase.from('product_components').select(`
      product_id, product_variant_id, component_id, variant_id, qty_per_unit,
      component:products!product_components_component_id_fkey(id, name, sku, unit),
      variant:product_variants!product_components_variant_id_fkey(id, variant_name, sku, unit)
    `).in('product_id', [...new Set(productionNeeds.map(need => need.product_id))]);
    if (!components?.length) return [];

    const materialMap = new Map<string, MaterialNeed>();
    for (const need of productionNeeds) for (const component of components.filter((row: any) => row.product_id === need.product_id && (row.product_variant_id || null) === need.variant_id) as any[]) {
      const key = physicalIdentityKey(component.component_id, component.variant_id || null);
      const existing = materialMap.get(key) ?? {
        component_id: component.component_id, variant_id: component.variant_id || null,
        component_name: component.variant ? `${component.component?.name || 'Componente'} · ${component.variant.variant_name}` : component.component?.name || 'Componente não identificado',
        component_sku: component.variant?.sku || component.component?.sku || '', unit: component.variant?.unit || component.component?.unit || 'un', total_needed: 0, stock_available: 0, shortage: 0, orders_affected: [],
      };
      existing.total_needed += Number(component.qty_per_unit || 0) * need.shortage;
      for (const reference of need.orders_affected) if (!existing.orders_affected.includes(reference)) existing.orders_affected.push(reference);
      materialMap.set(key, existing);
    }
    const componentIds = [...new Set([...materialMap.values()].map(need => need.component_id))];
    const { data: inventory } = await supabase.from('inventory').select('product_id, variant_id, quantity').in('product_id', componentIds);
    const stock = sumInventory((inventory || []) as InventoryRow[]);
    return [...materialMap.entries()].map(([key, need]) => ({ ...need, stock_available: stock[key] || 0, shortage: Math.max(0, need.total_needed - (stock[key] || 0)) }))
      .sort((a, b) => b.shortage - a.shortage || a.component_name.localeCompare(b.component_name));
  }, [calculateProductionNeeds]);

  return { calculateProductionNeeds, calculateMaterialNeeds };
}
