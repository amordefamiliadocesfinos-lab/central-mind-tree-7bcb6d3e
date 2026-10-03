import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getPhysicalIdentityUnit } from '@/lib/productVariants';

const SIMPLE_VARIANT_KEY = '__simple__';
const OPEN_PURCHASE_STATUSES = ['confirmado', 'em_transito', 'parcialmente_recebido'] as const;
export const physicalIdentityKey = (productId: string, variantId: string | null) => `${productId}:${variantId ?? SIMPLE_VARIANT_KEY}`;

export interface ProductionDemandOrigin {
  order_id: string;
  reference: string;
  quantity: number;
  due_date: string | null;
}

export interface ProductionNeed {
  product_id: string; variant_id: string | null; product_name: string; variant_name: string | null;
  product_sku: string; variant_sku: string | null; unit: string; demand: number;
  stock_available: number; stock_committed: number; available_now: number; stock_target: number;
  production_programmed: number; projected_balance: number; shortage: number; orders_affected: string[];
  order_demands: ProductionDemandOrigin[]; suggested_date: string | null;
}
export interface MaterialNeed {
  component_id: string; variant_id: string | null; component_name: string; component_sku: string;
  unit: string; total_needed: number; direct_demand: number; production_requirement: number; stock_target: number;
  stock_available: number; available_now: number; open_purchase_qty: number; projected_balance: number;
  shortage: number; orders_affected: string[];
}

type InventoryRow = { product_id: string; variant_id: string | null; quantity: number | null };
type ProductionOrderRow = { product_id: string | null; variant_id: string | null; target_quantity: number | null; status: string; items?: Array<{ product_id: string; variant_id: string | null; planned_quantity: number | null }> };
type OpenPurchaseItemRow = { id: string; purchase_order_id: string; product_id: string; variant_id: string | null; ordered_purchase_qty: number | null; conversion_factor: number | null };
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

export function sumOpenPurchaseOperationalQty(purchaseItems: OpenPurchaseItemRow[], confirmedReceipts: ConfirmedReceiptRow[]) {
  const receivedByItem = confirmedReceipts.reduce<Record<string, number>>((totals, receipt) => {
    totals[receipt.purchase_order_item_id] = (totals[receipt.purchase_order_item_id] || 0) + Number(receipt.received_purchase_qty || 0);
    return totals;
  }, {});
  return purchaseItems.reduce<Record<string, number>>((totals, item) => {
    const pendingCommercialQty = Math.max(0, Number(item.ordered_purchase_qty || 0) - (receivedByItem[item.id] || 0));
    const conversionFactor = Number(item.conversion_factor || 0);
    if (!Number.isFinite(conversionFactor) || conversionFactor <= 0) throw new Error(`Item de compra ${item.id} possui fator de conversão inválido para o planejamento.`);
    const key = physicalIdentityKey(item.product_id, item.variant_id);
    totals[key] = (totals[key] || 0) + pendingCommercialQty * conversionFactor;
    return totals;
  }, {});
}

export function useMRP() {
  const calculateOperationalPlan = useCallback(async () => {
    const { data: orders, error: ordersError } = await supabase.from('orders').select(`
      id, order_number, internal_order_number, status, operational_status, due_date,
      items:order_items(product_id, variant_id, quantity,
        product:products!order_items_product_id_fkey(id,name,sku,unit,min_stock,is_manufactured,is_purchased,variation_mode),
        variant:product_variants!order_items_variant_id_fkey(id,variant_name,sku,unit))
    `).is('deleted_at', null);
    if (ordersError || !orders) { console.error('Erro ao buscar demanda do planejamento:', ordersError); return { production: [] as ProductionNeed[], materials: [] as MaterialNeed[] }; }

    const activeOrders = (orders as any[]).filter(order =>
      !['cancelado', 'concluido', 'entregue'].includes(order.status) &&
      !['finalized', 'finalizado', 'concluido', 'cancelado'].includes(order.operational_status || '')
    );

    const demandRows = activeOrders.flatMap(order => (order.items || []).filter((item: any) => item.product_id).map((item: any) => ({
      order_id: order.id,
      product_id: item.product_id,
      variant_id: item.variant_id || null,
      quantity: Number(item.quantity || 0),
      product: item.product,
      variant: item.variant,
      due_date: order.due_date || null,
      order_reference: order.internal_order_number || order.order_number || order.id.slice(0, 8),
    })));
    if (!demandRows.length) return { production: [] as ProductionNeed[], materials: [] as MaterialNeed[] };

    const productIds = [...new Set(demandRows.map(row => row.product_id))];
    const [{ data: inventory }, { data: productionOrders }, { data: openOrders }] = await Promise.all([
      supabase.from('inventory').select('product_id,variant_id,quantity').in('product_id', productIds),
      supabase.from('production_orders').select('product_id,variant_id,target_quantity,status,items:production_order_items(product_id,variant_id,planned_quantity)').in('status', ['aberto', 'producao']),
      supabase.from('purchase_orders').select('id,status').in('status', [...OPEN_PURCHASE_STATUSES]),
    ]);

    const stock = sumInventory((inventory || []) as InventoryRow[]);
    const programmed = sumProgrammedProduction((productionOrders || []) as ProductionOrderRow[]);

    let openPurchaseByIdentity: Record<string, number> = {};
    const openOrderIds = (openOrders || []).map((row: any) => row.id);
    if (openOrderIds.length) {
      const { data: purchaseItems } = await supabase.from('purchase_order_items')
        .select('id,purchase_order_id,product_id,variant_id,ordered_purchase_qty,conversion_factor')
        .in('purchase_order_id', openOrderIds);
      const typedItems = (purchaseItems || []) as OpenPurchaseItemRow[];
      const itemIds = typedItems.map(item => item.id);
      let confirmedRows: ConfirmedReceiptRow[] = [];
      if (itemIds.length) {
        const { data: receiptItems } = await supabase.from('purchase_receipt_items')
          .select('purchase_order_item_id,received_purchase_qty,purchase_receipt_id').in('purchase_order_item_id', itemIds);
        const receiptIds = [...new Set((receiptItems || []).map((row: any) => row.purchase_receipt_id))];
        if (receiptIds.length) {
          const { data: receipts } = await supabase.from('purchase_receipts').select('id').in('id', receiptIds).eq('status', 'confirmed');
          const confirmedIds = new Set((receipts || []).map((row: any) => row.id));
          confirmedRows = (receiptItems || []).filter((row: any) => confirmedIds.has(row.purchase_receipt_id)).map((row: any) => ({ purchase_order_item_id: row.purchase_order_item_id, received_purchase_qty: row.received_purchase_qty }));
        }
      }
      try { openPurchaseByIdentity = sumOpenPurchaseOperationalQty(typedItems, confirmedRows); }
      catch (error) { console.error(error); }
    }

    const demandMap = new Map<string, any>();
    for (const row of demandRows) {
      const key = physicalIdentityKey(row.product_id, row.variant_id);
      const current = demandMap.get(key) ?? { ...row, demand: 0, orders_affected: [] as string[], order_demands: [] as ProductionDemandOrigin[] };
      current.demand += row.quantity;
      if (!current.orders_affected.includes(row.order_reference)) current.orders_affected.push(row.order_reference);
      const existingOrigin = current.order_demands.find((origin: ProductionDemandOrigin) => origin.order_id === row.order_id);
      if (existingOrigin) existingOrigin.quantity += row.quantity;
      else current.order_demands.push({ order_id: row.order_id, reference: row.order_reference, quantity: row.quantity, due_date: row.due_date });
      demandMap.set(key, current);
    }

    const production: ProductionNeed[] = [];
    const materialsMap = new Map<string, MaterialNeed>();

    for (const [key, row] of demandMap.entries()) {
      const product = row.product || {};
      const variant = row.variant || null;
      const physical = stock[key] || 0;
      const target = row.variant_id ? 0 : Number(product.min_stock || 0);
      const productionProgrammed = programmed[key] || 0;
      const availableNow = physical - row.demand;
      const dated = (row.order_demands as ProductionDemandOrigin[]).map(origin => origin.due_date).filter(Boolean) as string[];
      const suggestedDate = dated.length ? [...dated].sort()[0] : null;

      if (product.is_manufactured) {
        const shortage = Math.max(0, row.demand + target - physical - productionProgrammed);
        production.push({
          product_id: row.product_id, variant_id: row.variant_id,
          product_name: product.name || 'Produto não identificado', variant_name: variant?.variant_name || null,
          product_sku: product.sku || '', variant_sku: variant?.sku || null,
          unit: getPhysicalIdentityUnit(product, variant), demand: row.demand,
          stock_available: physical, stock_committed: row.demand, available_now: availableNow,
          stock_target: target, production_programmed: productionProgrammed,
          projected_balance: physical + productionProgrammed - row.demand,
          shortage, orders_affected: row.orders_affected,
          order_demands: row.order_demands,
          suggested_date: suggestedDate,
        });
      }

      if (product.is_purchased && !product.is_manufactured) {
        const existing = materialsMap.get(key) ?? {
          component_id: row.product_id, variant_id: row.variant_id,
          component_name: variant ? `${product.name} · ${variant.variant_name}` : product.name,
          component_sku: variant?.sku || product.sku || '', unit: getPhysicalIdentityUnit(product, variant),
          total_needed: 0, direct_demand: 0, production_requirement: 0, stock_target: target,
          stock_available: physical, available_now: 0, open_purchase_qty: openPurchaseByIdentity[key] || 0,
          projected_balance: 0, shortage: 0, orders_affected: [] as string[],
        };
        existing.direct_demand += row.demand;
        for (const ref of row.orders_affected) if (!existing.orders_affected.includes(ref)) existing.orders_affected.push(ref);
        materialsMap.set(key, existing);
      }
    }

    const productionShortages = production.filter(need => need.shortage > 0);
    if (productionShortages.length) {
      const manufacturedIds = [...new Set(productionShortages.map(need => need.product_id))];
      const { data: components } = await supabase.from('product_components').select(`
        product_id,product_variant_id,component_id,variant_id,qty_per_unit,
        component:products!product_components_component_id_fkey(id,name,sku,unit,min_stock,is_purchased),
        variant:product_variants!product_components_variant_id_fkey(id,variant_name,sku,unit)
      `).in('product_id', manufacturedIds);

      const componentIds = [...new Set((components || []).map((row: any) => row.component_id))];
      let componentStock: Record<string, number> = {};
      if (componentIds.length) {
        const { data: componentInventory } = await supabase.from('inventory').select('product_id,variant_id,quantity').in('product_id', componentIds);
        componentStock = sumInventory((componentInventory || []) as InventoryRow[]);
      }

      for (const need of productionShortages) {
        for (const component of (components || []).filter((row: any) => row.product_id === need.product_id && (row.product_variant_id || null) === need.variant_id) as any[]) {
          if (component.component?.is_purchased === false) continue;
          const key = physicalIdentityKey(component.component_id, component.variant_id || null);
          const product = component.component || {};
          const variant = component.variant || null;
          const target = component.variant_id ? 0 : Number(product.min_stock || 0);
          const existing = materialsMap.get(key) ?? {
            component_id: component.component_id, variant_id: component.variant_id || null,
            component_name: variant ? `${product.name || 'Componente'} · ${variant.variant_name}` : product.name || 'Componente não identificado',
            component_sku: variant?.sku || product.sku || '', unit: getPhysicalIdentityUnit(product, variant),
            total_needed: 0, direct_demand: 0, production_requirement: 0, stock_target: target,
            stock_available: componentStock[key] || 0, available_now: 0, open_purchase_qty: openPurchaseByIdentity[key] || 0,
            projected_balance: 0, shortage: 0, orders_affected: [] as string[],
          };
          existing.production_requirement += Number(component.qty_per_unit || 0) * need.shortage;
          for (const ref of need.orders_affected) if (!existing.orders_affected.includes(ref)) existing.orders_affected.push(ref);
          materialsMap.set(key, existing);
        }
      }
    }

    const materials = [...materialsMap.values()].map(need => {
      const totalNeeded = need.direct_demand + need.production_requirement + need.stock_target;
      const availableNow = need.stock_available - need.direct_demand;
      const projected = need.stock_available + need.open_purchase_qty - need.direct_demand - need.production_requirement;
      return { ...need, total_needed: totalNeeded, available_now: availableNow, projected_balance: projected, shortage: Math.max(0, totalNeeded - need.stock_available - need.open_purchase_qty) };
    });

    production.sort((a, b) => b.shortage - a.shortage || a.product_name.localeCompare(b.product_name));
    materials.sort((a, b) => b.shortage - a.shortage || a.component_name.localeCompare(b.component_name));
    return { production, materials };
  }, []);

  const calculateProductionNeeds = useCallback(async () => (await calculateOperationalPlan()).production, [calculateOperationalPlan]);
  const calculateMaterialNeeds = useCallback(async () => (await calculateOperationalPlan()).materials, [calculateOperationalPlan]);

  return { calculateOperationalPlan, calculateProductionNeeds, calculateMaterialNeeds };
}
