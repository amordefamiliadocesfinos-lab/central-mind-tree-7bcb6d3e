import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getPhysicalIdentityUnit } from '@/lib/productVariants';

const SIMPLE_VARIANT_KEY = '__simple__';
const OPEN_PURCHASE_STATUSES = ['confirmado', 'em_transito', 'parcialmente_recebido'] as const;
export const physicalIdentityKey = (productId: string, variantId: string | null) => `${productId}:${variantId ?? SIMPLE_VARIANT_KEY}`;

export interface ProductionNeed {
  product_id: string; variant_id: string | null; product_name: string; variant_name: string | null;
  product_sku: string; variant_sku: string | null; unit: string; demand: number;
  stock_available: number; production_programmed: number; shortage: number; orders_affected: string[];
}
export interface MaterialNeed {
  component_id: string; variant_id: string | null; component_name: string; component_sku: string;
  unit: string; total_needed: number; stock_available: number; open_purchase_qty: number; shortage: number; orders_affected: string[];
}
type InventoryRow = { product_id: string; variant_id: string | null; quantity: number | null };
type ProductionOrderRow = { product_id: string | null; variant_id: string | null; target_quantity: number | null; status: string; items?: Array<{ product_id: string; variant_id: string | null; planned_quantity: number | null }> };
type OpenPurchaseItemRow = {
  id: string;
  purchase_order_id: string;
  product_id: string;
  variant_id: string | null;
  ordered_purchase_qty: number | null;
  conversion_factor: number | null;
};
type ConfirmedReceiptRow = { purchase_order_item_id: string; received_purchase_qty: number | null };

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
    const items = row.items?.length ? row.items : [{ product_id: row.product_id, variant_id: row.variant_id, planned_quantity: row.target_quantity }];
    for (const item of items) {
      const key = physicalIdentityKey(item.product_id, item.variant_id);
      totals[key] = (totals[key] || 0) + Number(item.planned_quantity || 0);
    }
    return totals;
  }, {});
}

/**
 * Converts only the commercial quantity that is still pending into the canonical
 * operational unit. Physical receipt divergence never becomes a fictitious open purchase.
 */
export function sumOpenPurchaseOperationalQty(
  purchaseItems: OpenPurchaseItemRow[],
  confirmedReceipts: ConfirmedReceiptRow[],
) {
  const receivedByItem = confirmedReceipts.reduce<Record<string, number>>((totals, receipt) => {
    totals[receipt.purchase_order_item_id] = (totals[receipt.purchase_order_item_id] || 0) + Number(receipt.received_purchase_qty || 0);
    return totals;
  }, {});

  return purchaseItems.reduce<Record<string, number>>((totals, item) => {
    const orderedCommercialQty = Number(item.ordered_purchase_qty || 0);
    const receivedCommercialQty = receivedByItem[item.id] || 0;
    const pendingCommercialQty = Math.max(0, orderedCommercialQty - receivedCommercialQty);
    const conversionFactor = Number(item.conversion_factor || 0);
    const key = physicalIdentityKey(item.product_id, item.variant_id);
    totals[key] = (totals[key] || 0) + pendingCommercialQty * conversionFactor;
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
        product_sku: item.product?.sku || '', variant_sku: item.variant?.sku || null, unit: getPhysicalIdentityUnit(item.product, item.variant),
        order_reference: order.internal_order_number || order.order_number || order.id.slice(0, 8),
      })));
    if (!demandRows.length) return [];
    const productIds = [...new Set(demandRows.map(row => row.product_id))];
    const [{ data: inventory }, { data: productionOrders }] = await Promise.all([
      supabase.from('inventory').select('product_id, variant_id, quantity').in('product_id', productIds),
      supabase.from('production_orders').select('product_id, variant_id, target_quantity, status, items:production_order_items(product_id,variant_id,planned_quantity)').in('status', ['aberto', 'producao']),
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
        component_sku: component.variant?.sku || component.component?.sku || '', unit: getPhysicalIdentityUnit(component.component, component.variant), total_needed: 0, stock_available: 0, open_purchase_qty: 0, shortage: 0, orders_affected: [],
      };
      existing.total_needed += Number(component.qty_per_unit || 0) * need.shortage;
      for (const reference of need.orders_affected) if (!existing.orders_affected.includes(reference)) existing.orders_affected.push(reference);
      materialMap.set(key, existing);
    }
    const componentIds = [...new Set([...materialMap.values()].map(need => need.component_id))];
    const [{ data: inventory }, { data: openOrders, error: openOrdersError }] = await Promise.all([
      supabase.from('inventory').select('product_id, variant_id, quantity').in('product_id', componentIds),
      supabase.from('purchase_orders').select('id,status').in('status', [...OPEN_PURCHASE_STATUSES]),
    ]);
    if (openOrdersError) console.error('Error fetching open purchase orders for MRP:', openOrdersError);

    let openPurchaseByIdentity: Record<string, number> = {};
    const openOrderIds = (openOrders || []).map(order => order.id);
    if (openOrderIds.length) {
      const { data: purchaseItems, error: purchaseItemsError } = await supabase
        .from('purchase_order_items')
        .select('id,purchase_order_id,product_id,variant_id,ordered_purchase_qty,conversion_factor')
        .in('purchase_order_id', openOrderIds)
        .in('product_id', componentIds);
      if (purchaseItemsError) console.error('Error fetching open purchase items for MRP:', purchaseItemsError);

      const typedPurchaseItems = (purchaseItems || []) as OpenPurchaseItemRow[];
      const purchaseItemIds = typedPurchaseItems.map(item => item.id);
      let confirmedReceiptRows: ConfirmedReceiptRow[] = [];
      if (purchaseItemIds.length) {
        const { data: receiptItems, error: receiptItemsError } = await supabase
          .from('purchase_receipt_items')
          .select('purchase_order_item_id,received_purchase_qty,purchase_receipt_id')
          .in('purchase_order_item_id', purchaseItemIds);
        if (receiptItemsError) console.error('Error fetching purchase receipts for MRP:', receiptItemsError);

        const receiptIds = [...new Set((receiptItems || []).map(row => row.purchase_receipt_id))];
        if (receiptIds.length) {
          const { data: confirmedReceipts, error: confirmedReceiptsError } = await supabase
            .from('purchase_receipts')
            .select('id')
            .in('id', receiptIds)
            .eq('status', 'confirmed');
          if (confirmedReceiptsError) console.error('Error validating confirmed purchase receipts for MRP:', confirmedReceiptsError);
          const confirmedReceiptIds = new Set((confirmedReceipts || []).map(receipt => receipt.id));
          confirmedReceiptRows = (receiptItems || [])
            .filter(row => confirmedReceiptIds.has(row.purchase_receipt_id))
            .map(row => ({
              purchase_order_item_id: row.purchase_order_item_id,
              received_purchase_qty: Number(row.received_purchase_qty || 0),
            }));
        }
      }
      openPurchaseByIdentity = sumOpenPurchaseOperationalQty(typedPurchaseItems, confirmedReceiptRows);
    }

    const stock = sumInventory((inventory || []) as InventoryRow[]);
    return [...materialMap.entries()].map(([key, need]) => {
      const stockAvailable = stock[key] || 0;
      const openPurchaseQty = openPurchaseByIdentity[key] || 0;
      return {
        ...need,
        stock_available: stockAvailable,
        open_purchase_qty: openPurchaseQty,
        shortage: Math.max(0, need.total_needed - stockAvailable - openPurchaseQty),
      };
    }).sort((a, b) => b.shortage - a.shortage || a.component_name.localeCompare(b.component_name));
  }, [calculateProductionNeeds]);

  return { calculateProductionNeeds, calculateMaterialNeeds };
}
